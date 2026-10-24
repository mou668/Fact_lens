# FactLens ML pipeline

Owner: **Pavan** (detection + explanation).

Five models vote on every article. The verdict is only published when the vote
is decisive; otherwise the API returns `UNCERTAIN`.

| Model | Features | Notes |
|---|---|---|
| Logistic Regression | TF-IDF word 1–2 grams + 12 style features | Fast, also powers the exact SHAP explanations |
| SVM (LinearSVC + Platt scaling) | same | Calibrated so it can emit probabilities |
| XGBoost | chi²-selected top 30k columns | Gradient-boosted trees |
| BiLSTM + attention | token sequence, 200 tokens | Supplies the attention heatmap |
| BERT (DistilBERT fine-tune) | token sequence, 160 tokens | Strongest single model |

## Train

```bash
pip install -r ml/requirements.txt

# full run (CPU: roughly 40-60 min)
python -m ml.train --with-bert

# quick smoke test (tiny subsets, no BERT)
python -m ml.train --quick

# skip the sequence models
python -m ml.train --skip-lstm
```

The dataset is the ISOT / Kaggle *fake-and-real-news* corpus. Put
`True.csv` and `Fake.csv` in `ml/data/` (git-ignored). A copy is available at
<https://huggingface.co/datasets/genesisqu/fake-real-news>.

## What the training run produces

```
ml/artifacts/classical.joblib   vectoriser + LR + SVM + XGB + SHAP background
ml/artifacts/lstm/              weights, vocab, config
ml/artifacts/bert/              fine-tuned encoder + tokenizer
ml/metrics.json                 real held-out metrics (committed)
```

Artifacts are git-ignored; `metrics.json` is committed so the Models page and
reviewers can see the measured results.

## Results (held-out test set)

Measured by `python -m ml.train --with-bert` on this machine (CPU, 16 cores,
~50 min). LR/SVM/XGBoost are scored on all 3,823 test rows; LSTM and BERT on
1,500 rows because sequence-model inference is slower.

| Model | Accuracy | Precision | Recall | F1 | ROC-AUC |
|---|---|---|---|---|---|
| Logistic Regression | 99.1% | 99.3% | 98.8% | 99.0% | 99.9% |
| SVM | 99.4% | 99.4% | 99.4% | 99.4% | 99.9% |
| XGBoost | 99.6% | 99.6% | 99.5% | 99.5% | 100.0% |
| BiLSTM + attention | 96.7% | 96.8% | 96.1% | 96.4% | 99.4% |
| DistilBERT | 98.7% | 99.4% | 97.8% | 98.6% | 99.8% |

Ensemble on the common 1,500-row slice: **95.9% coverage** (61 `UNCERTAIN`),
**99.9% accuracy on decided rows**, mean confidence 98.0%.

## Data cleaning

* Reuters wire datelines are stripped from real articles.
* Publisher prefixes used by the fake-news crawl are stripped.
* Exact duplicates are removed (44,898 raw → 38,224 usable rows).
* Deterministic stratified 80/10/10 split, seed 42.

Cleaning matters: the raw corpus leaks "Reuters" into almost every real
article, which inflates accuracy without teaching the model anything.

## Ensemble rule

`ml/factlens_ml/ensemble.py`

* 4/5 votes (and a probability spread ≤ 0.55) → publish the majority label.
* 3/5 votes with mean confidence ≥ 0.75 → publish it.
* Anything else → `UNCERTAIN`, with the leading confidence reported but not
  presented as a verdict.

## Explanation

* **SHAP** — exact closed-form Shapley values for the linear model
  (`phi_i = w_i * (x_i - E[x_i])`). Style features are part of the model, so
  entries like "Exclamation Rate" are genuine model features, not heuristics.
* **Word highlights** — n-gram SHAP values split evenly across their words.
* **Attention heatmap** — BiLSTM attention weights (BERT CLS attention as a
  fallback when the LSTM is absent).
* **Counterfactuals** — greedy occlusion of the highest-attribution words,
  re-scored by the full ensemble within a time budget.
* **Tactics + severity** — transparent lexicon/style detectors in
  `tactics.py`; severity blends P(FAKE) with the manipulation score.

## API contract

`backend/app/routers/analysis.py` calls `ml.predict.predict(text)`. Every field
from the original contract (`label`, `confidence`, `models`, `words`, `shap`)
is preserved; the pipeline only **adds** `severity`, `tactics`, `attention`,
`highlights`, `counterfactuals`, `explanation` and `engine`.

If artifacts are missing the registry serves a clearly-labelled heuristic
fallback (`engine.degraded = true`) so the frontend never breaks.
