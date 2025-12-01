import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  X,
  RefreshCw,
  RotateCcw,
  Paperclip,
  GitBranch,
  Upload,
  Download,
  Trash2,
  FileText,
  Eye,
  Edit
} from 'lucide-react';

const Transactions = () => {
  const { isSupervisor, isDemo, canEdit } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [transactionType, setTransactionType] = useState('transfer');
  const [formData, setFormData] = useState({
    from_account_id: '',
    to_account_id: '',
    confirming_account_id: '',
    charge_account_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });
  const [fromCompanyFilter, setFromCompanyFilter] = useState('');
  const [toCompanyFilter, setToCompanyFilter] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Estado para adjuntos
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Estado para asignar operación
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [transactionToAssign, setTransactionToAssign] = useState(null);
  const [operations, setOperations] = useState([]);
  const [selectedOperationId, setSelectedOperationId] = useState('');

  // Estado para editar transacción
  const [showEditModal, setShowEditModal] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    description: '',
    transaction_date: ''
  });
  const [editError, setEditError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsRes, accountsRes, companiesRes] = await Promise.all([
        api.get('/transactions/?limit=100'),
        api.get('/accounts/'),
        api.get('/companies/')
      ]);
      setTransactions(transactionsRes.data);
      setAccounts(accountsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        amount: parseFloat(formData.amount),
        description: formData.description,
        transaction_date: formData.transaction_date ? new Date(formData.transaction_date).toISOString() : null
      };

      if (transactionType === 'transfer') {
        payload.from_account_id = formData.from_account_id;
        payload.to_account_id = formData.to_account_id;
        await api.post('/transactions/transfer', payload);
      } else if (transactionType === 'deposit') {
        payload.to_account_id = formData.to_account_id;
        await api.post('/transactions/deposit', payload);
      } else if (transactionType === 'withdrawal') {
        payload.from_account_id = formData.from_account_id;
        await api.post('/transactions/withdrawal', payload);
      } else if (transactionType === 'confirming_settlement') {
        payload.confirming_account_id = formData.confirming_account_id;
        payload.charge_account_id = formData.charge_account_id;
        await api.post('/transactions/confirming-settlement', payload);
      }

      setShowModal(false);
      setFormData({ 
        from_account_id: '', 
        to_account_id: '', 
        confirming_account_id: '', 
        charge_account_id: '', 
        amount: '', 
        description: '',
        transaction_date: new Date().toISOString().split('T')[0]
      });
      setFromCompanyFilter('');
      setToCompanyFilter('');
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(e => e.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Error al procesar la transacción');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const displayAmount = (amount, currency = 'EUR') => {
    if (isDemo()) {
      return '****';
    }
    return formatCurrency(amount, currency);
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

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="text-green" size={20} />;
      case 'withdrawal':
        return <ArrowUpRight className="text-red" size={20} />;
      case 'confirming_settlement':
        return <RotateCcw className="text-purple" size={20} />;
      default:
        return <RefreshCw className="text-blue" size={20} />;
    }
  };

  const getTransactionLabel = (type) => {
    switch (type) {
      case 'deposit':
        return 'Depósito';
      case 'withdrawal':
        return 'Retiro';
      case 'confirming_settlement':
        return 'Vto. Confirming';
      default:
        return 'Transferencia';
    }
  };

  const openModal = (type) => {
    setTransactionType(type);
    setFormData({ 
      from_account_id: '', 
      to_account_id: '', 
      confirming_account_id: '', 
      charge_account_id: '', 
      amount: '', 
      description: '',
      transaction_date: new Date().toISOString().split('T')[0]
    });
    setFromCompanyFilter('');
    setToCompanyFilter('');
    setError('');
    setShowModal(true);
  };

  // Funciones para adjuntos
  const viewTransactionAttachments = async (transaction) => {
    setSelectedTransaction(transaction);
    setLoadingAttachments(true);
    try {
      const response = await api.get(`/attachments/transaction/${transaction.id}`);
      setAttachments(response.data);
    } catch (error) {
      console.error('Error:', error);
      setAttachments([]);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const closeAttachmentsModal = () => {
    setSelectedTransaction(null);
    setAttachments([]);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo: 5MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await api.post(`/attachments/transaction/${selectedTransaction.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const response = await api.get(`/attachments/transaction/${selectedTransaction.id}`);
      setAttachments(response.data);
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al subir archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const downloadAttachment = async (attachment) => {
    try {
      const response = await api.get(`/attachments/${attachment.id}/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error al descargar archivo');
    }
  };

  const viewAttachment = async (attachment) => {
    try {
      const response = await api.get(`/attachments/${attachment.id}/download`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: attachment.content_type });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error) {
      alert('Error al abrir archivo');
    }
  };

  const deleteAttachment = async (attachment) => {
    if (!confirm(`¿Eliminar ${attachment.filename}?`)) return;

    try {
      await api.delete(`/attachments/${attachment.id}`);
      setAttachments(attachments.filter(a => a.id !== attachment.id));
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al eliminar archivo');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Funciones para asignar operación
  const openAssignModal = async (transaction) => {
    setTransactionToAssign(transaction);
    setSelectedOperationId(transaction.operation_id || '');
    try {
      const response = await api.get('/operations/?status=open');
      setOperations(response.data);
    } catch (error) {
      console.error('Error:', error);
      setOperations([]);
    }
    setShowAssignModal(true);
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setTransactionToAssign(null);
    setSelectedOperationId('');
  };

  const handleAssignOperation = async () => {
    try {
      await api.patch(
        `/transactions/${transactionToAssign.id}/assign-operation`,
        null,
        { params: { operation_id: selectedOperationId || null } }
      );
      
      setTransactions(transactions.map(tx => 
        tx.id === transactionToAssign.id 
          ? { ...tx, operation_id: selectedOperationId || null }
          : tx
      ));
      
      closeAssignModal();
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al asignar operación');
    }
  };

  // Funciones para editar transacción
  const openEditModal = async (transaction) => {
    try {
      const response = await api.get(`/transactions/${transaction.id}/can-edit`);
      if (!response.data.can_edit) {
        alert('Solo se puede editar la última transacción de cada cuenta');
        return;
      }
      
      setTransactionToEdit(transaction);
      setEditFormData({
        amount: transaction.amount,
        description: transaction.description || '',
        transaction_date: transaction.transaction_date 
          ? new Date(transaction.transaction_date).toISOString().split('T')[0]
          : new Date(transaction.created_at).toISOString().split('T')[0]
      });
      setEditError('');
      setShowEditModal(true);
    } catch (error) {
      alert(error.response?.data?.detail || 'Error al verificar transacción');
    }
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setTransactionToEdit(null);
    setEditFormData({ amount: '', description: '', transaction_date: '' });
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      const payload = {
        amount: parseFloat(editFormData.amount),
        description: editFormData.description,
        transaction_date: editFormData.transaction_date 
          ? new Date(editFormData.transaction_date).toISOString() 
          : null
      };

      await api.patch(`/transactions/${transactionToEdit.id}`, payload);
      
      closeEditModal();
      fetchData(); // Recargar para actualizar saldos
    } catch (error) {
      setEditError(error.response?.data?.detail || 'Error al actualizar transacción');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!confirm('¿Eliminar esta transacción? Se revertirán los saldos de las cuentas afectadas.')) return;

    try {
      await api.delete(`/transactions/${transactionToEdit.id}`);
      closeEditModal();
      fetchData();
    } catch (error) {
      setEditError(error.response?.data?.detail || 'Error al eliminar transacción');
    }
  };

  // Filtrar cuentas por tipo
  const confirmingAccounts = accounts.filter(a => a.account_type === 'confirming');
  const corrienteAccounts = accounts.filter(a => a.account_type === 'corriente');

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Transacciones</h1>
          <p>Historial de movimientos</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => openModal('transfer')}>
            <ArrowLeftRight size={18} />
            Transferir
          </button>
          {canEdit() && (
            <>
              <button className="btn btn-success" onClick={() => openModal('deposit')}>
                <ArrowDownLeft size={18} />
                Depositar
              </button>
              <button className="btn btn-danger" onClick={() => openModal('withdrawal')}>
                <ArrowUpRight size={18} />
                Retirar
              </button>
              {confirmingAccounts.length > 0 && (
                <button className="btn btn-purple" onClick={() => openModal('confirming_settlement')}>
                  <RotateCcw size={18} />
                  Vto. Confirming
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="card">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <ArrowLeftRight size={64} />
            <h3>No hay transacciones</h3>
            <p>Aún no se han realizado movimientos</p>
          </div>
        ) : (
          <div className="transactions-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th className="text-right">Monto</th>
                  <th>Fecha</th>
                  {canEdit() && <th></th>}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <div className="transaction-type">
                        {getTransactionIcon(tx.transaction_type)}
                        <span>{getTransactionLabel(tx.transaction_type)}</span>
                      </div>
                    </td>
                    <td>{tx.description || '-'}</td>
                    <td>
                      {tx.from_account ? (
                        <div className="account-cell">
                          <span className="account-name">{tx.from_account.name}</span>
                          <span className="company-name">{tx.from_account.company?.name}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td>
                      {tx.to_account ? (
                        <div className="account-cell">
                          <span className="account-name">{tx.to_account.name}</span>
                          <span className="company-name">{tx.to_account.company?.name}</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="text-right">
                      <span className={`amount ${
                        tx.transaction_type === 'deposit' ? 'positive' : 
                        tx.transaction_type === 'withdrawal' ? 'negative' : ''
                      }`}>
                        {displayAmount(tx.amount)}
                      </span>
                    </td>
                    <td className="date-cell">{formatDate(tx.transaction_date || tx.created_at)}</td>
                    {canEdit() && (
                      <td>
                        <div className="table-actions">
                          <button 
                            className="btn btn-icon btn-sm" 
                            onClick={() => openEditModal(tx)}
                            title="Editar transacción"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            className="btn btn-icon btn-sm" 
                            onClick={() => viewTransactionAttachments(tx)}
                            title="Ver adjuntos"
                          >
                            <Paperclip size={16} />
                          </button>
                          <button 
                            className={`btn btn-icon btn-sm ${tx.operation_id ? 'has-operation' : ''}`}
                            onClick={() => openAssignModal(tx)}
                            title={tx.operation_id ? "Cambiar operación" : "Asignar a operación"}
                          >
                            <GitBranch size={16} />
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
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {transactionType === 'transfer' && 'Nueva Transferencia'}
                {transactionType === 'deposit' && 'Nuevo Depósito'}
                {transactionType === 'withdrawal' && 'Nuevo Retiro'}
                {transactionType === 'confirming_settlement' && 'Vencimiento Confirming'}
              </h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}

              {transactionType === 'confirming_settlement' && (
                <>
                  <div className="info-box">
                    Registra el vencimiento de una factura pagada por confirming. 
                    El banco cobrará de la cuenta corriente y se regenerará el disponible del confirming.
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="confirming_account_id">Cuenta Confirming</label>
                    <select
                      id="confirming_account_id"
                      value={formData.confirming_account_id}
                      onChange={(e) => setFormData({ ...formData, confirming_account_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar confirming</option>
                      {confirmingAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.company?.name} - {account.name} (Emitido: {formatCurrency(Math.abs(account.balance))})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="charge_account_id">Cuenta de Cargo (Corriente)</label>
                    <select
                      id="charge_account_id"
                      value={formData.charge_account_id}
                      onChange={(e) => setFormData({ ...formData, charge_account_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar cuenta corriente</option>
                      {corrienteAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.company?.name} - {account.name} ({formatCurrency(account.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {(transactionType === 'transfer' || transactionType === 'withdrawal') && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="from_company_filter">Empresa Origen</label>
                    <select
                      id="from_company_filter"
                      value={fromCompanyFilter}
                      onChange={(e) => {
                        setFromCompanyFilter(e.target.value);
                        setFormData({ ...formData, from_account_id: '' });
                      }}
                    >
                      <option value="">Todas las empresas</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="from_account_id">Cuenta Origen</label>
                    <select
                      id="from_account_id"
                      value={formData.from_account_id}
                      onChange={(e) => setFormData({ ...formData, from_account_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts
                        .filter(a => !fromCompanyFilter || a.company_id === fromCompanyFilter)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {!fromCompanyFilter && `${account.company?.name} - `}{account.name} ({formatCurrency(account.balance, account.currency)})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              {(transactionType === 'transfer' || transactionType === 'deposit') && (
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="to_company_filter">Empresa Destino</label>
                    <select
                      id="to_company_filter"
                      value={toCompanyFilter}
                      onChange={(e) => {
                        setToCompanyFilter(e.target.value);
                        setFormData({ ...formData, to_account_id: '' });
                      }}
                    >
                      <option value="">Todas las empresas</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="to_account_id">Cuenta Destino</label>
                    <select
                      id="to_account_id"
                      value={formData.to_account_id}
                      onChange={(e) => setFormData({ ...formData, to_account_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts
                        .filter(a => a.id !== formData.from_account_id)
                        .filter(a => !toCompanyFilter || a.company_id === toCompanyFilter)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {!toCompanyFilter && `${account.company?.name} - `}{account.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="amount">
                  {transactionType === 'confirming_settlement' ? 'Importe del vencimiento' : 'Monto'}
                </label>
                <input
                  type="number"
                  id="amount"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
                  value={formData.transaction_date}
                  onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción (opcional)</label>
                <input
                  type="text"
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={transactionType === 'confirming_settlement' ? 'Ej: Vencimiento factura #123' : 'Concepto de la operación'}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adjuntos */}
      {selectedTransaction && (
        <div className="modal-overlay" onClick={closeAttachmentsModal}>
          <div className="modal modal-medium" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Adjuntos</h2>
                <span className="modal-subtitle">
                  {selectedTransaction.description || 'Transacción'} - {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
              <button className="btn btn-icon" onClick={closeAttachmentsModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="upload-section">
                <label className="btn btn-primary upload-btn">
                  <Upload size={18} />
                  {uploading ? 'Subiendo...' : 'Subir archivo'}
                  <input 
                    type="file" 
                    onChange={handleFileUpload} 
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
                <span className="upload-hint">Máximo 5MB por archivo</span>
              </div>

              {loadingAttachments ? (
                <div className="loading-container">
                  <RefreshCw className="spin" size={24} />
                  <p>Cargando...</p>
                </div>
              ) : attachments.length === 0 ? (
                <div className="empty-state small">
                  <Paperclip size={32} />
                  <p>No hay adjuntos</p>
                </div>
              ) : (
                <div className="attachments-list">
                  {attachments.map((att) => (
                    <div key={att.id} className="attachment-item">
                      <div className="attachment-icon">
                        <FileText size={24} />
                      </div>
                      <div className="attachment-info">
                        <span className="attachment-name">{att.filename}</span>
                        <span className="attachment-size">{formatFileSize(att.file_size)}</span>
                      </div>
                      <div className="attachment-actions">
                        <button 
                          className="btn btn-icon btn-sm" 
                          onClick={() => viewAttachment(att)}
                          title="Ver"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          className="btn btn-icon btn-sm" 
                          onClick={() => downloadAttachment(att)}
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          className="btn btn-icon btn-sm danger" 
                          onClick={() => deleteAttachment(att)}
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignar Operación */}
      {showAssignModal && transactionToAssign && (
        <div className="modal-overlay" onClick={closeAssignModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asignar a Operación</h2>
              <button className="btn btn-icon" onClick={closeAssignModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="info-box">
                <strong>Transacción:</strong> {transactionToAssign.description || 'Sin descripción'}<br />
                <strong>Importe:</strong> {formatCurrency(transactionToAssign.amount)}
              </div>
              
              <div className="form-group">
                <label htmlFor="operation_id">Operación</label>
                <select
                  id="operation_id"
                  value={selectedOperationId}
                  onChange={(e) => setSelectedOperationId(e.target.value)}
                >
                  <option value="">Sin operación</option>
                  {operations.map((op) => (
                    <option key={op.id} value={op.id}>{op.name}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={closeAssignModal}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleAssignOperation}>
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Transacción */}
      {showEditModal && transactionToEdit && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Editar Transacción</h2>
              <button className="btn btn-icon" onClick={closeEditModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              {editError && <div className="error-message">{editError}</div>}
              
              <div className="info-box">
                <strong>Tipo:</strong> {getTransactionLabel(transactionToEdit.transaction_type)}<br />
                {transactionToEdit.from_account && (
                  <><strong>Origen:</strong> {transactionToEdit.from_account.company?.name} - {transactionToEdit.from_account.name}<br /></>
                )}
                {transactionToEdit.to_account && (
                  <><strong>Destino:</strong> {transactionToEdit.to_account.company?.name} - {transactionToEdit.to_account.name}</>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-amount">Importe</label>
                <input
                  type="number"
                  id="edit-amount"
                  value={editFormData.amount}
                  onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-date">Fecha del movimiento</label>
                <input
                  type="date"
                  id="edit-date"
                  value={editFormData.transaction_date}
                  onChange={(e) => setEditFormData({ ...editFormData, transaction_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-description">Descripción</label>
                <input
                  type="text"
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Concepto"
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleDeleteTransaction}
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
                <div className="modal-actions-right">
                  <button type="button" className="btn btn-secondary" onClick={closeEditModal}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar Cambios
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
