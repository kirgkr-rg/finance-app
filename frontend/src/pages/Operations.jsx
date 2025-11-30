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
  FolderTree,
  FileDown,
  Edit,
  Trash2
} from 'lucide-react';

const Operations = () => {
  const [operations, setOperations] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState(null);
  const [flowData, setFlowData] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', notes: '' });
  const [editData, setEditData] = useState({ name: '', description: '', notes: '' });
  const [transferData, setTransferData] = useState({
    from_account_id: '',
    to_account_id: '',
    amount: '',
    description: '',
    operation_id: '',
    transaction_date: new Date().toISOString().split('T')[0]
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
      setFormData({ name: '', description: '', notes: '' });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear operación');
    }
  };

  const openEditModal = (operation) => {
    setSelectedOperation(operation);
    setEditData({
      name: operation.name,
      description: operation.description || '',
      notes: operation.notes || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.patch(`/operations/${selectedOperation.id}`, editData);
      setShowEditModal(false);
      setSelectedOperation(null);
      fetchData();
      // Si el modal de flujo está abierto, actualizarlo
      if (showFlowModal && flowData && flowData.operation.id === selectedOperation.id) {
        viewFlow(selectedOperation.id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar operación');
    }
  };

  const handleDeleteOperation = async (operation) => {
    if (!confirm(`¿Eliminar la operación "${operation.name}"? Las transacciones serán desasignadas.`)) return;

    try {
      await api.delete(`/operations/${operation.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar operación');
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      await api.post('/transactions/transfer', {
        ...transferData,
        amount: parseFloat(transferData.amount),
        transaction_date: transferData.transaction_date ? new Date(transferData.transaction_date).toISOString() : null
      });
      setShowTransferModal(false);
      setTransferData({
        from_account_id: '',
        to_account_id: '',
        amount: '',
        description: '',
        operation_id: '',
        transaction_date: new Date().toISOString().split('T')[0]
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
      from_account_id: '',
      to_account_id: '',
      amount: '',
      description: '',
      operation_id: operation.id,
      transaction_date: new Date().toISOString().split('T')[0]
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

  const exportToPDF = () => {
    if (!flowData) return;

    const { operation, edges, nodes, group_nodes } = flowData;
    
    // Crear contenido HTML para el PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Operación: ${operation.name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          .header { border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
          .header h1 { color: #6366f1; font-size: 24px; margin-bottom: 5px; }
          .header .subtitle { color: #666; font-size: 14px; }
          .meta { display: flex; gap: 30px; margin-bottom: 30px; }
          .meta-item { }
          .meta-item .label { font-size: 12px; color: #666; text-transform: uppercase; }
          .meta-item .value { font-size: 16px; font-weight: bold; }
          .section { margin-bottom: 30px; }
          .section h2 { font-size: 16px; color: #6366f1; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
          th { background: #f8f9fa; font-weight: 600; color: #666; }
          .text-right { text-align: right; }
          .positive { color: #22c55e; }
          .negative { color: #ef4444; }
          .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; }
          .summary-card { background: #f8f9fa; border-radius: 8px; padding: 15px; }
          .summary-card h3 { font-size: 14px; margin-bottom: 10px; }
          .summary-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 5px; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${operation.name}</h1>
          <div class="subtitle">${operation.description || 'Sin descripción'}</div>
        </div>

        <div class="meta">
          <div class="meta-item">
            <div class="label">Estado</div>
            <div class="value">${getStatusLabel(operation.status)}</div>
          </div>
          <div class="meta-item">
            <div class="label">Fecha creación</div>
            <div class="value">${formatDate(operation.created_at)}</div>
          </div>
          ${operation.closed_at ? `
          <div class="meta-item">
            <div class="label">Fecha cierre</div>
            <div class="value">${formatDate(operation.closed_at)}</div>
          </div>
          ` : ''}
          <div class="meta-item">
            <div class="label">Nº Transferencias</div>
            <div class="value">${edges.length}</div>
          </div>
        </div>

        ${operation.notes ? `
        <div class="section">
          <h2>Notas / Observaciones</h2>
          <p style="white-space: pre-wrap; font-size: 14px;">${operation.notes}</p>
        </div>
        ` : ''}

        ${edges.length > 0 ? `
        <div class="section">
          <h2>Detalle de Transferencias</h2>
          <table>
            <thead>
              <tr>
                <th>Origen</th>
                <th>Destino</th>
                <th class="text-right">Importe</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              ${edges.map(edge => `
                <tr>
                  <td>${edge.from_company_name}</td>
                  <td>${edge.to_company_name}</td>
                  <td class="text-right">${formatCurrency(edge.amount)}</td>
                  <td>${formatDate(edge.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Resumen por Empresa</h2>
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th class="text-right">Entradas</th>
                <th class="text-right">Salidas</th>
                <th class="text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              ${nodes.map(node => `
                <tr>
                  <td>${node.company_name}</td>
                  <td class="text-right positive">+${formatCurrency(node.total_in)}</td>
                  <td class="text-right negative">-${formatCurrency(node.total_out)}</td>
                  <td class="text-right ${node.total_in - node.total_out >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(node.total_in - node.total_out)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${group_nodes && group_nodes.length > 0 ? `
        <div class="section">
          <h2>Resumen por Grupo</h2>
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th class="text-right">Entradas</th>
                <th class="text-right">Salidas</th>
                <th class="text-right">Neto</th>
              </tr>
            </thead>
            <tbody>
              ${group_nodes.map(node => `
                <tr>
                  <td>${node.group_name}</td>
                  <td class="text-right positive">+${formatCurrency(node.total_in)}</td>
                  <td class="text-right negative">-${formatCurrency(node.total_out)}</td>
                  <td class="text-right ${node.total_in - node.total_out >= 0 ? 'positive' : 'negative'}">
                    ${formatCurrency(node.total_in - node.total_out)}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
        ` : '<p>Esta operación no tiene transferencias.</p>'}

        <div class="footer">
          Generado el ${new Date().toLocaleString('es-ES')} • Finance App
        </div>
      </body>
      </html>
    `;

    // Abrir ventana de impresión
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Esperar a que cargue y abrir diálogo de impresión
    setTimeout(() => {
      printWindow.print();
    }, 250);
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

              {operation.notes && (
                <p className="operation-notes">{operation.notes}</p>
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
                <button className="btn btn-icon" onClick={() => openEditModal(operation)} title="Editar">
                  <Edit size={16} />
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
                  <>
                    <button 
                      className="btn btn-secondary btn-small"
                      onClick={() => updateStatus(operation.id, 'open')}
                    >
                      Reabrir
                    </button>
                    <button 
                      className="btn btn-icon danger"
                      onClick={() => handleDeleteOperation(operation)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
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
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="notes">Notas / Observaciones</label>
                <textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas adicionales..."
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

      {/* Modal Editar Operación */}
      {showEditModal && selectedOperation && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Operación</h2>
              <button className="btn btn-icon" onClick={() => setShowEditModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="edit-name">Nombre de la operación</label>
                <input
                  type="text"
                  id="edit-name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-description">Descripción</label>
                <textarea
                  id="edit-description"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-notes">Notas / Observaciones</label>
                <textarea
                  id="edit-notes"
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Añade notas o información adicional..."
                  rows={4}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
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
              <div className="modal-header-actions">
                <button className="btn btn-secondary" onClick={exportToPDF} title="Exportar PDF">
                  <FileDown size={18} />
                  Exportar PDF
                </button>
                <button className="btn btn-icon" onClick={() => setShowFlowModal(false)}>
                  <X size={20} />
                </button>
              </div>
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
                <label htmlFor="transaction_date">Fecha del movimiento</label>
                <input
                  type="date"
                  id="transaction_date"
                  value={transferData.transaction_date}
                  onChange={(e) => setTransferData({ ...transferData, transaction_date: e.target.value })}
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
