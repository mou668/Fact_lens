"""Bidirectional LSTM with additive attention over tokens.

The attention distribution is stored with the model so the Result page can show
a real attention heatmap rather than a derived heuristic.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

from .config import LSTM

_TOKEN = re.compile(r"[a-z0-9']+")
PAD, UNK = "<pad>", "<unk>"


def tokenize(text: str) -> list[str]:
    return _TOKEN.findall(text.lower())


class AttentiveLSTM(nn.Module):
    def __init__(self, vocab_size: int, embed_dim: int, hidden_dim: int, dropout: float):
        super().__init__()
        self.embedding = nn.Embedding(vocab_size, embed_dim, padding_idx=0)
        self.dropout = nn.Dropout(dropout)
        self.lstm = nn.LSTM(
            embed_dim, hidden_dim, batch_first=True, bidirectional=True, num_layers=1
        )
        self.attention = nn.Linear(hidden_dim * 2, 1, bias=False)
        self.classifier = nn.Linear(hidden_dim * 2, 2)

    def forward(self, ids, mask):
        emb = self.dropout(self.embedding(ids))
        out, _ = self.lstm(emb)                                # (B, T, 2H)
        scores = self.attention(out).squeeze(-1)               # (B, T)
        scores = scores.masked_fill(~mask, float("-inf"))
        weights = torch.softmax(scores, dim=1)
        context = torch.bmm(weights.unsqueeze(1), out).squeeze(1)
        logits = self.classifier(self.dropout(context))
        return logits, weights


def build_vocab(texts, max_vocab: int = LSTM["max_vocab"], min_freq: int = LSTM["min_freq"]) -> dict:
    counter: Counter[str] = Counter()
    for text in texts:
        counter.update(tokenize(text))
    vocab = {PAD: 0, UNK: 1}
    for word, freq in counter.most_common(max_vocab - 2):
        if freq >= min_freq:
            vocab[word] = len(vocab)
    return vocab


class LSTMClassifier:
    """Inference wrapper that keeps the vocabulary and attention plumbing."""

    def __init__(self, model: AttentiveLSTM, vocab: dict, max_len: int = LSTM["max_len"]):
        self.model = model.eval()
        self.vocab = vocab
        self.max_len = max_len

    @torch.no_grad()
    def predict_proba(self, texts: list[str]) -> tuple[np.ndarray, list[np.ndarray], list[list[str]]]:
        probs, attentions, tokens_out = [], [], []
        for text in texts:
            tokens = tokenize(text)[: self.max_len]
            ids = [self.vocab.get(t, 1) for t in tokens] or [1]
            mask = torch.ones(1, len(ids), dtype=torch.bool)
            logits, weights = self.model(torch.tensor([ids]), mask)
            probs.append(torch.softmax(logits, dim=1)[0, 1].item())
            attentions.append(weights[0, : len(ids)].cpu().numpy())
            tokens_out.append(tokens)
        return np.asarray(probs), attentions, tokens_out

    def save(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        torch.save(self.model.state_dict(), directory / "lstm.pt")
        (directory / "vocab.json").write_text(json.dumps(self.vocab), encoding="utf-8")
        (directory / "config.json").write_text(
            json.dumps(
                {
                    "max_len": self.max_len,
                    "vocab_size": len(self.vocab),
                    "embed_dim": LSTM["embed_dim"],
                    "hidden_dim": LSTM["hidden_dim"],
                }
            ),
            encoding="utf-8",
        )

    @classmethod
    def load(cls, directory: Path) -> "LSTMClassifier":
        cfg = json.loads((directory / "config.json").read_text(encoding="utf-8"))
        model = AttentiveLSTM(cfg["vocab_size"], cfg["embed_dim"], cfg["hidden_dim"], LSTM["dropout"])
        model.load_state_dict(torch.load(directory / "lstm.pt", map_location="cpu"))
        vocab = json.loads((directory / "vocab.json").read_text(encoding="utf-8"))
        return cls(model, vocab, cfg["max_len"])


def _batches(n: int, size: int):
    order = np.random.permutation(n)
    for start in range(0, n, size):
        yield order[start : start + size]


def train_lstm(train_texts, train_labels, val_texts, val_labels, log=print) -> tuple[LSTMClassifier, dict]:
    vocab = build_vocab(train_texts)
    max_len = LSTM["max_len"]

    def encode(texts):
        ids = np.zeros((len(texts), max_len), dtype=np.int64)
        mask = np.zeros((len(texts), max_len), dtype=bool)
        for i, text in enumerate(texts):
            toks = tokenize(text)[:max_len]
            for j, tok in enumerate(toks):
                ids[i, j] = vocab.get(tok, 1)
                mask[i, j] = True
            if not toks:
                ids[i, 0], mask[i, 0] = 1, True
        return torch.from_numpy(ids), torch.from_numpy(mask)

    n_train = min(len(train_texts), LSTM["max_train_samples"])
    n_val = min(len(val_texts), LSTM["max_eval_samples"])
    x_train, m_train = encode(list(train_texts)[:n_train])
    y_train = torch.tensor(list(train_labels)[:n_train], dtype=torch.long)
    x_val, m_val = encode(list(val_texts)[:n_val])
    y_val = torch.tensor(list(val_labels)[:n_val], dtype=torch.long)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = AttentiveLSTM(len(vocab), LSTM["embed_dim"], LSTM["hidden_dim"], LSTM["dropout"]).to(device)
    optimiser = torch.optim.Adam(model.parameters(), lr=LSTM["lr"])
    criterion = nn.CrossEntropyLoss()

    history = []
    for epoch in range(1, LSTM["epochs"] + 1):
        model.train()
        total_loss, seen = 0.0, 0
        for idx in _batches(n_train, LSTM["batch_size"]):
            batch_ids = x_train[idx].to(device)
            batch_mask = m_train[idx].to(device)
            labels = y_train[idx].to(device)
            optimiser.zero_grad()
            logits, _ = model(batch_ids, batch_mask)
            loss = criterion(logits, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimiser.step()
            total_loss += loss.item() * len(idx)
            seen += len(idx)
        model.eval()
        with torch.no_grad():
            val_logits, _ = model(x_val.to(device), m_val.to(device))
            val_pred = val_logits.argmax(1).cpu()
            val_acc = float((val_pred == y_val).float().mean())
        row = {"epoch": epoch, "train_loss": round(total_loss / max(seen, 1), 4), "val_accuracy": round(val_acc, 4)}
        history.append(row)
        log(f"  LSTM epoch {epoch}/{LSTM['epochs']}  loss={row['train_loss']}  val_acc={row['val_accuracy']}")

    wrapper = LSTMClassifier(model.cpu(), vocab, max_len)
    info = {
        "epochs": LSTM["epochs"],
        "vocab_size": len(vocab),
        "max_len": max_len,
        "train_samples": n_train,
        "history": history,
        "device": str(device),
    }
    return wrapper, info
