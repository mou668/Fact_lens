"""Fine-tune a BERT-family encoder (DistilBERT by default) for fake-news detection.

CPU-only machines are common for this project, so the trainer supports a time
budget: it stops early, records how many samples it actually saw, and the
metrics file reflects the real run rather than an assumed one.
"""
from __future__ import annotations

import math
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

from .config import BERT

MAX_TRAIN_MINUTES = 40


class _NewsDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len):
        self.encodings = tokenizer(
            list(texts), truncation=True, max_length=max_len, padding="max_length", return_tensors="pt"
        )
        self.labels = torch.tensor(list(labels), dtype=torch.long)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return (
            self.encodings["input_ids"][idx],
            self.encodings["attention_mask"][idx],
            self.labels[idx],
        )


class BERTClassifier:
    def __init__(self, model, tokenizer, max_len: int):
        self.model = model.eval()
        self.tokenizer = tokenizer
        self.max_len = max_len

    @torch.no_grad()
    def predict_proba(self, texts: list[str], attention: bool = False):
        batch = self.tokenizer(
            list(texts), truncation=True, max_length=self.max_len, padding=True, return_tensors="pt"
        )
        out = self.model(**batch, output_attentions=attention)
        probs = torch.softmax(out.logits, dim=1)[:, 1].cpu().numpy()
        if not attention:
            return probs, None, None

        # CLS attention averaged across heads of the last layer, token aligned.
        weights = out.attentions[-1].mean(dim=1)[:, 0, :].cpu().numpy()
        tokens = [self.tokenizer.convert_ids_to_tokens(ids) for ids in batch["input_ids"]]
        aligned = []
        for row, toks in zip(weights, tokens):
            keep = [i for i, t in enumerate(toks) if t not in self.tokenizer.all_special_tokens]
            vals = row[keep]
            vals = vals / (vals.sum() or 1.0)
            aligned.append(
                (
                    [self.tokenizer.convert_tokens_to_string([toks[i]]).strip() for i in keep],
                    vals,
                )
            )
        return probs, aligned, tokens

    def save(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        self.model.save_pretrained(directory)
        self.tokenizer.save_pretrained(directory)
        (directory / "factlens.json").write_text(f'{{"max_len": {self.max_len}}}', encoding="utf-8")

    @classmethod
    def load(cls, directory: Path) -> "BERTClassifier":
        import json

        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        cfg = json.loads((directory / "factlens.json").read_text(encoding="utf-8"))
        tokenizer = AutoTokenizer.from_pretrained(directory)
        model = AutoModelForSequenceClassification.from_pretrained(directory)
        return cls(model, tokenizer, cfg["max_len"])


def train_bert(train_texts, train_labels, val_texts, val_labels, log=print) -> tuple[BERTClassifier, dict]:
    from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

    tokenizer = AutoTokenizer.from_pretrained(BERT["checkpoint"])
    model = AutoModelForSequenceClassification.from_pretrained(BERT["checkpoint"], num_labels=2)

    n_train = min(len(train_texts), BERT["max_train_samples"])
    n_val = min(len(val_texts), BERT["max_eval_samples"])
    train_ds = _NewsDataset(list(train_texts)[:n_train], list(train_labels)[:n_train], tokenizer, BERT["max_len"])
    val_ds = _NewsDataset(list(val_texts)[:n_val], list(val_labels)[:n_val], tokenizer, BERT["max_len"])

    train_loader = DataLoader(train_ds, batch_size=BERT["batch_size"], shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=BERT["batch_size"] * 2)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    optimiser = torch.optim.AdamW(model.parameters(), lr=BERT["lr"], weight_decay=BERT["weight_decay"])
    total_steps = max(len(train_loader) * BERT["epochs"], 1)
    scheduler = get_linear_schedule_with_warmup(
        optimiser, num_warmup_steps=max(int(total_steps * 0.06), 1), num_training_steps=total_steps
    )
    criterion = nn.CrossEntropyLoss()

    history, started, samples_seen = [], time.time(), 0
    stop = False
    for epoch in range(1, BERT["epochs"] + 1):
        model.train()
        running, batches = 0.0, 0
        for step, (ids, mask, labels) in enumerate(train_loader, 1):
            ids, mask, labels = ids.to(device), mask.to(device), labels.to(device)
            optimiser.zero_grad()
            logits = model(input_ids=ids, attention_mask=mask).logits
            loss = criterion(logits, labels)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimiser.step()
            scheduler.step()
            running += loss.item()
            batches += 1
            samples_seen += ids.size(0)
            if step % 50 == 0:
                log(f"  BERT epoch {epoch} step {step}/{len(train_loader)} loss={running / batches:.4f}")
            if (time.time() - started) / 60 > MAX_TRAIN_MINUTES:
                log(f"  BERT stopping early after {MAX_TRAIN_MINUTES} min budget")
                stop = True
                break
        if stop:
            break

    model.eval()
    correct, total = 0, 0
    with torch.no_grad():
        for ids, mask, labels in val_loader:
            preds = model(input_ids=ids.to(device), attention_mask=mask.to(device)).logits.argmax(1).cpu()
            correct += int((preds == labels).sum())
            total += len(labels)
    val_acc = correct / max(total, 1)
    history.append({"epoch": len(history) + 1, "val_accuracy": round(val_acc, 4), "stopped_early": stop})

    info = {
        "checkpoint": BERT["checkpoint"],
        "epochs_completed": len(history),
        "max_len": BERT["max_len"],
        "batch_size": BERT["batch_size"],
        "train_samples": samples_seen,
        "val_samples": total,
        "stopped_early": stop,
        "train_minutes": round((time.time() - started) / 60, 1),
        "device": str(device),
        "history": history,
    }
    return BERTClassifier(model.cpu(), tokenizer, BERT["max_len"]), info
