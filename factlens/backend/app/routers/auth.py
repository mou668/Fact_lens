from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from ..config import settings
from ..database import get_db
from ..deps import get_current_user
from ..models import User
from ..schemas import RegisterIn, LoginIn, TokenOut, UserOut
from ..security import hash_password, verify_password, create_access_token
from .. import rate_limit

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _token(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(user.id, user.role.value),
                    expires_in=settings.JWT_EXPIRE_MINUTES * 60,
                    user=UserOut(id=user.id, name=user.name, email=user.email, role=user.role.value))


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password))
    db.add(user); db.commit(); db.refresh(user)
    return _token(user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    key = f"{request.client.host if request.client else 'x'}:{data.email.lower()}"
    rate_limit.check(key)
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not verify_password(data.password, user.password_hash):
        rate_limit.fail(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    rate_limit.reset(key)
    return _token(user)


@router.post("/logout", status_code=204)
def logout(_: User = Depends(get_current_user)):
    # Stateless JWT: client discards the token. Add a token denylist here if needed.
    return None


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(id=user.id, name=user.name, email=user.email, role=user.role.value)
