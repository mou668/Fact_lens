"""Public help/support endpoints used by the Help page.

Both routes are open (no login required) so anonymous visitors can send
feedback or contact the team.
"""
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import HelpFeedback, SupportMessage
from ..schemas import HelpFeedbackIn, SupportIn

router = APIRouter(prefix="/api", tags=["support"])


@router.post("/support", status_code=status.HTTP_201_CREATED)
def create_support_message(payload: SupportIn, db: Session = Depends(get_db)):
    db.add(SupportMessage(
        name=payload.name.strip(),
        email=str(payload.email).lower(),
        category=payload.category.strip() or "general",
        message=payload.message,
    ))
    db.commit()
    return {"status": "received"}


@router.post("/help/feedback", status_code=status.HTTP_201_CREATED)
def create_help_feedback(payload: HelpFeedbackIn, db: Session = Depends(get_db)):
    db.add(HelpFeedback(item_id=payload.item_id, helpful=payload.helpful))
    db.commit()
    return {"status": "received"}
