import re
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def strong(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserOut


class AnalyzeIn(BaseModel):
    input_type: str = Field(default="text", pattern="^(text|url|image)$")
    text: str | None = Field(default=None, min_length=10, max_length=20000)
    url: str | None = Field(default=None, min_length=10, max_length=2048)
    image_base64: str | None = Field(default=None)

    @field_validator("url")
    @classmethod
    def url_must_be_valid(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class AnalyzeUrlIn(BaseModel):
    url: str = Field(min_length=10, max_length=2048)


class FactCheckIn(BaseModel):
    claim: str = Field(min_length=10, max_length=500)

    @field_validator("claim")
    @classmethod
    def claim_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Claim must not be blank")
        return re.sub(r"\s+", " ", v).strip()


class FeedbackIn(BaseModel):
    analysis_id: int
    correct: bool
    comment: str | None = Field(default=None, max_length=1000)


class SupportIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    category: str = Field(default="general", max_length=40)
    message: str = Field(min_length=5, max_length=4000)

    @field_validator("message")
    @classmethod
    def message_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Message must not be blank")
        return v.strip()


class HelpFeedbackIn(BaseModel):
    item_id: str = Field(min_length=1, max_length=120)
    helpful: bool
