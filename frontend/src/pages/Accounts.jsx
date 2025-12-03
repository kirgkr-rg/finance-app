import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Wallet, Plus, X, Edit, Trash2, ChevronDown, ChevronRight, RefreshCw, Eye, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, RotateCcw, GitBranch } from 'lucide-react';

const Accounts = () => {
  const { isSupervisor } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    iban: '',
    company_id: '',
    account_type: 'corriente',
    currency: 'EUR',
    initial_balance: '0',
    credit_limit: '0',
    initial_available: ''
  });
  const [error, setError] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');
  const [expandedCompanies, setExpandedCompanies] = useState({});
  
  // Estado para ajuste de saldo
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState(null);
  const [targetBalance, setTargetBalance] = useState('');
  const [adjustDescription, setAdjustDescription] = useState('Ajuste de saldo');
  const [adjustError, setAdjustError] = useState('');

  // Estado para ver transacciones de cuenta
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountTransactions, setAccountTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Estado para crear transacciones desde extracto
  const [showTxModal, setShowTxModal] = useState(false);
  const [txType, setTxType] = useState('transfer');
  const [txFormData, setTxFormData] = useState({
    to_account_id: '',
    from_account_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0]
  });
  const [txError, setTxError] = useState('');
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [toCompanyFilter, setToCompanyFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [accountsRes, companiesRes, groupsRes] = await Promise.all([
        api.get('/accounts/'),
        api.get('/companies/'),
        api.get('/groups/')
      ]);
      setAccounts(accountsRes.data);
      setCompanies(companiesRes.data);
      setGroups(groupsRes.data);
      
      // Expandir todas las empresas por defecto
      const expanded = {};
      companiesRes.data.forEach(c => expanded[c.id] = true);
      setExpandedCompanies(expanded);
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
      if (editingAccount) {
        const updateData = {
          name: formData.name,
          iban: formData.iban || null,
          credit_limit: parseFloat(formData.credit_limit)
        };
        if (formData.initial_available !== '') {
          updateData.initial_available = parseFloat(formData.initial_available);
        }
        await api.patch(`/accounts/${editingAccount.id}`, updateData);
      } else {
        const createData = {
          name: formData.name,
          iban: formData.iban || null,
          company_id: formData.company_id,
          account_type: formData.account_type,
          currency: formData.currency,
          initial_balance: parseFloat(formData.initial_balance) || 0,
          credit_limit: parseFloat(formData.credit_limit) || 0
        };
        if (formData.initial_available !== '' && formData.initial_available !== null) {
          createData.initial_available = parseFloat(formData.initial_available);
        }
        await api.post('/accounts/', createData);
      }
      setShowModal(false);
      setEditingAccount(null);
      setFormData({ name: '', iban: '', company_id: '', account_type: 'corriente', currency: 'EUR', initial_balance: '0', credit_limit: '0', initial_available: '' });
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        // Error de validación de Pydantic
        setError(detail.map(e => e.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Error al guardar cuenta');
      }
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      iban: account.iban || '',
      company_id: account.company_id,
      account_type: account.account_type,
      currency: account.currency,
      initial_balance: '0',
      credit_limit: account.credit_limit || '0',
      initial_available: account.available || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (account) => {
    if (parseFloat(account.balance) !== 0) {
      alert('No se puede eliminar una cuenta con saldo. Primero transfiere o retira el saldo.');
      return;
    }
    
    if (!confirm(`¿Estás seguro de eliminar la cuenta "${account.name}"?`)) return;

    try {
      await api.delete(`/accounts/${account.id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar cuenta');
    }
  };

  const openAdjustModal = (account) => {
    setAdjustingAccount(account);
    setTargetBalance(account.balance.toString());
    setAdjustDescription('Ajuste de saldo');
    setAdjustError('');
    setShowAdjustModal(true);
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    setAdjustError('');

    try {
      await api.post(
        `/accounts/${adjustingAccount.id}/adjust-balance`,
        null,
        { 
          params: { 
            target_balance: parseFloat(targetBalance),
            description: adjustDescription
          } 
        }
      );
      setShowAdjustModal(false);
      setAdjustingAccount(null);
      fetchData();
    } catch (err) {
      setAdjustError(err.response?.data?.detail || 'Error al ajustar saldo');
    }
  };

  const openNewModal = () => {
    setEditingAccount(null);
    setFormData({ name: '', iban: '', company_id: '', account_type: 'corriente', currency: 'EUR', initial_balance: '0', credit_limit: '0', initial_available: '' });
    setShowModal(true);
  };

  const getAccountTypeLabel = (type) => {
    switch(type) {
      case 'credito': return 'Crédito';
      case 'confirming': return 'Confirming';
      default: return 'Corriente';
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Función para mostrar u ocultar saldos según el modo
  const displayAmount = (amount, currency = 'EUR') => {
    if (false) {
      return '****';
    }
    return formatCurrency(amount, currency);
  };

  const toggleCompany = (companyId) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  const expandAll = () => {
    const expanded = {};
    companies.forEach(c => expanded[c.id] = true);
    setExpandedCompanies(expanded);
  };

  const collapseAll = () => {
    setExpandedCompanies({});
  };

  // Funciones para ver transacciones de cuenta
  const viewAccountTransactions = async (account) => {
    setSelectedAccount(account);
    setLoadingTransactions(true);
    try {
      const response = await api.get(`/transactions/?account_id=${account.id}&limit=50`);
      setAccountTransactions(response.data);
    } catch (error) {
      console.error('Error:', error);
      setAccountTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const closeTransactionsModal = () => {
    setSelectedAccount(null);
    setAccountTransactions([]);
    setShowTxModal(false);
  };

  // Funciones para crear transacciones desde extracto
  const openTxModal = (type) => {
    setTxType(type);
    setTxFormData({
      to_account_id: '',
      from_account_id: '',
      amount: '',
      description: '',
      transaction_date: new Date().toISOString().split('T')[0]
    });
    setToCompanyFilter('');
    setTxError('');
    setShowTxModal(true);
  };

  const handleTxSubmit = async (e) => {
    e.preventDefault();
    setTxError('');
    setTxSubmitting(true);

    try {
      const payload = {
        amount: parseFloat(txFormData.amount),
        description: txFormData.description,
        transaction_date: txFormData.transaction_date ? new Date(txFormData.transaction_date).toISOString() : null
      };

      if (txType === 'transfer_out') {
        // Transferencia saliente: desde esta cuenta a otra
        payload.from_account_id = selectedAccount.id;
        payload.to_account_id = txFormData.to_account_id;
        await api.post('/transactions/transfer', payload);
      } else if (txType === 'transfer_in') {
        // Transferencia entrante: desde otra cuenta a esta
        payload.from_account_id = txFormData.from_account_id;
        payload.to_account_id = selectedAccount.id;
        await api.post('/transactions/transfer', payload);
      } else if (txType === 'deposit') {
        payload.to_account_id = selectedAccount.id;
        await api.post('/transactions/deposit', payload);
      } else if (txType === 'withdrawal') {
        payload.from_account_id = selectedAccount.id;
        await api.post('/transactions/withdrawal', payload);
      }

      setShowTxModal(false);
      // Recargar transacciones y cuentas
      const [txRes, accRes] = await Promise.all([
        api.get(`/transactions/?account_id=${selectedAccount.id}&limit=50`),
        api.get('/accounts/')
      ]);
      setAccountTransactions(txRes.data);
      setAccounts(accRes.data);
      // Actualizar selectedAccount con nuevo saldo
      const updatedAccount = accRes.data.find(a => a.id === selectedAccount.id);
      if (updatedAccount) setSelectedAccount(updatedAccount);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setTxError(detail.map(e => e.msg).join(', '));
      } else if (typeof detail === 'string') {
        setTxError(detail);
      } else {
        setTxError('Error al procesar la transacción');
      }
    } finally {
      setTxSubmitting(false);
    }
  };

  const getTransactionIcon = (type) => {
    switch(type) {
      case 'deposit': return <ArrowDownLeft size={16} className="text-success" />;
      case 'withdrawal': return <ArrowUpRight size={16} className="text-danger" />;
      case 'confirming_settlement': return <RotateCcw size={16} className="text-purple" />;
      default: return <ArrowLeftRight size={16} className="text-primary" />;
    }
  };

  const getTransactionLabel = (type) => {
    switch(type) {
      case 'deposit': return 'Depósito';
      case 'withdrawal': return 'Retiro';
      case 'confirming_settlement': return 'Vto. Confirming';
      default: return 'Transferencia';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filtrar empresas por grupo
  const filteredCompanies = companies.filter(company => {
    if (selectedGroupFilter === 'all') return true;
    if (selectedGroupFilter === 'none') return !company.group_id;
    return company.group_id === selectedGroupFilter;
  });

  // Agrupar cuentas por empresa (solo empresas filtradas)
  const accountsByCompany = accounts.reduce((acc, account) => {
    const companyId = account.company_id;
    const company = filteredCompanies.find(c => c.id === companyId);
    if (!company) return acc;
    
    if (!acc[companyId]) {
      acc[companyId] = {
        company: account.company,
        accounts: []
      };
    }
    acc[companyId].accounts.push(account);
    return acc;
  }, {});

  // Contar cuentas por grupo
  const getGroupAccountCount = (groupId) => {
    const companyIds = companies
      .filter(c => groupId === 'none' ? !c.group_id : c.group_id === groupId)
      .map(c => c.id);
    return accounts.filter(a => companyIds.includes(a.company_id)).length;
  };

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Cuentas</h1>
          <p>Gestiona las cuentas de las empresas</p>
        </div>
        {isSupervisor() && (
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Nueva Cuenta
          </button>
        )}
      </header>

      {/* Filtro por grupos */}
      <div className="groups-filter">
        <div className="groups-chips">
          <button
            className={`group-chip ${selectedGroupFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedGroupFilter('all')}
          >
            Todos ({accounts.length})
          </button>
          {groups.map(group => (
            <button
              key={group.id}
              className={`group-chip ${selectedGroupFilter === group.id ? 'active' : ''}`}
              onClick={() => setSelectedGroupFilter(group.id)}
            >
              {group.name} ({getGroupAccountCount(group.id)})
            </button>
          ))}
          {companies.some(c => !c.group_id) && (
            <button
              className={`group-chip ${selectedGroupFilter === 'none' ? 'active' : ''}`}
              onClick={() => setSelectedGroupFilter('none')}
            >
              Sin grupo ({getGroupAccountCount('none')})
            </button>
          )}
        </div>
        <div className="expand-controls">
          <button className="btn btn-sm btn-secondary" onClick={expandAll}>Expandir todo</button>
          <button className="btn btn-sm btn-secondary" onClick={collapseAll}>Colapsar todo</button>
        </div>
      </div>

      {Object.keys(accountsByCompany).length === 0 ? (
        <div className="empty-state">
          <Wallet size={64} />
          <h3>No hay cuentas</h3>
          <p>No tienes acceso a ninguna cuenta</p>
        </div>
      ) : (
        Object.values(accountsByCompany).map(({ company, accounts: companyAccounts }) => {
          const totalAvailable = companyAccounts.reduce((sum, acc) => sum + parseFloat(acc.available || 0), 0);
          return (
          <section key={company.id} className="card accounts-section collapsible">
            <h2 
              className="section-title clickable" 
              onClick={() => toggleCompany(company.id)}
            >
              {expandedCompanies[company.id] ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              {company.name}
              <span className="account-count">
                {companyAccounts.length} {companyAccounts.length === 1 ? 'cuenta' : 'cuentas'} · 
                <span className="total-available"> {displayAmount(totalAvailable)}</span>
              </span>
            </h2>
            {expandedCompanies[company.id] && (
              <div className="accounts-table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Moneda</th>
                      <th className="text-right">Saldo</th>
                      <th className="text-right">Disponible</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyAccounts.map((account) => (
                      <tr 
                        key={account.id} 
                        className="clickable-row"
                        onClick={() => viewAccountTransactions(account)}
                      >
                        <td>
                          <div className="account-name-cell">
                            <Wallet size={18} />
                            {account.name}
                          </div>
                        </td>
                        <td>
                          <span className={`account-type-badge ${account.account_type}`}>
                            {getAccountTypeLabel(account.account_type)}
                          </span>
                        </td>
                        <td>{account.currency}</td>
                        <td className="text-right">
                          <span className={`balance ${parseFloat(account.balance) >= 0 ? 'positive' : 'negative'}`}>
                            {displayAmount(account.balance, account.currency)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className="balance positive">
                            {displayAmount(account.available, account.currency)}
                          </span>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="table-actions">
                            <button 
                              className="btn btn-icon" 
                              onClick={() => viewAccountTransactions(account)}
                              title="Ver movimientos"
                            >
                              <Eye size={16} />
                            </button>
                            {isSupervisor() && (
                              <>
                                <button 
                                  className="btn btn-icon" 
                                  onClick={() => openAdjustModal(account)}
                                  title="Ajustar saldo"
                                >
                                  <RefreshCw size={16} />
                                </button>
                                <button 
                                  className="btn btn-icon" 
                                  onClick={() => handleEdit(account)}
                                  title="Editar cuenta"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  className="btn btn-icon danger" 
                                  onClick={() => handleDelete(account)}
                                  title="Eliminar cuenta"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );})
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingAccount ? 'Editar Cuenta' : 'Nueva Cuenta'}</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              {!editingAccount && (
                <div className="form-group">
                  <label htmlFor="company_id">Empresa</label>
                  <select
                    id="company_id"
                    value={formData.company_id}
                    onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar empresa</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="name">Nombre de la cuenta</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Cuenta Principal"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="iban">IBAN (opcional)</label>
                <input
                  type="text"
                  id="iban"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                  placeholder="ES00 0000 0000 0000 0000 0000"
                  maxLength={34}
                />
              </div>

              {!editingAccount && (
                <>
                  <div className="form-group">
                    <label htmlFor="account_type">Tipo de cuenta</label>
                    <select
                      id="account_type"
                      value={formData.account_type}
                      onChange={(e) => setFormData({ ...formData, account_type: e.target.value })}
                    >
                      <option value="corriente">Corriente</option>
                      <option value="credito">Crédito</option>
                      <option value="confirming">Confirming</option>
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="currency">Moneda</label>
                      <select
                        id="currency"
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      >
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>

                    {formData.account_type === 'corriente' && (
                      <div className="form-group">
                        <label htmlFor="initial_balance">Saldo Inicial</label>
                        <input
                          type="number"
                          id="initial_balance"
                          value={formData.initial_balance}
                          onChange={(e) => setFormData({ ...formData, initial_balance: e.target.value })}
                          min="0"
                          step="0.01"
                        />
                      </div>
                    )}
                  </div>

                  {(formData.account_type === 'credito' || formData.account_type === 'confirming') && (
                    <>
                      <div className="form-group">
                        <label htmlFor="credit_limit">
                          {formData.account_type === 'credito' ? 'Límite de Crédito' : 'Límite Concedido'}
                        </label>
                        <input
                          type="number"
                          id="credit_limit"
                          value={formData.credit_limit}
                          onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                          min="0"
                          step="0.01"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor="initial_available">
                          Disponible Inicial (opcional)
                        </label>
                        <input
                          type="number"
                          id="initial_available"
                          value={formData.initial_available}
                          onChange={(e) => setFormData({ ...formData, initial_available: e.target.value })}
                          min="0"
                          step="0.01"
                          placeholder="Dejar vacío = igual al límite"
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {editingAccount && (editingAccount.account_type === 'credito' || editingAccount.account_type === 'confirming') && (
                <>
                  <div className="form-group">
                    <label htmlFor="credit_limit">
                      {editingAccount.account_type === 'credito' ? 'Límite de Crédito' : 'Límite Concedido'}
                    </label>
                    <input
                      type="number"
                      id="credit_limit"
                      value={formData.credit_limit}
                      onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="initial_available">Disponible Actual</label>
                    <input
                      type="number"
                      id="initial_available"
                      value={formData.initial_available}
                      onChange={(e) => setFormData({ ...formData, initial_available: e.target.value })}
                      min="0"
                      step="0.01"
                    />
                  </div>
                </>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingAccount ? 'Guardar' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ajustar Saldo */}
      {showAdjustModal && adjustingAccount && (
        <div className="modal-overlay" onClick={() => setShowAdjustModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ajustar Saldo</h2>
              <button className="btn btn-icon" onClick={() => setShowAdjustModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAdjustSubmit}>
              {adjustError && <div className="error-message">{adjustError}</div>}

              <div className="info-box">
                <strong>{adjustingAccount.company?.name}</strong> - {adjustingAccount.name}<br />
                Saldo actual: <strong>{formatCurrency(adjustingAccount.balance, adjustingAccount.currency)}</strong>
              </div>

              <div className="form-group">
                <label htmlFor="target_balance">Saldo real</label>
                <input
                  type="number"
                  id="target_balance"
                  value={targetBalance}
                  onChange={(e) => setTargetBalance(e.target.value)}
                  step="0.01"
                  required
                />
                {targetBalance && parseFloat(targetBalance) !== parseFloat(adjustingAccount.balance) && (
                  <small className={`adjust-preview ${parseFloat(targetBalance) > parseFloat(adjustingAccount.balance) ? 'positive' : 'negative'}`}>
                    {parseFloat(targetBalance) > parseFloat(adjustingAccount.balance) ? '↑ Ingreso de ' : '↓ Retirada de '}
                    {formatCurrency(Math.abs(parseFloat(targetBalance) - parseFloat(adjustingAccount.balance)), adjustingAccount.currency)}
                  </small>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="adjust_description">Descripción</label>
                <input
                  type="text"
                  id="adjust_description"
                  value={adjustDescription}
                  onChange={(e) => setAdjustDescription(e.target.value)}
                  placeholder="Ej: Comisiones bancarias, Ajuste de saldo..."
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdjustModal(false)}>
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={parseFloat(targetBalance) === parseFloat(adjustingAccount.balance)}
                >
                  Ajustar Saldo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Transacciones de Cuenta */}
      {selectedAccount && !showTxModal && (
        <div className="modal-overlay" onClick={closeTransactionsModal}>
          <div className="modal modal-xlarge" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedAccount.name}</h2>
                <span className="modal-subtitle">
                  {selectedAccount.company?.name} • 
                  {selectedAccount.account_type === 'corriente' && ' Cuenta Corriente'}
                  {selectedAccount.account_type === 'credito' && ' Línea de Crédito'}
                  {selectedAccount.account_type === 'confirming' && ' Confirming'}
                  {' • '}Saldo: {formatCurrency(selectedAccount.balance)} 
                  {' • '}Disponible: {formatCurrency(selectedAccount.available)}
                </span>
              </div>
              <button className="btn btn-icon" onClick={closeTransactionsModal}>
                <X size={20} />
              </button>
            </div>
            
            {/* Botones de acciones */}
            {isSupervisor() && (
              <div className="modal-actions-bar">
                <button className="btn btn-primary" onClick={() => openTxModal('transfer_out')}>
                  <ArrowUpRight size={16} />
                  Transferir desde aquí
                </button>
                <button className="btn btn-secondary" onClick={() => openTxModal('transfer_in')}>
                  <ArrowDownLeft size={16} />
                  Recibir transferencia
                </button>
                <button className="btn btn-success" onClick={() => openTxModal('deposit')}>
                  <ArrowDownLeft size={16} />
                  Depósito
                </button>
                <button className="btn btn-danger" onClick={() => openTxModal('withdrawal')}>
                  <ArrowUpRight size={16} />
                  Retiro
                </button>
              </div>
            )}

            <div className="modal-body">
              {loadingTransactions ? (
                <div className="loading-container">
                  <RefreshCw className="spin" size={32} />
                  <p>Cargando movimientos...</p>
                </div>
              ) : accountTransactions.length === 0 ? (
                <div className="empty-state">
                  <Wallet size={48} />
                  <h3>Sin movimientos</h3>
                  <p>Esta cuenta no tiene transacciones</p>
                </div>
              ) : (
                <div className="transactions-table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th>Origen / Destino</th>
                        <th className="text-right">Monto</th>
                        <th className="text-right">Saldo</th>
                        <th>Operación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountTransactions.map((tx) => {
                        const isOutgoing = tx.from_account_id === selectedAccount.id;
                        const balanceAfter = isOutgoing ? tx.from_balance_after : tx.to_balance_after;
                        const otherAccount = isOutgoing ? tx.to_account : tx.from_account;
                        return (
                          <tr key={tx.id}>
                            <td className="date-cell">{formatDate(tx.transaction_date || tx.created_at)}</td>
                            <td>
                              <div className="transaction-type">
                                {getTransactionIcon(tx.transaction_type)}
                                <span>{getTransactionLabel(tx.transaction_type)}</span>
                              </div>
                            </td>
                            <td>{tx.description || '-'}</td>
                            <td>
                              {otherAccount ? (
                                <div className="account-cell">
                                  <span className="account-name">{otherAccount.name}</span>
                                  <span className="company-name">{otherAccount.company?.name}</span>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="text-right">
                              <span className={`amount ${isOutgoing ? 'negative' : 'positive'}`}>
                                {isOutgoing ? '-' : '+'}{formatCurrency(tx.amount)}
                              </span>
                            </td>
                            <td className="text-right">
                              {balanceAfter !== null && balanceAfter !== undefined ? (
                                <span className={`balance ${parseFloat(balanceAfter) >= 0 ? 'positive' : 'negative'}`}>
                                  {formatCurrency(balanceAfter)}
                                </span>
                              ) : '-'}
                            </td>
                            <td>
                              {tx.operation_id ? (
                                <span className="operation-badge">
                                  <GitBranch size={14} />
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Nueva Transacción desde Extracto */}
      {showTxModal && selectedAccount && (
        <div className="modal-overlay" onClick={() => setShowTxModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {txType === 'transfer_out' && 'Transferir desde esta cuenta'}
                {txType === 'transfer_in' && 'Recibir transferencia'}
                {txType === 'deposit' && 'Nuevo Depósito'}
                {txType === 'withdrawal' && 'Nuevo Retiro'}
              </h2>
              <button className="btn btn-icon" onClick={() => setShowTxModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleTxSubmit}>
              {txError && <div className="error-message">{txError}</div>}

              <div className="info-box">
                <strong>Cuenta:</strong> {selectedAccount.company?.name} - {selectedAccount.name}<br />
                <strong>Saldo actual:</strong> {formatCurrency(selectedAccount.balance)} | 
                <strong> Disponible:</strong> {formatCurrency(selectedAccount.available)}
              </div>

              {/* Transferencia saliente: seleccionar destino */}
              {txType === 'transfer_out' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Empresa destino</label>
                    <select
                      value={toCompanyFilter}
                      onChange={(e) => {
                        setToCompanyFilter(e.target.value);
                        setTxFormData({ ...txFormData, to_account_id: '' });
                      }}
                    >
                      <option value="">Todas las empresas</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cuenta destino</label>
                    <select
                      value={txFormData.to_account_id}
                      onChange={(e) => setTxFormData({ ...txFormData, to_account_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts
                        .filter(a => a.id !== selectedAccount.id)
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

              {/* Transferencia entrante: seleccionar origen */}
              {txType === 'transfer_in' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Empresa origen</label>
                    <select
                      value={toCompanyFilter}
                      onChange={(e) => {
                        setToCompanyFilter(e.target.value);
                        setTxFormData({ ...txFormData, from_account_id: '' });
                      }}
                    >
                      <option value="">Todas las empresas</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cuenta origen</label>
                    <select
                      value={txFormData.from_account_id}
                      onChange={(e) => setTxFormData({ ...txFormData, from_account_id: e.target.value })}
                      required
                    >
                      <option value="">Seleccionar cuenta</option>
                      {accounts
                        .filter(a => a.id !== selectedAccount.id)
                        .filter(a => !toCompanyFilter || a.company_id === toCompanyFilter)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {!toCompanyFilter && `${account.company?.name} - `}{account.name} ({formatCurrency(account.balance)})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Monto</label>
                  <input
                    type="number"
                    value={txFormData.amount}
                    onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                    placeholder="0.00"
                    min="0.01"
                    step="0.01"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={txFormData.transaction_date}
                    onChange={(e) => setTxFormData({ ...txFormData, transaction_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <input
                  type="text"
                  value={txFormData.description}
                  onChange={(e) => setTxFormData({ ...txFormData, description: e.target.value })}
                  placeholder="Descripción del movimiento"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={txSubmitting}>
                  {txSubmitting ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
