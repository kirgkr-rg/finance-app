from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from collections import defaultdict

from app.database import get_db
from app.models import User, Operation, Transaction, Account
from app.schemas import (
    OperationCreate, OperationUpdate, OperationResponse,
    OperationWithTransactions, OperationFlowMap, OperationFlowNode, OperationFlowEdge,
    OperationGroupNode
)
from app.auth import get_current_supervisor

router = APIRouter(prefix="/api/operations", tags=["Operaciones"])


@router.post("/", response_model=OperationResponse, status_code=status.HTTP_201_CREATED)
def create_operation(
    operation_data: OperationCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Crear una nueva operación (solo supervisores)."""
    operation = Operation(
        name=operation_data.name,
        description=operation_data.description,
        status="open",
        created_by=current_user.id
    )
    
    db.add(operation)
    db.commit()
    db.refresh(operation)
    
    return operation


@router.get("/", response_model=List[OperationResponse])
def list_operations(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Listar operaciones (solo supervisores)."""
    query = db.query(Operation).order_by(Operation.created_at.desc())
    
    if status:
        query = query.filter(Operation.status == status)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{operation_id}", response_model=OperationWithTransactions)
def get_operation(
    operation_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Obtener una operación con sus transacciones."""
    operation = db.query(Operation).filter(
        Operation.id == operation_id
    ).options(
        joinedload(Operation.transactions).joinedload(Transaction.from_account).joinedload(Account.company),
        joinedload(Operation.transactions).joinedload(Transaction.to_account).joinedload(Account.company)
    ).first()
    
    if not operation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operación no encontrada"
        )
    
    return operation


@router.get("/{operation_id}/flow", response_model=OperationFlowMap)
def get_operation_flow(
    operation_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Obtener el mapa de flujo de una operación."""
    from app.models import Company
    
    operation = db.query(Operation).filter(
        Operation.id == operation_id
    ).options(
        joinedload(Operation.transactions).joinedload(Transaction.from_account).joinedload(Account.company),
        joinedload(Operation.transactions).joinedload(Transaction.to_account).joinedload(Account.company)
    ).first()
    
    if not operation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operación no encontrada"
        )
    
    # Calcular nodos (empresas involucradas)
    company_flows = defaultdict(lambda: {"in": Decimal("0"), "out": Decimal("0"), "name": "", "group_id": None, "group_name": ""})
    
    edges = []
    
    for tx in operation.transactions:
        if tx.transaction_type == "transfer" and tx.from_account and tx.to_account:
            from_company = tx.from_account.company
            to_company = tx.to_account.company
            
            company_flows[from_company.id]["out"] += tx.amount
            company_flows[from_company.id]["name"] = from_company.name
            company_flows[from_company.id]["group_id"] = from_company.group_id
            company_flows[from_company.id]["group_name"] = from_company.group.name if from_company.group else "Sin grupo"
            
            company_flows[to_company.id]["in"] += tx.amount
            company_flows[to_company.id]["name"] = to_company.name
            company_flows[to_company.id]["group_id"] = to_company.group_id
            company_flows[to_company.id]["group_name"] = to_company.group.name if to_company.group else "Sin grupo"
            
            edges.append(OperationFlowEdge(
                from_company_id=from_company.id,
                from_company_name=from_company.name,
                to_company_id=to_company.id,
                to_company_name=to_company.name,
                amount=tx.amount,
                transaction_id=tx.id,
                created_at=tx.created_at
            ))
    
    nodes = [
        OperationFlowNode(
            company_id=company_id,
            company_name=data["name"],
            total_in=data["in"],
            total_out=data["out"]
        )
        for company_id, data in company_flows.items()
    ]
    
    # Calcular resumen por grupos
    group_flows = defaultdict(lambda: {"in": Decimal("0"), "out": Decimal("0"), "name": ""})
    for company_id, data in company_flows.items():
        group_key = data["group_id"] or "sin_grupo"
        group_flows[group_key]["in"] += data["in"]
        group_flows[group_key]["out"] += data["out"]
        group_flows[group_key]["name"] = data["group_name"]
    
    group_nodes = [
        OperationGroupNode(
            group_id=group_id if group_id != "sin_grupo" else None,
            group_name=data["name"],
            total_in=data["in"],
            total_out=data["out"]
        )
        for group_id, data in group_flows.items()
    ]
    
    return OperationFlowMap(
        operation=operation,
        nodes=nodes,
        edges=edges,
        group_nodes=group_nodes
    )


@router.patch("/{operation_id}", response_model=OperationResponse)
def update_operation(
    operation_id: UUID,
    operation_data: OperationUpdate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Actualizar una operación."""
    operation = db.query(Operation).filter(Operation.id == operation_id).first()
    
    if not operation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operación no encontrada"
        )
    
    update_data = operation_data.model_dump(exclude_unset=True)
    
    # Si se está cerrando la operación, registrar la fecha
    if "status" in update_data:
        if update_data["status"] in ["completed", "cancelled"] and operation.status == "open":
            operation.closed_at = datetime.utcnow()
        elif update_data["status"] == "open":
            operation.closed_at = None
    
    for field, value in update_data.items():
        setattr(operation, field, value)
    
    db.commit()
    db.refresh(operation)
    
    return operation


@router.delete("/{operation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_operation(
    operation_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Eliminar una operación (solo si no tiene transacciones)."""
    operation = db.query(Operation).filter(Operation.id == operation_id).first()
    
    if not operation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operación no encontrada"
        )
    
    # Verificar que no tenga transacciones
    if db.query(Transaction).filter(Transaction.operation_id == operation_id).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede eliminar una operación con transacciones asociadas"
        )
    
    db.delete(operation)
    db.commit()
