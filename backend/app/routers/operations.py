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
        notes=operation_data.notes,
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
        new_status = update_data["status"]
        if new_status in ["completed", "cancelled"] and operation.status == "open":
            operation.closed_at = datetime.utcnow()
            
            # Si se cancela, desasignar todas las transacciones
            if new_status == "cancelled":
                db.query(Transaction).filter(
                    Transaction.operation_id == operation_id
                ).update({"operation_id": None})
                
        elif new_status == "open":
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
    """Eliminar una operación y desasignar sus transacciones."""
    operation = db.query(Operation).filter(Operation.id == operation_id).first()
    
    if not operation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Operación no encontrada"
        )
    
    # Desasignar transacciones
    db.query(Transaction).filter(
        Transaction.operation_id == operation_id
    ).update({"operation_id": None})
    
    db.delete(operation)
    db.commit()


@router.get("/summary/groups-balance")
def get_groups_balance(
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Obtener el balance neto entre grupos de todas las operaciones."""
    from app.models import Company, Group
    
    # Obtener todas las transacciones de tipo transfer que tienen operación
    transactions = db.query(Transaction).filter(
        Transaction.transaction_type == "transfer",
        Transaction.from_account_id.isnot(None),
        Transaction.to_account_id.isnot(None)
    ).options(
        joinedload(Transaction.from_account).joinedload(Account.company).joinedload(Company.group),
        joinedload(Transaction.to_account).joinedload(Account.company).joinedload(Company.group)
    ).all()
    
    # Calcular balance entre grupos
    # Positivo = el grupo ha recibido más de lo que ha enviado
    group_balances = defaultdict(lambda: Decimal("0"))
    group_names = {}
    
    for tx in transactions:
        from_company = tx.from_account.company
        to_company = tx.to_account.company
        
        from_group_id = from_company.group_id
        to_group_id = to_company.group_id
        
        # Solo contar si son grupos diferentes
        if from_group_id != to_group_id:
            # El grupo origen pierde, el destino gana
            if from_group_id:
                group_balances[str(from_group_id)] -= tx.amount
                if from_company.group:
                    group_names[str(from_group_id)] = from_company.group.name
            
            if to_group_id:
                group_balances[str(to_group_id)] += tx.amount
                if to_company.group:
                    group_names[str(to_group_id)] = to_company.group.name
    
    # Convertir a lista
    result = [
        {
            "group_id": group_id,
            "group_name": group_names.get(group_id, "Sin grupo"),
            "balance": float(balance)
        }
        for group_id, balance in group_balances.items()
        if balance != 0  # Solo mostrar grupos con balance != 0
    ]
    
    # Ordenar por balance descendente
    result.sort(key=lambda x: x["balance"], reverse=True)
    
    return result


@router.get("/summary/dashboard")
def get_operations_dashboard(
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Obtener resumen de operaciones para el dashboard."""
    # Operaciones abiertas
    open_operations = db.query(Operation).filter(
        Operation.status == "open"
    ).order_by(Operation.created_at.desc()).all()
    
    # Últimas operaciones (todas)
    recent_operations = db.query(Operation).order_by(
        Operation.updated_at.desc()
    ).limit(10).all()
    
    # Contar por estado
    total_open = db.query(Operation).filter(Operation.status == "open").count()
    total_completed = db.query(Operation).filter(Operation.status == "completed").count()
    total_cancelled = db.query(Operation).filter(Operation.status == "cancelled").count()
    
    return {
        "open_operations": [
            {
                "id": str(op.id),
                "name": op.name,
                "description": op.description,
                "created_at": op.created_at,
                "transaction_count": len(op.transactions)
            }
            for op in open_operations
        ],
        "recent_operations": [
            {
                "id": str(op.id),
                "name": op.name,
                "status": op.status,
                "updated_at": op.updated_at,
                "closed_at": op.closed_at
            }
            for op in recent_operations
        ],
        "counts": {
            "open": total_open,
            "completed": total_completed,
            "cancelled": total_cancelled
        }
    }
