import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Plus,
  X,
  Check,
  RotateCcw,
  Trash2,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

const PendingEntries = () => {
  const { isSupervisor } = useAuth();
  const [entries, setEntries] = useState([]);
  const [groups, setGroups] = useState([]);
  const [operations, setOperations] = useState([]);
  const [groupsSummary, setGroupsSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [formData, setFormData] = useState({
    from_group_id: '',
    to_group_id: '',
    amount: '',
    description: '',
    operation_id: ''
  });
  const [settleOperationId, setSettleOperationId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    try {
      const [entriesRes, groupsRes, opsRes, summaryRes] = await Promise.all([
        api.get(`/pending-entries/${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/groups/'),
        api.get('/operations/?status=open'),
        api.get('/pending-entries/summary/groups')
      ]);
      setEntries(entriesRes.data);
      setGroups(groupsRes.data);
      setOperations(opsRes.data);
      setGroupsSummary(summaryRes.data);
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
      await api.post('/pending-entries/', {
        from_group_id: formData.from_group_id,
        to_group_id: formData.to_group_id,
        amount: parseFloat(formData.amount),
        description: formData.description || null,
        operation_id: formData.operation_id || null
      });
      setShowModal(false);
      setFormData({ from_group_id: '', to_group_id: '', amount: '', description: '', operation_id: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear apunte');
    }
  };

  const handleSettle = async () => {
    try {
      await api.post(`/pending-entries/${selectedEntry.id}/settle`, null, {
        params: { operation_id: settleOperationId || null }
      });
      setShowSettleModal(false);
      setSelectedEntry(null);
      setSettleOperationId('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al liquidar');
    }
  };

  const handleUnsettle = async (entry) => {
    if (!confirm('¿Revertir la liquidación de este apunte?')) return;
    
    try {
      await api.post(`/pending-entries/${entry.id}/unsettle`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al revertir');
    }
  };

  const handleDelete = async (entry) => {
    if (!confirm('¿Eliminar este apunte?')) return;
    
    try {
      await api.delete(`/pending-entries/${entry.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const openSettleModal = (entry) => {
    setSelectedEntry(entry);
    setSettleOperationId('');
    setShowSettleModal(true);
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
      year: 'numeric'
    });
  };

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Apuntes Pendientes</h1>
          <p>Deudas y créditos entre grupos</p>
        </div>
        {isSupervisor() && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={18} />
            Nuevo Apunte
          </button>
        )}
      </header>

      {/* Resumen por grupos */}
      {groupsSummary.length > 0 && (
        <section className="card pending-summary">
          <h2 className="section-title">Saldos entre Grupos</h2>
          <div className="groups-balance-grid">
            {groupsSummary.map((group) => (
              <div key={group.group_id} className="group-balance-card">
                <h3>{group.group_name}</h3>
                <div className="balance-details">
                  <div className="balance-row">
                    <span className="label">Debe:</span>
                    <span className="amount negative">{formatCurrency(group.owes)}</span>
                  </div>
                  <div className="balance-row">
                    <span className="label">Le deben:</span>
                    <span className="amount positive">{formatCurrency(group.owed)}</span>
                  </div>
                  <div className="balance-row net">
                    <span className="label">Saldo neto:</span>
                    <span className={`amount ${parseFloat(group.net) >= 0 ? 'positive' : 'negative'}`}>
                      {parseFloat(group.net) >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {formatCurrency(group.net)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filtros */}
      <div className="filters-bar">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos</option>
          <option value="pending">Pendientes</option>
          <option value="settled">Liquidados</option>
        </select>
      </div>

      {/* Lista de apuntes */}
      <section className="card">
        {entries.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>No hay apuntes</h3>
            <p>No hay apuntes pendientes registrados</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Deudor</th>
                  <th>Acreedor</th>
                  <th className="text-right">Importe</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  {isSupervisor() && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className={entry.status === 'settled' ? 'settled-row' : ''}>
                    <td>{formatDate(entry.created_at)}</td>
                    <td>{entry.from_group_name}</td>
                    <td>{entry.to_group_name}</td>
                    <td className="text-right">
                      <span className="amount">{formatCurrency(entry.amount)}</span>
                    </td>
                    <td>{entry.description || '-'}</td>
                    <td>
                      <span className={`status-badge ${entry.status}`}>
                        {entry.status === 'pending' ? 'Pendiente' : 'Liquidado'}
                      </span>
                    </td>
                    {isSupervisor() && (
                      <td>
                        <div className="table-actions">
                          {entry.status === 'pending' ? (
                            <button
                              className="btn btn-icon success"
                              onClick={() => openSettleModal(entry)}
                              title="Liquidar"
                            >
                              <Check size={16} />
                            </button>
                          ) : (
                            <button
                              className="btn btn-icon"
                              onClick={() => handleUnsettle(entry)}
                              title="Revertir liquidación"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                          <button
                            className="btn btn-icon danger"
                            onClick={() => handleDelete(entry)}
                            title="Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modal Nuevo Apunte */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nuevo Apunte Pendiente</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label htmlFor="from_group_id">Grupo Deudor (debe)</label>
                <select
                  id="from_group_id"
                  value={formData.from_group_id}
                  onChange={(e) => setFormData({ ...formData, from_group_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona grupo</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="to_group_id">Grupo Acreedor (le deben)</label>
                <select
                  id="to_group_id"
                  value={formData.to_group_id}
                  onChange={(e) => setFormData({ ...formData, to_group_id: e.target.value })}
                  required
                >
                  <option value="">Selecciona grupo</option>
                  {groups.filter(g => g.id !== formData.from_group_id).map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="amount">Importe</label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción</label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ej: Deuda de operaciones anteriores"
                />
              </div>

              <div className="form-group">
                <label htmlFor="operation_id">Operación (opcional)</label>
                <select
                  id="operation_id"
                  value={formData.operation_id}
                  onChange={(e) => setFormData({ ...formData, operation_id: e.target.value })}
                >
                  <option value="">Sin operación</option>
                  {operations.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Crear Apunte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Liquidar */}
      {showSettleModal && selectedEntry && (
        <div className="modal-overlay" onClick={() => setShowSettleModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Liquidar Apunte</h2>
              <button className="btn btn-icon" onClick={() => setShowSettleModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="info-box">
                <p>
                  <strong>{selectedEntry.from_group_name}</strong> debe{' '}
                  <strong>{formatCurrency(selectedEntry.amount)}</strong> a{' '}
                  <strong>{selectedEntry.to_group_name}</strong>
                </p>
                {selectedEntry.description && (
                  <p className="text-muted">{selectedEntry.description}</p>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="settle_operation_id">Asociar a operación (opcional)</label>
                <select
                  id="settle_operation_id"
                  value={settleOperationId}
                  onChange={(e) => setSettleOperationId(e.target.value)}
                >
                  <option value="">Sin operación</option>
                  {operations.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowSettleModal(false)}>
                  Cancelar
                </button>
                <button className="btn btn-success" onClick={handleSettle}>
                  <Check size={18} />
                  Liquidar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingEntries;
