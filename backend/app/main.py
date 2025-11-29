from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import engine, Base
from app.routers import (
    auth_router,
    users_router,
    companies_router,
    accounts_router,
    permissions_router,
    transactions_router,
    operations_router
)

settings = get_settings()

# Crear tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="API para gestión financiera de empresas",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(companies_router)
app.include_router(accounts_router)
app.include_router(permissions_router)
app.include_router(transactions_router)
app.include_router(operations_router)


@app.get("/")
def root():
    return {"message": "Finance App API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
