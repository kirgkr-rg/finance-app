from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from collections import defaultdict

from app.database import get_db
from app.models import User, Operation, Transaction, Account, AccountPermission
from app.schemas import (
    OperationCreate, OperationUpdate, OperationResponse,
    OperationWithTransactions, OperationFlowMap, OperationFlowNode, OperationFlowEdge,
    OperationGroupNode
)
from app.auth import get_current_user, get_current_supervisor

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


def get_user_permitted_account_ids(db: Session, user: User) -> List[UUID]:
    """Obtener IDs de cuentas a las que el usuario tiene acceso."""
    if user.role == "supervisor":
        return None  # None significa todas
    
    return [p.account_id for p in db.query(AccountPermission).filter(
        AccountPermission.user_id == user.id,
        AccountPermission.can_view == True
    ).all()]


def get_user_operation_ids(db: Session, user: User) -> List[UUID]:
    """Obtener IDs de operaciones que involucran cuentas del usuario."""
    permitted_account_ids = get_user_permitted_account_ids(db, user)
    
    if permitted_account_ids is None:
        return None  # Supervisor ve todas
    
    # Buscar operaciones con transacciones en cuentas permitidas
    operation_ids = db.query(Transaction.operation_id).filter(
        Transaction.operation_id != None,
        or_(
            Transaction.from_account_id.in_(permitted_account_ids),
            Transaction.to_account_id.in_(permitted_account_ids)
        )
    ).distinct().all()
    
    return [op_id[0] for op_id in operation_ids]


