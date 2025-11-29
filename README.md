# Finance App - Sistema de Gestión Financiera

Aplicación web para gestionar el saldo y operaciones de envío y recepción de dinero entre empresas y cuentas.

## Características

- **Múltiples usuarios** con autenticación JWT
- **Rol Supervisor**: acceso total al sistema
- **Rol Usuario**: acceso solo a cuentas autorizadas
- **Empresas**: cada usuario puede tener acceso a múltiples empresas
- **Cuentas**: cada empresa puede tener múltiples cuentas
- **Transacciones**: transferencias entre cuentas, depósitos y retiros
- **Permisos granulares**: control de acceso a nivel de cuenta

## Requisitos

- Python 3.10+
- PostgreSQL 14+
- Node.js 18+
- npm

## Instalación

### 1. Base de Datos

```bash
# Crear base de datos PostgreSQL
sudo -u postgres psql
CREATE DATABASE finance_app;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE finance_app TO postgres;
\q
```

### 2. Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac
# o en Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno (opcional)
# Crear archivo .env con:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finance_app
# SECRET_KEY=tu-clave-secreta

# Ejecutar el servidor
uvicorn app.main:app --reload --port 8000
```

El servidor estará en: http://localhost:8000
Documentación API: http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo
npm run dev
```

La aplicación estará en: http://localhost:5173

## Primeros Pasos

1. **Crear usuario supervisor**:
   - Ir a http://localhost:5173/register
   - Registrar un usuario
   - En la base de datos, cambiar su rol a 'supervisor':
     ```sql
     UPDATE users SET role = 'supervisor' WHERE email = 'tu@email.com';
     ```

2. **Como supervisor puedes**:
   - Crear empresas
   - Crear cuentas en las empresas
   - Crear usuarios
   - Asignar permisos a usuarios para ver/transferir en cuentas específicas
   - Realizar depósitos y retiros

3. **Como usuario normal puedes**:
   - Ver solo las cuentas a las que tienes permiso
   - Realizar transferencias (si tienes permiso de transferencia)
   - Ver el historial de transacciones de tus cuentas

## Estructura del Proyecto

```
finance-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # Aplicación FastAPI
│   │   ├── config.py        # Configuración
│   │   ├── database.py      # Conexión BD
│   │   ├── models.py        # Modelos SQLAlchemy
│   │   ├── schemas.py       # Esquemas Pydantic
│   │   ├── auth.py          # Autenticación JWT
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── companies.py
│   │       ├── accounts.py
│   │       ├── permissions.py
│   │       └── transactions.py
│   ├── schema.sql           # Esquema de BD
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   └── Layout.jsx
    │   ├── context/
    │   │   └── AuthContext.jsx
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Companies.jsx
    │   │   ├── Accounts.jsx
    │   │   ├── Transactions.jsx
    │   │   ├── Users.jsx
    │   │   └── Permissions.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   └── index.css
    └── package.json
```

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/me` - Usuario actual

### Usuarios (Supervisor)
- `GET /api/users/` - Listar usuarios
- `GET /api/users/{id}` - Obtener usuario
- `PATCH /api/users/{id}` - Actualizar usuario
- `DELETE /api/users/{id}` - Desactivar usuario

### Empresas
- `GET /api/companies/` - Listar empresas
- `POST /api/companies/` - Crear empresa (Supervisor)
- `GET /api/companies/{id}` - Obtener empresa
- `PATCH /api/companies/{id}` - Actualizar empresa (Supervisor)
- `DELETE /api/companies/{id}` - Desactivar empresa (Supervisor)

### Cuentas
- `GET /api/accounts/` - Listar cuentas
- `POST /api/accounts/` - Crear cuenta (Supervisor)
- `GET /api/accounts/{id}` - Obtener cuenta
- `PATCH /api/accounts/{id}` - Actualizar cuenta (Supervisor)
- `DELETE /api/accounts/{id}` - Desactivar cuenta (Supervisor)

### Permisos (Supervisor)
- `GET /api/permissions/` - Listar permisos
- `POST /api/permissions/` - Asignar permiso
- `PATCH /api/permissions/{id}` - Actualizar permiso
- `DELETE /api/permissions/{id}` - Eliminar permiso

### Transacciones
- `GET /api/transactions/` - Listar transacciones
- `POST /api/transactions/transfer` - Transferencia
- `POST /api/transactions/deposit` - Depósito (Supervisor)
- `POST /api/transactions/withdrawal` - Retiro (Supervisor)
- `GET /api/transactions/{id}` - Obtener transacción

## Tecnologías

**Backend:**
- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT (python-jose)
- Pydantic

**Frontend:**
- React 18
- React Router
- Axios
- Lucide Icons
- Vite
