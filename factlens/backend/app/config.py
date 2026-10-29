from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://factlens:factlens@localhost:5432/factlens"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60
    LOGIN_MAX_ATTEMPTS: int = 5
    LOGIN_WINDOW_SECONDS: int = 300
    CORS_ORIGINS: str = "http://localhost:5173"
    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None
    GOOGLE_FACT_CHECK_API_KEY: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
