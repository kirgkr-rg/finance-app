import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  GitBranch,
  Plus,
  X,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  FolderTree
} from 'lucide-react';

const Operations = () => {
  const [operations, setOperations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [flowData, setFlowData] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [transferData, setTransferData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    operation_id: ''
  });
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      const [operationsRes, accountsRes] = await Promise.all([
        api.get(`/operations/${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/accounts/')
      ]);
      setOperations(operationsRes.data);
      setAccounts(accountsRes.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/operations/', formData);
      setShowModal(false);
      setFormData({ name: '', description: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear operación');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/transactions/transfer', {
        ...transferData,
        amount: parseFloat(transferData.amount)
      });
      setShowTransferModal(false);
      setTransferData({
        from_account_id: '',
        to_account_id: '',
        amount: '',
        description: '',
        operation_id: ''
      });
      if (selectedOperation) {
        viewFlow(selectedOperation.id);
      }
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al realizar transferencia');
    }
  };

  const viewFlow = async (operationId) => {
    try {
      const response = await api.get(`/operations/${operationId}/flow`);
      setFlowData(response.data);
      setSelectedOperation(response.data.operation);
      setShowFlowModal(true);
    } catch (err) {
      alert('Error al cargar el flujo');
    }
  };

  const updateStatus = async (operationId, newStatus) => {
    try {
      await api.patch(`/operations/${operationId}`, { status: newStatus });
      fetchData();
      if (flowData && flowData.operation.id === operationId) {
        viewFlow(operationId);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al actualizar');
    }
  };

  const openTransferModal = (operation) => {
    setSelectedOperation(operation);
    setTransferData({
      ...transferData,
      operation_id: operation.id
    });
    setShowTransferModal(true);
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Operaciones</h1>
          <p>Seguimiento de flujos de dinero entre empresas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Nueva Operación
        </button>
      </header>

      <div className="filters-bar">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="open">Abiertas</option>
          <option value="completed">Completadas</option>
          <option value="cancelled">Canceladas</option>
        </select>
      </div>

      <div className="operations-grid">
        {operations.length === 0 ? (
          <div className="empty-state">
            <GitBranch size={64} />
            <h3>No hay operaciones</h3>
            <p>Crea una operación para agrupar transferencias relacionadas</p>
          </div>
        ) : (
          operations.map((operation) => (
            <div key={operation.id} className={`operation-card status-${operation.status}`}>
              <div className="operation-header">
                <div className="operation-title">
                  <GitBranch size={20} />
                  <h3>{operation.name}</h3>
                </div>
                <div className={`status-badge ${operation.status}`}>
                  {getStatusIcon(operation.status)}
                  <span>{getStatusLabel(operation.status)}</span>
                </div>
              </div>
              
              {operation.description && (
                <p className="operation-description">{operation.description}</p>
              )}
              
              <div className="operation-meta">
                <span>Creada: {formatDate(operation.created_at)}</span>
                {operation.closed_at && (
                  <span>Cerrada: {formatDate(operation.closed_at)}</span>
                )}
              </div>

              <div className="operation-actions">
                <button className="btn btn-secondary" onClick={() => viewFlow(operation.id)}>
                  <Eye size={16} />
                  Ver Flujo
                </button>
                {operation.status === 'open' && (
                  <>
                    <button className="btn btn-primary" onClick={() => openTransferModal(operation)}>
                      <Plus size={16} />
                      Transferencia
                    </button>
                    <button 
                      className="btn btn-success btn-small"
                      onClick={() => updateStatus(operation.id, 'completed')}
                    >
                      Completar
                    </button>
                    <button 
                      className="btn btn-danger btn-small"
                      onClick={() => updateStatus(operation.id, 'cancelled')}
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {operation.status !== 'open' && (
                  <button 
                    className="btn btn-secondary btn-small"
                    onClick={() => updateStatus(operation.id, 'open')}
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Nueva Operación */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva Operación</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="name">Nombre de la operación</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Compra de mercancía Q4"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el propósito de esta operación..."
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Operación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Flujo de Operación */}
      {showFlowModal && flowData && (
        <div className="modal-overlay" onClick={() => setShowFlowModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Flujo: {flowData.operation.name}</h2>
              <button className="btn btn-icon" onClick={() => setShowFlowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flow-content">
              {flowData.edges.length === 0 ? (
                <div className="empty-state">
                  <GitBranch size={48} />
                  <h3>Sin movimientos</h3>
                  <p>Esta operación aún no tiene transferencias</p>
                </div>
              ) : (
                <>
                  {/* Mapa visual del flujo */}
                  <div className="flow-map">
                    <h3>Mapa de Transferencias</h3>
                    <div className="flow-diagram">
                      {flowData.edges.map((edge, index) => (
                        <div key={index} className="flow-edge">
                          <div className="flow-node from">
                            <span className="node-name">{edge.from_company_name}</span>
                          </div>
                          <div className="flow-arrow">
                            <ArrowRight size={24} />
                            <span className="flow-amount">{formatCurrency(edge.amount)}</span>
                          </div>
                          <div className="flow-node to">
                            <span className="node-name">{edge.to_company_name}</span>
                          </div>
                          <span className="flow-date">{formatDate(edge.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumen por empresa */}
                  <div className="flow-summary">
                    <h3>Resumen por Empresa</h3>
                    <div className="summary-grid">
                      {flowData.nodes.map((node) => (
                        <div key={node.company_id} className="summary-card">
                          <h4>{node.company_name}</h4>
                          <div className="summary-row">
                            <span className="label">Entradas:</span>
                            <span className="value positive">+{formatCurrency(node.total_in)}</span>
                          </div>
                          <div className="summary-row">
                            <span className="label">Salidas:</span>
                            <span className="value negative">-{formatCurrency(node.total_out)}</span>
                          </div>
                          <div className="summary-row total">
                            <span className="label">Neto:</span>
                            <span className={`value ${node.total_in - node.total_out >= 0 ? 'positive' : 'negative'}`}>
                              {formatCurrency(node.total_in - node.total_out)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumen por grupo */}
                  {flowData.group_nodes && flowData.group_nodes.length > 0 && (
                    <div className="flow-summary group-summary">
                      <h3><FolderTree size={20} /> Resumen por Grupo</h3>
                      <div className="summary-grid">
                        {flowData.group_nodes.map((node, index) => (
                          <div key={node.group_id || `no-group-${index}`} className="summary-card group-card-summary">
                            <h4>{node.group_name}</h4>
                            <div className="summary-row">
                              <span className="label">Entradas:</span>
                              <span className="value positive">+{formatCurrency(node.total_in)}</span>
                            </div>
                            <div className="summary-row">
                              <span className="label">Salidas:</span>
                              <span className="value negative">-{formatCurrency(node.total_out)}</span>
                            </div>
                            <div className="summary-row total">
                              <span className="label">Neto:</span>
                              <span className={`value ${node.total_in - node.total_out >= 0 ? 'positive' : 'negative'}`}>
                                {formatCurrency(node.total_in - node.total_out)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {flowData.operation.status === 'open' && (
                <div className="flow-actions">
                  <button className="btn btn-primary" onClick={() => {
                    setShowFlowModal(false);
                    openTransferModal(flowData.operation);
                  }}>
                    <Plus size={18} />
                    Agregar Transferencia
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Transferencia para Operación */}
      {showTransferModal && (
        <div className="modal-overlay" onClick={() => setShowTransferModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nueva Transferencia</h2>
              <button className="btn btn-icon" onClick={() => setShowTransferModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleTransferSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="info-box">
                <strong>Operación:</strong> {selectedOperation?.name}
              </div>

              <div className="form-group">
                <label htmlFor="from_account_id">Cuenta Origen</label>
                <select
                  id="from_account_id"
                  value={transferData.from_account_id}
                  onChange={(e) => setTransferData({ ...transferData, from_account_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.company?.name} - {account.name} ({formatCurrency(account.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="to_account_id">Cuenta Destino</label>
                <select
                  id="to_account_id"
                  value={transferData.to_account_id}
                  onChange={(e) => setTransferData({ ...transferData, to_account_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cuenta</option>
                  {accounts
                    .filter(a => a.id !== transferData.from_account_id)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.company?.name} - {account.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="amount">Monto</label>
                <input
                  type="number"
                  id="amount"
                  value={transferData.amount}
                  onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción</label>
                <input
                  type="text"
                  id="description"
                  value={transferData.description}
                  onChange={(e) => setTransferData({ ...transferData, description: e.target.value })}
                  placeholder="Concepto de la transferencia"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTransferModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Realizar Transferencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operations;
