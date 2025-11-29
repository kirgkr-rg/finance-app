from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.models import User, Transaction, Attachment, AccountPermission
from app.auth import get_current_user

router = APIRouter(prefix="/api/attachments", tags=["Adjuntos"])

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def check_transaction_permission(db: Session, user: User, transaction_id: UUID) -> Transaction:
    """Verificar que el usuario tiene acceso a la transacción."""
    transaction = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    
    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transacción no encontrada"
        )
    
    if user.role == "supervisor":
        return transaction
    
    # Verificar permisos en las cuentas de la transacción
    has_permission = False
    if transaction.from_account_id:
        perm = db.query(AccountPermission).filter(
            AccountPermission.user_id == user.id,
            AccountPermission.account_id == transaction.from_account_id,
            AccountPermission.can_view == True
        ).first()
        if perm:
            has_permission = True
    
    if transaction.to_account_id and not has_permission:
        perm = db.query(AccountPermission).filter(
            AccountPermission.user_id == user.id,
            AccountPermission.account_id == transaction.to_account_id,
            AccountPermission.can_view == True
        ).first()
        if perm:
            has_permission = True
    
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para acceder a esta transacción"
        )
    
    return transaction


@router.post("/transaction/{transaction_id}", status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    transaction_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Subir un adjunto a una transacción."""
    transaction = check_transaction_permission(db, current_user, transaction_id)
    
    # Leer contenido del archivo
    content = await file.read()
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El archivo es demasiado grande. Máximo: {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Crear adjunto
    attachment = Attachment(
        transaction_id=transaction.id,
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        file_data=content,
        file_size=len(content),
        uploaded_by=current_user.id
    )
    
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return {
        "id": str(attachment.id),
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "file_size": attachment.file_size,
        "created_at": attachment.created_at
    }


@router.get("/transaction/{transaction_id}")
def list_attachments(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar adjuntos de una transacción."""
    transaction = check_transaction_permission(db, current_user, transaction_id)
    
    attachments = db.query(Attachment).filter(
        Attachment.transaction_id == transaction.id
    ).order_by(Attachment.created_at.desc()).all()
    
    return [
        {
            "id": str(a.id),
            "filename": a.filename,
            "content_type": a.content_type,
            "file_size": a.file_size,
            "created_at": a.created_at
        }
        for a in attachments
    ]


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Descargar un adjunto."""
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adjunto no encontrado"
        )
    
    # Verificar permiso
    check_transaction_permission(db, current_user, attachment.transaction_id)
    
    return Response(
        content=attachment.file_data,
        media_type=attachment.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{attachment.filename}"'
        }
    )


@router.delete("/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(
    attachment_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Eliminar un adjunto."""
    attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Adjunto no encontrado"
        )
    
    # Verificar permiso
    check_transaction_permission(db, current_user, attachment.transaction_id)
    
    # Solo el que subió o supervisor puede eliminar
    if current_user.role != "supervisor" and attachment.uploaded_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes eliminar adjuntos que hayas subido"
        )
    
    db.delete(attachment)
    db.commit()
    
    return None
