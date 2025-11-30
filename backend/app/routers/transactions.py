from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List
from uuid import UUID
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.models import User, Account, AccountPermission, Transaction
from app.schemas import (
    TransferCreate, DepositCreate, WithdrawalCreate, ConfirmingSettlementCreate,
    TransactionResponse, TransactionWithAccounts
)
from app.auth import get_current_user, get_current_supervisor, check_account_permission

router = APIRouter(prefix="/api/transactions", tags=["Transacciones"])


@router.post("/transfer", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_transfer(
    transfer_data: TransferCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Realizar una transferencia entre cuentas."""
    # Verificar permisos
    if not check_account_permission(db, current_user, transfer_data.from_account_id, require_transfer=True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para transferir desde esta cuenta"
        )
    
    # Si se especifica una operación, verificar que exista y esté abierta
    if transfer_data.operation_id:
        from app.models import Operation
        operation = db.query(Operation).filter(
            Operation.id == transfer_data.operation_id
        ).first()
        
        if not operation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Operación no encontrada"
            )
        
        if operation.status != "open":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La operación no está abierta"
            )
    
    # Obtener cuentas
    from_account = db.query(Account).filter(
        Account.id == transfer_data.from_account_id,
        Account.is_active == True
    ).first()
    
    to_account = db.query(Account).filter(
        Account.id == transfer_data.to_account_id,
        Account.is_active == True
    ).first()
    
    if not from_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta de origen no encontrada"
        )
    
    if not to_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta de destino no encontrada"
        )
    
    if from_account.id == to_account.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede transferir a la misma cuenta"
        )
    
    # Verificar disponible según tipo de cuenta
    if from_account.account_type == "corriente":
        if from_account.balance < transfer_data.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Saldo insuficiente. Disponible: {from_account.balance} {from_account.currency}"
            )
    elif from_account.account_type in ["credito", "confirming"]:
        available = from_account.credit_limit + from_account.balance
        if available < transfer_data.amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Disponible insuficiente. Disponible: {available} {from_account.currency}"
            )
    
    # Realizar transferencia
    from_account.balance -= transfer_data.amount
    
    # Cuentas confirming solo emiten, no reciben
    if to_account.account_type == "confirming":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Las cuentas de confirming no pueden recibir transferencias"
        )
    
    to_account.balance += transfer_data.amount
    
    transaction = Transaction(
        from_account_id=from_account.id,
        to_account_id=to_account.id,
        amount=transfer_data.amount,
        description=transfer_data.description,
        transaction_type="transfer",
        status="completed",
        operation_id=transfer_data.operation_id,
        from_balance_after=from_account.balance,
        to_balance_after=to_account.balance,
        transaction_date=transfer_data.transaction_date or datetime.utcnow(),
        created_by=current_user.id
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


@router.post("/deposit", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_deposit(
    deposit_data: DepositCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Realizar un depósito (solo supervisores)."""
    account = db.query(Account).filter(
        Account.id == deposit_data.to_account_id,
        Account.is_active == True
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    account.balance += deposit_data.amount
    
    transaction = Transaction(
        to_account_id=account.id,
        amount=deposit_data.amount,
        description=deposit_data.description,
        transaction_type="deposit",
        status="completed",
        to_balance_after=account.balance,
        transaction_date=deposit_data.transaction_date or datetime.utcnow(),
        created_by=current_user.id
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


@router.post("/withdrawal", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_withdrawal(
    withdrawal_data: WithdrawalCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Realizar un retiro (solo supervisores)."""
    account = db.query(Account).filter(
        Account.id == withdrawal_data.from_account_id,
        Account.is_active == True
    ).first()
    
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )
    
    if account.balance < withdrawal_data.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Saldo insuficiente. Disponible: {account.balance} {account.currency}"
        )
    
    account.balance -= withdrawal_data.amount
    
    transaction = Transaction(
        from_account_id=account.id,
        amount=withdrawal_data.amount,
        description=withdrawal_data.description,
        transaction_type="withdrawal",
        status="completed",
        from_balance_after=account.balance,
        transaction_date=withdrawal_data.transaction_date or datetime.utcnow(),
        created_by=current_user.id
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


@router.post("/confirming-settlement", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
def create_confirming_settlement(
    settlement_data: ConfirmingSettlementCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """
    Registrar vencimiento de confirming (solo supervisores).
    
    Cuando vence una factura pagada por confirming:
    - El banco cobra de la cuenta corriente indicada
    - El disponible del confirming se regenera (aumenta)
    """
    # Obtener cuenta confirming
    confirming_account = db.query(Account).filter(
        Account.id == settlement_data.confirming_account_id,
        Account.is_active == True
    ).first()
    
    if not confirming_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta confirming no encontrada"
        )
    
    if confirming_account.account_type != "confirming":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta seleccionada no es de tipo confirming"
        )
    
    # Obtener cuenta de cargo
    charge_account = db.query(Account).filter(
        Account.id == settlement_data.charge_account_id,
        Account.is_active == True
    ).first()
    
    if not charge_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta de cargo no encontrada"
        )
    
    if charge_account.account_type != "corriente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La cuenta de cargo debe ser una cuenta corriente"
        )
    
    # Verificar que hay saldo suficiente en la cuenta de cargo
    if charge_account.balance < settlement_data.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Saldo insuficiente en cuenta de cargo. Disponible: {charge_account.balance} {charge_account.currency}"
        )
    
    # Verificar que el confirming tiene ese importe emitido (balance negativo)
    emitido = abs(confirming_account.balance)
    if settlement_data.amount > emitido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El importe a liquidar ({settlement_data.amount}) supera lo emitido ({emitido})"
        )
    
    # Realizar la liquidación:
    # 1. Cobrar de la cuenta corriente
    charge_account.balance -= settlement_data.amount
    
    # 2. Regenerar disponible del confirming (reducir lo emitido = aumentar balance hacia 0)
    confirming_account.balance += settlement_data.amount
    
    # Crear transacción de registro
    transaction = Transaction(
        from_account_id=charge_account.id,
        to_account_id=confirming_account.id,
        amount=settlement_data.amount,
        description=settlement_data.description or "Vencimiento confirming",
        transaction_type="confirming_settlement",
        status="completed",
        from_balance_after=charge_account.balance,
        to_balance_after=confirming_account.balance,
        transaction_date=settlement_data.transaction_date or datetime.utcnow(),
        created_by=current_user.id
    )
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return transaction


@router.get("/", response_model=List[TransactionWithAccounts])
def list_transactions(
    account_id: UUID = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar transacciones visibles para el usuario."""
    query = db.query(Transaction).options(
        joinedload(Transaction.from_account).joinedload(Account.company),
        joinedload(Transaction.to_account).joinedload(Account.company)
    ).order_by(Transaction.created_at.desc())
    
    if account_id:
        # Verificar permiso para la cuenta específica
        if not check_account_permission(db, current_user, account_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta cuenta"
            )
        query = query.filter(
            or_(
                Transaction.from_account_id == account_id,
                Transaction.to_account_id == account_id
            )
        )
    elif current_user.role != "supervisor":
        # Filtrar por cuentas con permiso
        permitted_account_ids = db.query(AccountPermission.account_id).filter(
            AccountPermission.user_id == current_user.id,
            AccountPermission.can_view == True
        ).subquery()
        
        query = query.filter(
            or_(
                Transaction.from_account_id.in_(permitted_account_ids),
                Transaction.to_account_id.in_(permitted_account_ids)
            )
        )
    
    return query.limit(limit).all()


@router.get("/{transaction_id}", response_model=TransactionWithAccounts)
def get_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener una transacción específica."""
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id
    ).options(
        joinedload(Transaction.from_account).joinedload(Account.company),
        joinedload(Transaction.to_account).joinedload(Account.company)
    ).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transacción no encontrada"
        )
    
    # Verificar permisos
    if current_user.role != "supervisor":
        has_permission = False
        if transaction.from_account_id:
            has_permission = has_permission or check_account_permission(
                db, current_user, transaction.from_account_id
            )
        if transaction.to_account_id:
            has_permission = has_permission or check_account_permission(
                db, current_user, transaction.to_account_id
            )
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta transacción"
            )
    
    return transaction


@router.patch("/{transaction_id}/assign-operation", response_model=TransactionResponse)
def assign_transaction_to_operation(
    transaction_id: UUID,
    operation_id: UUID = None,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Asignar o desasignar una transacción a una operación (solo supervisores)."""
    from app.models import Operation
    
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transacción no encontrada"
        )
    
    if operation_id:
        # Verificar que la operación existe y está abierta
        operation = db.query(Operation).filter(Operation.id == operation_id).first()
        
        if not operation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Operación no encontrada"
            )
        
        if operation.status != "open":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo se puede asignar a operaciones abiertas"
            )
        
        transaction.operation_id = operation_id
    else:
        # Desasignar de operación
        transaction.operation_id = None
    
    db.commit()
    db.refresh(transaction)
    
    return transaction
