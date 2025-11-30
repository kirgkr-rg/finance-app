from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


# ============ USER SCHEMAS ============

class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str
    role: str = "user"


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None


class UserResponse(UserBase):
    id: UUID
    role: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[UUID] = None


# ============ GROUP SCHEMAS ============

class GroupBase(BaseModel):
    name: str
    description: Optional[str] = None


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class GroupResponse(GroupBase):
    id: UUID
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============ COMPANY SCHEMAS ============

class CompanyBase(BaseModel):
    name: str
    description: Optional[str] = None
    group_id: Optional[UUID] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    group_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class CompanyResponse(CompanyBase):
    id: UUID
    created_by: Optional[UUID]
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class CompanyWithGroup(CompanyResponse):
    group: Optional[GroupResponse] = None


class CompanyWithAccounts(CompanyResponse):
    accounts: List["AccountResponse"] = []


# ============ ACCOUNT SCHEMAS ============

class AccountBase(BaseModel):
    name: str
    account_type: str = "corriente"
    currency: str = "EUR"


class AccountCreate(AccountBase):
    company_id: UUID
    initial_balance: Decimal = Decimal("0.00")
    credit_limit: Decimal = Decimal("0.00")
    initial_available: Optional[Decimal] = None  # Para confirming/crédito


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    initial_available: Optional[Decimal] = None  # Para ajustar el disponible
    is_active: Optional[bool] = None


class AccountResponse(AccountBase):
    id: UUID
    company_id: UUID
    balance: Decimal
    credit_limit: Decimal
    available: Decimal
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class AccountWithCompany(AccountResponse):
    company: CompanyResponse


# ============ PERMISSION SCHEMAS ============

class PermissionBase(BaseModel):
    can_view: bool = True
    can_transfer: bool = False


class PermissionCreate(PermissionBase):
    user_id: UUID
    account_id: UUID


class PermissionUpdate(BaseModel):
    can_view: Optional[bool] = None
    can_transfer: Optional[bool] = None


class PermissionResponse(PermissionBase):
    id: UUID
    user_id: UUID
    account_id: UUID
    granted_by: Optional[UUID]
    created_at: datetime
    
    class Config:
        from_attributes = True


class PermissionWithDetails(PermissionResponse):
    user: UserResponse
    account: AccountWithCompany


# ============ OPERATION SCHEMAS ============

class OperationBase(BaseModel):
    name: str
    description: Optional[str] = None
    notes: Optional[str] = None


class OperationCreate(OperationBase):
    pass


class OperationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class OperationResponse(OperationBase):
    id: UUID
    status: str
    created_by: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class OperationFlowNode(BaseModel):
    company_id: UUID
    company_name: str
    total_in: Decimal
    total_out: Decimal


class OperationFlowEdge(BaseModel):
    from_company_id: UUID
    from_company_name: str
    to_company_id: UUID
    to_company_name: str
    amount: Decimal
    transaction_id: UUID
    created_at: datetime


class OperationGroupNode(BaseModel):
    group_id: Optional[UUID]
    group_name: str
    total_in: Decimal
    total_out: Decimal


class OperationFlowMap(BaseModel):
    operation: OperationResponse
    nodes: List[OperationFlowNode]
    edges: List[OperationFlowEdge]
    group_nodes: List[OperationGroupNode] = []


# ============ TRANSACTION SCHEMAS ============

class TransactionBase(BaseModel):
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class TransferCreate(TransactionBase):
    from_account_id: UUID
    to_account_id: UUID
    operation_id: Optional[UUID] = None


class DepositCreate(TransactionBase):
    to_account_id: UUID


class WithdrawalCreate(TransactionBase):
    from_account_id: UUID


class ConfirmingSettlementCreate(BaseModel):
    """Liquidación de vencimiento de confirming."""
    confirming_account_id: UUID  # Cuenta confirming a regenerar
    charge_account_id: UUID      # Cuenta corriente de donde se cobra
    amount: Decimal = Field(..., gt=0)
    description: Optional[str] = None


class TransactionResponse(TransactionBase):
    id: UUID
    from_account_id: Optional[UUID]
    to_account_id: Optional[UUID]
    transaction_type: str
    status: str
    operation_id: Optional[UUID] = None
    from_balance_after: Optional[Decimal] = None
    to_balance_after: Optional[Decimal] = None
    created_by: Optional[UUID]
    created_at: datetime
    
    class Config:
        from_attributes = True


class TransactionWithAccounts(TransactionResponse):
    from_account: Optional[AccountWithCompany] = None
    to_account: Optional[AccountWithCompany] = None


class OperationWithTransactions(OperationResponse):
    transactions: List[TransactionWithAccounts] = []


# ============ DASHBOARD SCHEMAS ============

class AccountSummary(BaseModel):
    account: AccountWithCompany
    recent_transactions: List[TransactionResponse]


class DashboardData(BaseModel):
    total_balance: Decimal
    accounts: List[AccountSummary]
    recent_transactions: List[TransactionWithAccounts]


# Actualizar referencias circulares
CompanyWithAccounts.model_rebuild()
