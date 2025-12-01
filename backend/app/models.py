from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Numeric, CheckConstraint, Integer, LargeBinary
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.database import Base


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(String(20), default="user")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relaciones
    permissions = relationship("AccountPermission", back_populates="user", foreign_keys="AccountPermission.user_id")
    created_companies = relationship("Company", back_populates="creator")
    
    __table_args__ = (
        CheckConstraint("role IN ('supervisor', 'user', 'demo')", name="valid_role"),
    )


class Group(Base):
    __tablename__ = "groups"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(String)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relaciones
    creator = relationship("User")
    companies = relationship("Company", back_populates="group")


class Company(Base):
    __tablename__ = "companies"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(String)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relaciones
    creator = relationship("User", back_populates="created_companies")
    group = relationship("Group", back_populates="companies")
    accounts = relationship("Account", back_populates="company", cascade="all, delete-orphan")


class Account(Base):
    __tablename__ = "accounts"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    iban = Column(String(34), nullable=True)  # IBAN máximo 34 caracteres
    account_type = Column(String(20), default="corriente")
    balance = Column(Numeric(15, 2), default=0.00)
    credit_limit = Column(Numeric(15, 2), default=0.00)  # Para crédito y confirming
    currency = Column(String(3), default="EUR")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relaciones
    company = relationship("Company", back_populates="accounts")
    permissions = relationship("AccountPermission", back_populates="account", cascade="all, delete-orphan")
    outgoing_transactions = relationship("Transaction", back_populates="from_account", foreign_keys="Transaction.from_account_id")
    incoming_transactions = relationship("Transaction", back_populates="to_account", foreign_keys="Transaction.to_account_id")
    
    @property
    def available(self):
        """Calcula el disponible según el tipo de cuenta."""
        if self.account_type == "corriente":
            return self.balance
        elif self.account_type == "credito":
            # Disponible = límite - saldo usado (balance es negativo o 0)
            return self.credit_limit + self.balance
        elif self.account_type == "confirming":
            # Disponible = concedido - usado (balance es negativo o 0)
            return self.credit_limit + self.balance
        return self.balance
    
    __table_args__ = (
        CheckConstraint("account_type IN ('corriente', 'credito', 'confirming')", name="valid_account_type"),
    )


class AccountPermission(Base):
    __tablename__ = "account_permissions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    can_view = Column(Boolean, default=True)
    can_transfer = Column(Boolean, default=False)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    
    # Relaciones
    user = relationship("User", back_populates="permissions", foreign_keys=[user_id])
    account = relationship("Account", back_populates="permissions")
    granter = relationship("User", foreign_keys=[granted_by])


class Operation(Base):
    __tablename__ = "operations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(String)
    notes = Column(String)  # Notas/observaciones editables
    status = Column(String(20), default="open")
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    closed_at = Column(DateTime, nullable=True)
    
    # Relaciones
    creator = relationship("User")
    transactions = relationship("Transaction", back_populates="operation", order_by="Transaction.created_at")
    
    __table_args__ = (
        CheckConstraint("status IN ('open', 'completed', 'cancelled')", name="valid_operation_status"),
    )


class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    to_account_id = Column(UUID(as_uuid=True), ForeignKey("accounts.id"))
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(String)
    transaction_type = Column(String(30))
    status = Column(String(20), default="completed")
    operation_id = Column(UUID(as_uuid=True), ForeignKey("operations.id"), nullable=True)
    from_balance_after = Column(Numeric(15, 2), nullable=True)
    to_balance_after = Column(Numeric(15, 2), nullable=True)
    transaction_date = Column(DateTime, server_default=func.now())  # Fecha del movimiento (editable)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())  # Fecha de registro (automática)
    
    # Relaciones
    from_account = relationship("Account", back_populates="outgoing_transactions", foreign_keys=[from_account_id])
    to_account = relationship("Account", back_populates="incoming_transactions", foreign_keys=[to_account_id])
    operation = relationship("Operation", back_populates="transactions")
    creator = relationship("User")
    attachments = relationship("Attachment", back_populates="transaction", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_amount"),
        CheckConstraint("transaction_type IN ('transfer', 'deposit', 'withdrawal', 'confirming_settlement')", name="valid_transaction_type"),
        CheckConstraint("status IN ('pending', 'completed', 'failed', 'cancelled')", name="valid_status"),
    )


class Attachment(Base):
    __tablename__ = "attachments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    transaction_id = Column(UUID(as_uuid=True), ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    file_data = Column(LargeBinary, nullable=False)  # Archivo en binario
    file_size = Column(Integer, nullable=False)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    
    # Relaciones
    transaction = relationship("Transaction", back_populates="attachments")
    uploader = relationship("User")


class PendingEntry(Base):
    """Apuntes pendientes entre grupos (deudas/créditos no bancarios)."""
    __tablename__ = "pending_entries"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)  # Grupo deudor
    to_group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)    # Grupo acreedor
    amount = Column(Numeric(15, 2), nullable=False)
    description = Column(String(500))
    operation_id = Column(UUID(as_uuid=True), ForeignKey("operations.id"), nullable=True)  # Operación donde se creó
    settled_in_operation_id = Column(UUID(as_uuid=True), ForeignKey("operations.id"), nullable=True)  # Operación donde se liquidó
    status = Column(String(20), default="pending")  # pending, settled
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    settled_at = Column(DateTime, nullable=True)
    
    # Relaciones
    from_group = relationship("Group", foreign_keys=[from_group_id])
    to_group = relationship("Group", foreign_keys=[to_group_id])
    operation = relationship("Operation", foreign_keys=[operation_id])
    settled_in_operation = relationship("Operation", foreign_keys=[settled_in_operation_id])
    creator = relationship("User")
    
    __table_args__ = (
        CheckConstraint("amount > 0", name="positive_pending_amount"),
        CheckConstraint("status IN ('pending', 'settled')", name="valid_pending_status"),
    )
