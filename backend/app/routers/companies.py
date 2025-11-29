from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID

from app.database import get_db
from app.models import User, Company, Account, AccountPermission
from app.schemas import CompanyCreate, CompanyUpdate, CompanyResponse, CompanyWithAccounts
from app.auth import get_current_user, get_current_supervisor

router = APIRouter(prefix="/api/companies", tags=["Empresas"])


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
def create_company(
    company_data: CompanyCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Crear una nueva empresa (solo supervisores)."""
    company = Company(
        name=company_data.name,
        description=company_data.description,
        created_by=current_user.id
    )
    
    db.add(company)
    db.commit()
    db.refresh(company)
    
    return company


@router.get("/", response_model=List[CompanyWithAccounts])
def list_companies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar empresas. Supervisores ven todas, usuarios solo las que tienen permiso."""
    if current_user.role == "supervisor":
        companies = db.query(Company).filter(Company.is_active == True).options(
            joinedload(Company.accounts)
        ).all()
    else:
        # Obtener empresas donde el usuario tiene al menos una cuenta con permiso
        account_ids = db.query(AccountPermission.account_id).filter(
            AccountPermission.user_id == current_user.id,
            AccountPermission.can_view == True
        ).subquery()
        
        company_ids = db.query(Account.company_id).filter(
            Account.id.in_(account_ids)
        ).distinct().subquery()
        
        companies = db.query(Company).filter(
            Company.id.in_(company_ids),
            Company.is_active == True
        ).options(joinedload(Company.accounts)).all()
        
        # Filtrar cuentas para mostrar solo las permitidas
        for company in companies:
            permitted_accounts = []
            for account in company.accounts:
                if db.query(AccountPermission).filter(
                    AccountPermission.user_id == current_user.id,
                    AccountPermission.account_id == account.id,
                    AccountPermission.can_view == True
                ).first():
                    permitted_accounts.append(account)
            company.accounts = permitted_accounts
    
    return companies


@router.get("/{company_id}", response_model=CompanyWithAccounts)
def get_company(
    company_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener una empresa específica."""
    company = db.query(Company).filter(
        Company.id == company_id,
        Company.is_active == True
    ).options(joinedload(Company.accounts)).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    if current_user.role != "supervisor":
        # Verificar si tiene permiso en al menos una cuenta
        has_permission = db.query(AccountPermission).join(Account).filter(
            Account.company_id == company_id,
            AccountPermission.user_id == current_user.id,
            AccountPermission.can_view == True
        ).first()
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta empresa"
            )
        
        # Filtrar cuentas permitidas
        permitted_accounts = []
        for account in company.accounts:
            if db.query(AccountPermission).filter(
                AccountPermission.user_id == current_user.id,
                AccountPermission.account_id == account.id,
                AccountPermission.can_view == True
            ).first():
                permitted_accounts.append(account)
        company.accounts = permitted_accounts
    
    return company


@router.patch("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: UUID,
    company_data: CompanyUpdate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Actualizar una empresa (solo supervisores)."""
    company = db.query(Company).filter(Company.id == company_id).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    update_data = company_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)
    
    db.commit()
    db.refresh(company)
    
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Desactivar una empresa (solo supervisores)."""
    company = db.query(Company).filter(Company.id == company_id).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    company.is_active = False
    db.commit()
