from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .config import settings
from .database import Base, engine, SessionLocal
from .models import User, Role
from .security import hash_password
from .routers import auth, analysis

app = FastAPI(title="FactLens API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS.split(","),
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    errors = {".".join(str(p) for p in e["loc"][1:]) or "body": e["msg"].replace("Value error, ", "")
              for e in exc.errors()}
    return JSONResponse(status_code=422, content={"detail": "Validation failed", "errors": errors})


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)  # swap for Alembic migrations later
    if settings.ADMIN_EMAIL and settings.ADMIN_PASSWORD:
        db = SessionLocal()
        if not db.query(User).filter(User.email == settings.ADMIN_EMAIL.lower()).first():
            db.add(User(name="Admin", email=settings.ADMIN_EMAIL.lower(),
                        password_hash=hash_password(settings.ADMIN_PASSWORD), role=Role.admin))
            db.commit()
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(analysis.router)
