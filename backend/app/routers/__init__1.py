from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.companies import router as companies_router
from app.routers.accounts import router as accounts_router
from app.routers.permissions import router as permissions_router
from app.routers.transactions import router as transactions_router
from app.routers.operations import router as operations_router

__all__ = [
    "auth_router",
    "users_router",
    "companies_router",
    "accounts_router",
    "permissions_router",
    "transactions_router",
    "operations_router"
]
