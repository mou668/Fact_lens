"""Analysis endpoints.
=====================================================================
TODO: replace with real ML  ->  owner: ML teammate
All functions below return the SAMPLE JSON from the API contract.
Plug in the real pipeline from /ml inside `run_model()`.
====================================================================="""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..deps import get_current_user
from ..models import User, Analysis, Feedback
from ..schemas import AnalyzeIn, FeedbackIn

router = APIRouter(prefix="/api", tags=["analysis"])

SAMPLE = {
    "id": 17, "label": "FAKE", "confidence": 0.937,
    "models": [{"name": "BERT", "label": "FAKE", "confidence": 0.95}],
    "words": [{"word": "miracle", "score": 0.842}],
    "shap": [{"feature": "Exclamation Count", "value": 1.283}],
}


def run_model(text: str) -> dict:
    # TODO: replace with real ML, e.g. `from ml.predict import predict; return predict(text)`
    return {k: v for k, v in SAMPLE.items() if k != "id"}


@router.post("/analyze")
def analyze(data: AnalyzeIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    out = run_model(data.text)
    row = Analysis(user_id=user.id, text=data.text, label=out["label"],
                   confidence=out["confidence"], result=out)
    db.add(row); db.commit(); db.refresh(row)
    return {"id": row.id, **out}


@router.get("/result/{analysis_id}")
def result(analysis_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(Analysis, analysis_id)
    if not row or row.user_id != user.id:
        # TODO: remove stub fallback once real data exists
        if analysis_id == SAMPLE["id"]:
            return SAMPLE
        raise HTTPException(404, "Result not found")
    return {"id": row.id, **row.result}


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (db.query(Analysis).filter(Analysis.user_id == user.id)
            .order_by(Analysis.created_at.desc()).limit(100).all())
    return [{"id": r.id, "label": r.label, "confidence": r.confidence,
             "snippet": r.text[:140], "created_at": r.created_at.isoformat()} for r in rows]


@router.post("/feedback", status_code=201)
def feedback(data: FeedbackIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fb = Feedback(user_id=user.id, analysis_id=data.analysis_id, correct=data.correct, comment=data.comment)
    db.add(fb); db.commit()
    return {"ok": True, "id": fb.id}
