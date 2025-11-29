"""
Script para inicializar la base de datos con datos de prueba.
Ejecutar después de levantar el servidor al menos una vez.
"""
import sys
sys.path.insert(0, '.')

from app.database import SessionLocal, engine
from app.models import Base, User, Company, Account, AccountPermission, Transaction
from app.auth import get_password_hash
from decimal import Decimal

def init_db():
    # Crear tablas
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        # Verificar si ya hay datos
        if db.query(User).first():
            print("La base de datos ya tiene datos. Saltando inicialización.")
            return
        
        print("Inicializando base de datos con datos de prueba...")
        
        # Crear usuario supervisor
        supervisor = User(
            email="admin@example.com",
            password_hash=get_password_hash("admin123"),
            full_name="Administrador",
            role="supervisor"
        )
        db.add(supervisor)
        db.flush()
        
        # Crear usuarios normales
        user1 = User(
            email="juan@example.com",
            password_hash=get_password_hash("user123"),
            full_name="Juan García",
            role="user"
        )
        user2 = User(
            email="maria@example.com",
            password_hash=get_password_hash("user123"),
            full_name="María López",
            role="user"
        )
        db.add_all([user1, user2])
        db.flush()
        
        # Crear empresas
        company1 = Company(
            name="Restaurante El Sol",
            description="Restaurante de comida mediterránea",
            created_by=supervisor.id
        )
        company2 = Company(
            name="Café Luna",
            description="Cafetería y pastelería",
            created_by=supervisor.id
        )
        company3 = Company(
            name="Tech Solutions SL",
            description="Consultoría tecnológica",
            created_by=supervisor.id
        )
        db.add_all([company1, company2, company3])
        db.flush()
        
        # Crear cuentas
        account1 = Account(
            company_id=company1.id,
            name="Cuenta Principal",
            balance=Decimal("15000.00"),
            currency="EUR"
        )
        account2 = Account(
            company_id=company1.id,
            name="Cuenta Nóminas",
            balance=Decimal("5000.00"),
            currency="EUR"
        )
        account3 = Account(
            company_id=company2.id,
            name="Cuenta Operativa",
            balance=Decimal("8500.00"),
            currency="EUR"
        )
        account4 = Account(
            company_id=company3.id,
            name="Cuenta Principal",
            balance=Decimal("25000.00"),
            currency="EUR"
        )
        account5 = Account(
            company_id=company3.id,
            name="Cuenta Inversiones",
            balance=Decimal("50000.00"),
            currency="EUR"
        )
        db.add_all([account1, account2, account3, account4, account5])
        db.flush()
        
        # Asignar permisos
        # Juan puede ver y transferir en Restaurante El Sol
        perm1 = AccountPermission(
            user_id=user1.id,
            account_id=account1.id,
            can_view=True,
            can_transfer=True,
            granted_by=supervisor.id
        )
        perm2 = AccountPermission(
            user_id=user1.id,
            account_id=account2.id,
            can_view=True,
            can_transfer=False,
            granted_by=supervisor.id
        )
        # Juan también puede ver Café Luna
        perm3 = AccountPermission(
            user_id=user1.id,
            account_id=account3.id,
            can_view=True,
            can_transfer=True,
            granted_by=supervisor.id
        )
        
        # María puede ver Tech Solutions
        perm4 = AccountPermission(
            user_id=user2.id,
            account_id=account4.id,
            can_view=True,
            can_transfer=True,
            granted_by=supervisor.id
        )
        perm5 = AccountPermission(
            user_id=user2.id,
            account_id=account5.id,
            can_view=True,
            can_transfer=False,
            granted_by=supervisor.id
        )
        
        db.add_all([perm1, perm2, perm3, perm4, perm5])
        db.flush()
        
        # Crear algunas transacciones de ejemplo
        tx1 = Transaction(
            from_account_id=account1.id,
            to_account_id=account2.id,
            amount=Decimal("2000.00"),
            description="Transferencia para nóminas",
            transaction_type="transfer",
            status="completed",
            created_by=supervisor.id
        )
        tx2 = Transaction(
            to_account_id=account1.id,
            amount=Decimal("5000.00"),
            description="Depósito inicial",
            transaction_type="deposit",
            status="completed",
            created_by=supervisor.id
        )
        tx3 = Transaction(
            from_account_id=account4.id,
            to_account_id=account3.id,
            amount=Decimal("1500.00"),
            description="Pago servicios",
            transaction_type="transfer",
            status="completed",
            created_by=supervisor.id
        )
        
        db.add_all([tx1, tx2, tx3])
        
        db.commit()
        
        print("\n✅ Base de datos inicializada correctamente!")
        print("\n📧 Usuarios creados:")
        print("  - admin@example.com / admin123 (Supervisor)")
        print("  - juan@example.com / user123 (Usuario)")
        print("  - maria@example.com / user123 (Usuario)")
        print("\n🏢 Empresas creadas:")
        print("  - Restaurante El Sol (2 cuentas)")
        print("  - Café Luna (1 cuenta)")
        print("  - Tech Solutions SL (2 cuentas)")
        print("\n🔐 Permisos:")
        print("  - Juan: acceso a Restaurante El Sol y Café Luna")
        print("  - María: acceso a Tech Solutions SL")
        
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
