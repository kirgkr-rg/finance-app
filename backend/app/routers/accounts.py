from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models import User, Company, Account, AccountPermission, Transaction
from app.schemas import AccountCreate, AccountUpdate, AccountResponse, AccountWithCompany
from app.auth import get_current_user, get_current_supervisor, check_account_permission

router = APIRouter(prefix="/api/accounts", tags=["Cuentas"])


@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
def create_account(
    account_data: AccountCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Crear una nueva cuenta (solo supervisores)."""
    # Verificar que la empresa existe
    company = db.query(Company).filter(
        Company.id == account_data.company_id,
        Company.is_active == True
    ).first()
    
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Empresa no encontrada"
        )
    
    # Validar tipo de cuenta
    if account_data.account_type not in ["corriente", "credito", "confirming"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de cuenta inválido"
        )
    
    # Calcular balance inicial según tipo de cuenta
    initial_balance = account_data.initial_balance
    
    if account_data.account_type in ["credito", "confirming"]:
        # Si se especifica disponible inicial, calcular el balance (usado)
        if account_data.initial_available is not None:
            if account_data.initial_available > account_data.credit_limit:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="El disponible no puede ser mayor que el límite"
                )
            # Balance = disponible - límite (será negativo o 0)
            initial_balance = account_data.initial_available - account_data.credit_limit
        else:
            initial_balance = Decimal("0.00")
    
    account = Account(
        company_id=account_data.company_id,
        name=account_data.name,
        iban=account_data.iban,
        account_type=account_data.account_type,
        currency=account_data.currency,
        balance=initial_balance,
        credit_limit=account_data.credit_limit
    )
    
    db.add(account)
    db.commit()
    db.refresh(account)
    
    return account


@router.get("/", response_model=List[AccountWithCompany])
def list_accounts(
    company_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar cuentas. Supervisores ven todas, usuarios solo las permitidas."""
    query = db.query(Account).filter(Account.is_active == True).options(
        joinedload(Account.company)
    )
    
    if company_id:
        query = query.filter(Account.company_id == company_id)
    
    if current_user.role == "supervisor":
        accounts = query.all()
    else:
        # Filtrar solo cuentas con permiso
        permitted_account_ids = db.query(AccountPermission.account_id).filter(
            AccountPermission.user_id == current_user.id,
            AccountPermission.can_view == True
        ).subquery()
        
        accounts = query.filter(Account.id.in_(permitted_account_ids)).all()
    
    return accounts


@router.get("/{account_id}", response_model=AccountWithCompany)
def get_account(
    account_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener una cuenta específica."""
    account = db.query(Account).filter(
        Account.id == account_id,
        Account.is_active == True
    ).options(joinedload(Account.company)).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    if not check_account_permission(db, current_user, account_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para ver esta cuenta"
        )
    
    return account


@router.patch("/{account_id}", response_model=AccountResponse)
def update_account(
    account_id: UUID,
    account_data: AccountUpdate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Actualizar una cuenta (solo supervisores)."""
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    update_data = account_data.model_dump(exclude_unset=True)
    
    # Si se actualiza el disponible para crédito/confirming
    if "initial_available" in update_data and account.account_type in ["credito", "confirming"]:
        new_available = update_data.pop("initial_available")
        credit_limit = update_data.get("credit_limit", account.credit_limit)
        
        if new_available > credit_limit:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El disponible no puede ser mayor que el límite"
            )
        # Balance = disponible - límite
        account.balance = new_available - credit_limit
    elif "initial_available" in update_data:
        update_data.pop("initial_available")  # Ignorar para cuentas corrientes
    
    for field, value in update_data.items():
        setattr(account, field, value)
    
    db.commit()
    db.refresh(account)
    
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    account_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Desactivar una cuenta (solo supervisores)."""
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    # Verificar que no tiene saldo
    if account.balance > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede desactivar una cuenta con saldo positivo"
        )
    
    account.is_active = False
    db.commit()


@router.post("/{account_id}/adjust-balance")
def adjust_balance(
    account_id: UUID,
    target_balance: Decimal,
    description: str = "Ajuste de saldo",
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """
    Ajustar el saldo de una cuenta creando una transacción de ajuste.
    Crea un ingreso o retirada según la diferencia.
    """
    account = db.query(Account).filter(Account.id == account_id).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    current_balance = account.balance
    difference = target_balance - current_balance
    
    if difference == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El saldo ya coincide"
        )
    
    # Crear transacción de ajuste
    if difference > 0:
        # Ingreso
        transaction = Transaction(
            to_account_id=account.id,
            amount=difference,
            description=description,
            transaction_type="deposit",
            status="completed",
            transaction_date=datetime.utcnow(),
            created_by=current_user.id
        )
        account.balance = target_balance
        transaction.to_balance_after = account.balance
    else:
        # Retirada
        transaction = Transaction(
            from_account_id=account.id,
            amount=abs(difference),
            description=description,
            transaction_type="withdrawal",
            status="completed",
            transaction_date=datetime.utcnow(),
            created_by=current_user.id
        )
        account.balance = target_balance
        transaction.from_balance_after = account.balance
    
    db.add(transaction)
    db.commit()
    
    return {
        "message": "Saldo ajustado correctamente",
        "previous_balance": float(current_balance),
        "new_balance": float(target_balance),
        "adjustment": float(difference),
        "transaction_type": "deposit" if difference > 0 else "withdrawal"
    }
