from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from collections import defaultdict

from app.database import get_db
from app.models import User, PendingEntry, Group, Operation
from app.schemas import PendingEntryCreate, PendingEntryResponse, GroupBalanceSummary
from app.auth import get_current_user, get_current_supervisor

router = APIRouter(prefix="/api/pending-entries", tags=["Apuntes Pendientes"])


@router.post("/", response_model=PendingEntryResponse, status_code=status.HTTP_201_CREATED)
def create_pending_entry(
    entry_data: PendingEntryCreate,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Crear un nuevo apunte pendiente (deuda entre grupos)."""
    # Verificar que los grupos existen
    from_group = db.query(Group).filter(Group.id == entry_data.from_group_id).first()
    to_group = db.query(Group).filter(Group.id == entry_data.to_group_id).first()
    
    if not from_group:
        raise HTTPException(status_code=404, detail="Grupo deudor no encontrado")
    if not to_group:
        raise HTTPException(status_code=404, detail="Grupo acreedor no encontrado")
    
    if entry_data.from_group_id == entry_data.to_group_id:
        raise HTTPException(status_code=400, detail="Los grupos deben ser diferentes")
    
    # Verificar operación si se proporciona
    if entry_data.operation_id:
        operation = db.query(Operation).filter(Operation.id == entry_data.operation_id).first()
        if not operation:
            raise HTTPException(status_code=404, detail="Operación no encontrada")
    
    entry = PendingEntry(
        from_group_id=entry_data.from_group_id,
        to_group_id=entry_data.to_group_id,
        amount=entry_data.amount,
        description=entry_data.description,
        operation_id=entry_data.operation_id,
        status="pending",
        created_by=current_user.id
    )
    
    db.add(entry)
    db.commit()
    db.refresh(entry)
    
    return _entry_to_response(entry, db)


@router.get("/", response_model=List[PendingEntryResponse])
def list_pending_entries(
    status: str = None,
    group_id: UUID = None,
    operation_id: UUID = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar apuntes pendientes con filtros opcionales."""
    query = db.query(PendingEntry).order_by(PendingEntry.created_at.desc())
    
    if status:
        query = query.filter(PendingEntry.status == status)
    
    if group_id:
        query = query.filter(
            or_(
                PendingEntry.from_group_id == group_id,
                PendingEntry.to_group_id == group_id
            )
        )
    
    if operation_id:
        query = query.filter(
            or_(
                PendingEntry.operation_id == operation_id,
                PendingEntry.settled_in_operation_id == operation_id
            )
        )
    
    entries = query.all()
    return [_entry_to_response(e, db) for e in entries]


@router.get("/pending", response_model=List[PendingEntryResponse])
def list_only_pending(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar solo apuntes pendientes (no liquidados)."""
    entries = db.query(PendingEntry).filter(
        PendingEntry.status == "pending"
    ).order_by(PendingEntry.created_at.desc()).all()
    
    return [_entry_to_response(e, db) for e in entries]


@router.post("/{entry_id}/settle")
def settle_pending_entry(
    entry_id: UUID,
    operation_id: UUID = None,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Liquidar un apunte pendiente."""
    entry = db.query(PendingEntry).filter(PendingEntry.id == entry_id).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Apunte no encontrado")
    
    if entry.status == "settled":
        raise HTTPException(status_code=400, detail="El apunte ya está liquidado")
    
    # Verificar operación si se proporciona
    if operation_id:
        operation = db.query(Operation).filter(Operation.id == operation_id).first()
        if not operation:
            raise HTTPException(status_code=404, detail="Operación no encontrada")
    
    entry.status = "settled"
    entry.settled_at = datetime.utcnow()
    entry.settled_in_operation_id = operation_id
    
    db.commit()
    
    return {"message": "Apunte liquidado correctamente"}


@router.post("/{entry_id}/unsettle")
def unsettle_pending_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Revertir la liquidación de un apunte."""
    entry = db.query(PendingEntry).filter(PendingEntry.id == entry_id).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Apunte no encontrado")
    
    if entry.status == "pending":
        raise HTTPException(status_code=400, detail="El apunte no está liquidado")
    
    entry.status = "pending"
    entry.settled_at = None
    entry.settled_in_operation_id = None
    
    db.commit()
    
    return {"message": "Liquidación revertida correctamente"}


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_pending_entry(
    entry_id: UUID,
    current_user: User = Depends(get_current_supervisor),
    db: Session = Depends(get_db)
):
    """Eliminar un apunte pendiente."""
    entry = db.query(PendingEntry).filter(PendingEntry.id == entry_id).first()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Apunte no encontrado")
    
    db.delete(entry)
    db.commit()


@router.get("/summary/groups", response_model=List[GroupBalanceSummary])
def get_groups_pending_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener resumen de saldos pendientes entre grupos."""
    # Solo apuntes pendientes
    entries = db.query(PendingEntry).filter(PendingEntry.status == "pending").all()
    
    # Calcular lo que debe y lo que le deben a cada grupo
    owes = defaultdict(Decimal)  # Lo que debe cada grupo
    owed = defaultdict(Decimal)  # Lo que le deben a cada grupo
    group_names = {}
    
    for entry in entries:
        from_group = db.query(Group).filter(Group.id == entry.from_group_id).first()
        to_group = db.query(Group).filter(Group.id == entry.to_group_id).first()
        
        if from_group:
            owes[str(entry.from_group_id)] += entry.amount
            group_names[str(entry.from_group_id)] = from_group.name
        
        if to_group:
            owed[str(entry.to_group_id)] += entry.amount
            group_names[str(entry.to_group_id)] = to_group.name
    
    # Construir resumen
    all_group_ids = set(owes.keys()) | set(owed.keys())
    
    result = []
    for group_id in all_group_ids:
        group_owes = owes.get(group_id, Decimal("0"))
        group_owed = owed.get(group_id, Decimal("0"))
        
        result.append(GroupBalanceSummary(
            group_id=UUID(group_id),
            group_name=group_names.get(group_id, "Desconocido"),
            owes=group_owes,
            owed=group_owed,
            net=group_owed - group_owes  # Positivo = le deben, Negativo = debe
        ))
    
    # Ordenar por saldo neto
    result.sort(key=lambda x: x.net, reverse=True)
    
    return result


def _entry_to_response(entry: PendingEntry, db: Session) -> PendingEntryResponse:
    """Convertir PendingEntry a PendingEntryResponse con nombres de grupos."""
    from_group = db.query(Group).filter(Group.id == entry.from_group_id).first()
    to_group = db.query(Group).filter(Group.id == entry.to_group_id).first()
    
    return PendingEntryResponse(
        id=entry.id,
        from_group_id=entry.from_group_id,
        from_group_name=from_group.name if from_group else None,
        to_group_id=entry.to_group_id,
        to_group_name=to_group.name if to_group else None,
        amount=entry.amount,
        description=entry.description,
        operation_id=entry.operation_id,
        settled_in_operation_id=entry.settled_in_operation_id,
        status=entry.status,
        created_at=entry.created_at,
        settled_at=entry.settled_at
    )
