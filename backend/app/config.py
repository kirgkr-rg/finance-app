from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:postgres@localhost:5432/finance_app"
    
    # JWT
    secret_key: str = "tu-clave-secreta-muy-segura-cambiar-en-produccion"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 horas
    
    # App
    app_name: str = "Finance App"
    debug: bool = True
    
    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()
