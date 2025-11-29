from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models import User, Account, AccountPermission
from app.schemas import PermissionCreate, PermissionUpdate, PermissionResponse, PermissionWithDetails
from app.auth import get_current_supervisor

router = APIRouter(prefix="/api/permissions", tags=["Permisos"])


@router.post("/", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
def create_permission(
    permission_data: PermissionCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Asignar permiso a un usuario para una cuenta (solo supervisores)."""
    # Verificar que el usuario existe
    user = db.query(User).filter(
        User.id == permission_data.user_id,
        User.is_active == True
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado"
        )
    
    # Verificar que la cuenta existe
    account = db.query(Account).filter(
        Account.id == permission_data.account_id,
        Account.is_active == True
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    # Verificar si ya existe el permiso
    existing = db.query(AccountPermission).filter(
        AccountPermission.user_id == permission_data.user_id,
        AccountPermission.account_id == permission_data.account_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un permiso para este usuario y cuenta"
        )
    
    permission = AccountPermission(
        user_id=permission_data.user_id,
        account_id=permission_data.account_id,
        can_view=permission_data.can_view,
        can_transfer=permission_data.can_transfer,
        granted_by=current_user.id
    )
    
    db.add(permission)
    db.commit()
    db.refresh(permission)
    
    return permission


@router.get("/", response_model=List[PermissionWithDetails])
def list_permissions(
    user_id: UUID = None,
    account_id: UUID = None,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Listar permisos (solo supervisores)."""
    query = db.query(AccountPermission).options(
        joinedload(AccountPermission.user),
        joinedload(AccountPermission.account).joinedload(Account.company)
    )
    
    if user_id:
        query = query.filter(AccountPermission.user_id == user_id)
    
    if account_id:
        query = query.filter(AccountPermission.account_id == account_id)
    
    return query.all()


@router.get("/user/{user_id}", response_model=List[PermissionWithDetails])
def get_user_permissions(
    user_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Obtener todos los permisos de un usuario (solo supervisores)."""
    permissions = db.query(AccountPermission).filter(
        AccountPermission.user_id == user_id
    ).options(
        joinedload(AccountPermission.user),
        joinedload(AccountPermission.account).joinedload(Account.company)
    ).all()
    
    return permissions


@router.patch("/{permission_id}", response_model=PermissionResponse)
def update_permission(
    permission_id: UUID,
    permission_data: PermissionUpdate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Actualizar un permiso (solo supervisores)."""
    permission = db.query(AccountPermission).filter(
        AccountPermission.id == permission_id
    ).first()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permiso no encontrado"
        )
    
    update_data = permission_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(permission, field, value)
    
    db.commit()
    db.refresh(permission)
    
    return permission


@router.delete("/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission(
    permission_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Eliminar un permiso (solo supervisores)."""
    permission = db.query(AccountPermission).filter(
        AccountPermission.id == permission_id
    ).first()
    
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permiso no encontrado"
        )
    
    db.delete(permission)
    db.commit()
