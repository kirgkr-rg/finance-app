from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from app.config import get_settings
from app.database import engine
from app.models import Base
from app.routers import (
    auth_router,
    users_router,
    groups_router,
    companies_router,
    accounts_router,
    permissions_router,
    transactions_router,
    operations_router,
    attachments_router,
    pending_entries_router
)

settings = get_settings()

# Crear tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app_name,
    description="API para gestión financiera de empresas",
    version="1.0.0"
)

# CORS - permitir frontend local y en producción
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    os.getenv("FRONTEND_URL", ""),
    "https://*.up.railway.app",
]
# Filtrar vacíos
origins = [o for o in origins if o]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, cambiar a origins específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(groups_router)
app.include_router(companies_router)
app.include_router(accounts_router)
app.include_router(permissions_router)
app.include_router(transactions_router)
app.include_router(operations_router)
app.include_router(attachments_router)
app.include_router(pending_entries_router)


@app.get("/")
def root():
    return {"message": "Finance App API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