@router.get("/", response_model=List[OperationResponse])
def list_operations(
    status: str = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar operaciones. Supervisores ven todas, usuarios solo las de sus cuentas."""
    query = db.query(Operation).order_by(Operation.created_at.desc())
    
    if current_user.role != "supervisor":
        operation_ids = get_user_operation_ids(db, current_user)
        if operation_ids:
            query = query.filter(Operation.id.in_(operation_ids))
        else:
            return []  # No tiene operaciones
    
    if status:
        query = query.filter(Operation.status == status)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{operation_id}", response_model=OperationWithTransactions)
def get_operation(
    operation_id: UUID,
    current_user: User = Depends(get_current_user),
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
    
    # Verificar acceso para usuarios normales
    if current_user.role != "supervisor":
        operation_ids = get_user_operation_ids(db, current_user)
        if not operation_ids or operation_id not in operation_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta operación"
            )
    
    return operation


@router.get("/{operation_id}/flow", response_model=OperationFlowMap)
def get_operation_flow(
    operation_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener el mapa de flujo de una operación."""
    from app.models import Company, PendingEntry, Group
    from app.schemas import PendingEntryEdge
    
    # Verificar acceso para usuarios normales
    if current_user.role != "supervisor":
        operation_ids = get_user_operation_ids(db, current_user)
        if not operation_ids or operation_id not in operation_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver esta operación"
            )
    
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
    
    # Obtener apuntes pendientes de esta operación
    pending_entries = db.query(PendingEntry).filter(
        or_(
            PendingEntry.operation_id == operation_id,
            PendingEntry.settled_in_operation_id == operation_id
        )
    ).all()
    
    pending_edges = []
    pending_by_group = defaultdict(lambda: {"in": Decimal("0"), "out": Decimal("0")})
    
    for entry in pending_entries:
        from_group = db.query(Group).filter(Group.id == entry.from_group_id).first()
        to_group = db.query(Group).filter(Group.id == entry.to_group_id).first()
        
        pending_edges.append(PendingEntryEdge(
            from_group_id=entry.from_group_id,
            from_group_name=from_group.name if from_group else "Desconocido",
            to_group_id=entry.to_group_id,
            to_group_name=to_group.name if to_group else "Desconocido",
            amount=entry.amount,
            description=entry.description,
            entry_id=entry.id,
            status=entry.status,
            created_at=entry.created_at
        ))
        
        # Acumular por grupo para el resumen
        # El deudor (from) tiene ese dinero (+), el acreedor (to) le falta (-)
        pending_by_group[str(entry.from_group_id)]["in"] += entry.amount  # Deudor: tiene el dinero
        pending_by_group[str(entry.to_group_id)]["out"] += entry.amount   # Acreedor: le falta
    
    # Calcular resumen por grupos (transacciones + apuntes)
    group_flows = defaultdict(lambda: {"in": Decimal("0"), "out": Decimal("0"), "name": "", "pending_in": Decimal("0"), "pending_out": Decimal("0")})
    
    for company_id, data in company_flows.items():
        group_key = str(data["group_id"]) if data["group_id"] else "sin_grupo"
        group_flows[group_key]["in"] += data["in"]
        group_flows[group_key]["out"] += data["out"]
        group_flows[group_key]["name"] = data["group_name"]
    
    # Añadir apuntes pendientes al resumen de grupos
    for group_id, pending_data in pending_by_group.items():
        if group_id in group_flows:
            group_flows[group_id]["pending_in"] = pending_data["in"]
            group_flows[group_id]["pending_out"] = pending_data["out"]
        else:
            # El grupo solo tiene apuntes, no transacciones
            group = db.query(Group).filter(Group.id == group_id).first()
            group_flows[group_id]["name"] = group.name if group else "Desconocido"
            group_flows[group_id]["pending_in"] = pending_data["in"]
            group_flows[group_id]["pending_out"] = pending_data["out"]
    
    group_nodes = [
        OperationGroupNode(
            group_id=UUID(group_id) if group_id != "sin_grupo" else None,
            group_name=data["name"],
            total_in=data["in"],
            total_out=data["out"],
            pending_in=data["pending_in"],
            pending_out=data["pending_out"]
        )
        for group_id, data in group_flows.items()
    ]
    
    return OperationFlowMap(
        operation=operation,
        nodes=nodes,
        edges=edges,
        group_nodes=group_nodes,
        pending_edges=pending_edges
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener el balance neto entre grupos de todas las operaciones (transacciones + apuntes)."""
    from app.models import Company, Group, PendingEntry
    
    # Obtener todas las transacciones de tipo transfer que tienen operación
    query = db.query(Transaction).filter(
        Transaction.transaction_type == "transfer",
        Transaction.from_account_id.isnot(None),
        Transaction.to_account_id.isnot(None)
    ).options(
        joinedload(Transaction.from_account).joinedload(Account.company).joinedload(Company.group),
        joinedload(Transaction.to_account).joinedload(Account.company).joinedload(Company.group)
    )
    
    # Filtrar por cuentas del usuario si no es supervisor
    if current_user.role != "supervisor":
        permitted_account_ids = get_user_permitted_account_ids(db, current_user)
        if not permitted_account_ids:
            return []
        query = query.filter(
            or_(
                Transaction.from_account_id.in_(permitted_account_ids),
                Transaction.to_account_id.in_(permitted_account_ids)
            )
        )
    
    transactions = query.all()
    
    # Calcular balance entre grupos por transacciones
    # Positivo = el grupo ha recibido más de lo que ha enviado
    group_balances = defaultdict(lambda: {"transfers": Decimal("0"), "pending": Decimal("0")})
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
                group_balances[str(from_group_id)]["transfers"] -= tx.amount
                if from_company.group:
                    group_names[str(from_group_id)] = from_company.group.name
            
            if to_group_id:
                group_balances[str(to_group_id)]["transfers"] += tx.amount
                if to_company.group:
                    group_names[str(to_group_id)] = to_company.group.name
    
    # Añadir apuntes pendientes (solo los pendientes)
    pending_entries = db.query(PendingEntry).filter(PendingEntry.status == "pending").all()
    
    for entry in pending_entries:
        from_group = db.query(Group).filter(Group.id == entry.from_group_id).first()
        to_group = db.query(Group).filter(Group.id == entry.to_group_id).first()
        
        # El grupo deudor (from) tiene ese dinero (+), el acreedor (to) le falta (-)
        group_balances[str(entry.from_group_id)]["pending"] += entry.amount
        group_balances[str(entry.to_group_id)]["pending"] -= entry.amount
        
        if from_group:
            group_names[str(entry.from_group_id)] = from_group.name
        if to_group:
            group_names[str(entry.to_group_id)] = to_group.name
    
    # Convertir a lista con balance total
    result = []
    for group_id, balances in group_balances.items():
        total = balances["transfers"] + balances["pending"]
        if total != 0 or balances["pending"] != 0:  # Mostrar si hay balance o apuntes pendientes
            result.append({
                "group_id": group_id,
                "group_name": group_names.get(group_id, "Sin grupo"),
                "balance": float(total),
                "transfers_balance": float(balances["transfers"]),
                "pending_balance": float(balances["pending"])
            })
    
    # Ordenar por balance descendente
    result.sort(key=lambda x: x["balance"], reverse=True)
    
    return result


@router.get("/summary/dashboard")
def get_operations_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener resumen de operaciones para el dashboard."""
    # Filtrar por operaciones del usuario si no es supervisor
    base_query = db.query(Operation)
    
    if current_user.role != "supervisor":
        operation_ids = get_user_operation_ids(db, current_user)
        if not operation_ids:
            return {
                "open_operations": [],
                "recent_operations": [],
                "counts": {"open": 0, "completed": 0, "cancelled": 0}
            }
        base_query = base_query.filter(Operation.id.in_(operation_ids))
    
    # Operaciones abiertas
    open_operations = base_query.filter(
        Operation.status == "open"
    ).order_by(Operation.created_at.desc()).all()
    
    # Últimas operaciones (todas del usuario)
    recent_operations = base_query.order_by(
        Operation.updated_at.desc()
    ).limit(10).all()
    
    # Contar por estado
    total_open = base_query.filter(Operation.status == "open").count()
    total_completed = base_query.filter(Operation.status == "completed").count()
    total_cancelled = base_query.filter(Operation.status == "cancelled").count()
    
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
