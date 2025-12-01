import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  FolderTree,
  ArrowRight,
  Eye
} from 'lucide-react';

const Dashboard = () => {
  const { user, isSupervisor } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [operationsSummary, setOperationsSummary] = useState(null);
  const [groupsBalance, setGroupsBalance] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Todos los usuarios ven el dashboard (filtrado por backend)
      const [summaryRes, balanceRes] = await Promise.all([
        api.get('/operations/summary/dashboard'),
        api.get('/operations/summary/groups-balance')
      ]);
      setOperationsSummary(summaryRes.data);
      setGroupsBalance(balanceRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green" size={18} />;
      case 'cancelled':
        return <XCircle className="text-red" size={18} />;
      default:
        return <Clock className="text-yellow" size={18} />;
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed':
        return 'Completada';
      case 'cancelled':
        return 'Cancelada';
      default:
        return 'Abierta';
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <RefreshCw className="spin" size={48} />
        <p>Cargando...</p>
      </div>
    );
  }

  // Si no hay datos de operaciones
  if (!operationsSummary) {
    return (
      <div className="dashboard">
        <header className="page-header">
          <div>
            <h1>Bienvenido, {user?.full_name}</h1>
            <p>Panel de usuario</p>
          </div>
        </header>
        <div className="card">
          <p>No tienes operaciones asignadas. Accede a las empresas y cuentas desde el menú lateral.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Bienvenido, {user?.full_name}</h1>
          <p>Resumen de operaciones</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

      {/* Stats de operaciones */}
      <div className="stats-grid">
        <div className="stat-card warning">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Operaciones Abiertas</span>
            <span className="stat-value">{operationsSummary?.counts?.open || 0}</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Completadas</span>
            <span className="stat-value">{operationsSummary?.counts?.completed || 0}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <XCircle size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Canceladas</span>
            <span className="stat-value">{operationsSummary?.counts?.cancelled || 0}</span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Operaciones Abiertas */}
        <section className="card">
          <div className="card-header">
            <h2><Clock size={20} /> Operaciones Abiertas</h2>
            <Link to="/operations" className="btn btn-text">Ver todas</Link>
          </div>
          <div className="operations-list">
            {operationsSummary?.open_operations?.length === 0 ? (
              <p className="empty-message">No hay operaciones abiertas</p>
            ) : (
              operationsSummary?.open_operations?.map((op) => (
                <Link key={op.id} to="/operations" className="operation-item">
                  <div className="operation-item-info">
                    <span className="operation-item-name">{op.name}</span>
                    <span className="operation-item-meta">
                      {op.transaction_count} transferencias • {formatDate(op.created_at)}
                    </span>
                  </div>
                  <ArrowRight size={18} className="text-muted" />
                </Link>
              ))
            )}
          </div>
        </section>

        {/* Balance entre Grupos */}
        <section className="card">
          <div className="card-header">
            <h2><FolderTree size={20} /> Balance entre Grupos</h2>
          </div>
          <div className="groups-balance-list">
            {groupsBalance.length === 0 ? (
              <p className="empty-message">No hay movimientos entre grupos</p>
            ) : (
              groupsBalance.map((group) => (
                <div 
                  key={group.group_id} 
                  className="group-balance-item clickable"
                  onClick={() => navigate(`/companies?group=${group.group_id}`)}
                >
                  <div className="group-balance-info">
                    <span className="group-balance-name">{group.group_name}</span>
                    {group.pending_balance !== 0 && (
                      <span className="group-balance-breakdown">
                        Bancario: {formatCurrency(group.transfers_balance)} | 
                        Apuntes: {formatCurrency(group.pending_balance)}
                      </span>
                    )}
                  </div>
                  <span className={`group-balance-amount ${group.balance >= 0 ? 'positive' : 'negative'}`}>
                    {group.balance >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {formatCurrency(Math.abs(group.balance))}
                  </span>
                </div>
              ))
            )}
          </div>
          {groupsBalance.length > 0 && (
            <p className="balance-explanation">
              Balance positivo = el grupo ha recibido más de lo que ha enviado (incluye apuntes pendientes)
            </p>
          )}
        </section>
      </div>

      {/* Últimas Operaciones */}
      <section className="card last-operations-card">
        <div className="card-header">
          <h2><GitBranch size={20} /> Últimas Operaciones</h2>
          <Link to="/operations" className="btn btn-text">Ver todas</Link>
        </div>
        <div className="recent-operations-list">
          {operationsSummary?.recent_operations?.length === 0 ? (
            <p className="empty-message">No hay operaciones</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Operación</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                </tr>
              </thead>
              <tbody>
                {operationsSummary?.recent_operations?.map((op) => (
                  <tr key={op.id}>
                    <td>
                      <Link to="/operations" className="operation-link">{op.name}</Link>
                    </td>
                    <td>
                      <div className="status-badge-inline">
                        {getStatusIcon(op.status)}
                        <span>{getStatusLabel(op.status)}</span>
                      </div>
                    </td>
                    <td className="text-muted">{formatDate(op.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
