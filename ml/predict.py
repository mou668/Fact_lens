"""ML entry point -- owner: ML teammate.
Implement predict(text) and return a dict matching the API contract (without "id"):
{"label": "REAL|FAKE|UNCERTAIN", "confidence": float,
 "models": [{"name", "label", "confidence"}],
 "words": [{"word", "score"}], "shap": [{"feature", "value"}]}
Then call it from backend/app/routers/analysis.py -> run_model()."""


def predict(text: str) -> dict:
    raise NotImplementedError("TODO: implement real model")
