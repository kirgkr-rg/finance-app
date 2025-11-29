import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import {
  Building2,
  Wallet,
  CreditCard,
  FileCheck,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  RefreshCw,
  X,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw
} from 'lucide-react';

const CompanyDashboard = () => {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [accountTransactions, setAccountTransactions] = useState([]);
  const [loadingAccountTx, setLoadingAccountTx] = useState(false);

  useEffect(() => {
    fetchData();
  }, [companyId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [companyRes, accountsRes, transactionsRes] = await Promise.all([
        api.get(`/companies/${companyId}`),
        api.get(`/accounts/?company_id=${companyId}`),
        api.get(`/transactions/?limit=50`)
      ]);
      setCompany(companyRes.data);
      setAccounts(accountsRes.data);
      
      // Filtrar transacciones de esta empresa
      const companyAccountIds = accountsRes.data.map(a => a.id);
      const filtered = transactionsRes.data.filter(tx => 
        companyAccountIds.includes(tx.from_account_id) || 
        companyAccountIds.includes(tx.to_account_id)
      );
      setTransactions(filtered.slice(0, 10));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calcular totales por tipo
  const calculateTotals = () => {
    const totals = {
      corriente: { saldo: 0, disponible: 0, count: 0 },
      credito: { saldo: 0, disponible: 0, limite: 0, count: 0 },
      confirming: { saldo: 0, disponible: 0, limite: 0, count: 0 },
      total: { saldo: 0, disponible: 0 }
    };

    accounts.forEach(acc => {
      const balance = parseFloat(acc.balance);
      const available = parseFloat(acc.available);
      const limit = parseFloat(acc.credit_limit || 0);

      if (acc.account_type === 'corriente') {
        totals.corriente.saldo += balance;
        totals.corriente.disponible += available;
        totals.corriente.count++;
        // Para corriente, sumar balance al total
        totals.total.saldo += balance;
      } else if (acc.account_type === 'credito') {
        totals.credito.saldo += balance;
        totals.credito.disponible += available;
        totals.credito.limite += limit;
        totals.credito.count++;
        // Para crédito, sumar disponible al total
        totals.total.saldo += available;
      } else if (acc.account_type === 'confirming') {
        totals.confirming.saldo += balance;
        totals.confirming.disponible += available;
        totals.confirming.limite += limit;
        totals.confirming.count++;
        // Para confirming, sumar disponible al total
        totals.total.saldo += available;
      }

      totals.total.disponible += available;
    });

    return totals;
  };

  const viewAccountTransactions = async (account) => {
    setSelectedAccount(account);
    setLoadingAccountTx(true);
    try {
      const response = await api.get(`/transactions/?account_id=${account.id}&limit=50`);
      setAccountTransactions(response.data);
    } catch (error) {
      console.error('Error:', error);
      setAccountTransactions([]);
    } finally {
      setLoadingAccountTx(false);
    }
  };

  const closeAccountModal = () => {
    setSelectedAccount(null);
    setAccountTransactions([]);
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="text-green" size={18} />;
      case 'withdrawal':
        return <ArrowUpRight className="text-red" size={18} />;
      case 'confirming_settlement':
        return <RotateCcw className="text-purple" size={18} />;
      default:
        return <RefreshCw className="text-blue" size={18} />;
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

  if (loading) {
    return (
      <div className="loading-container">
        <RefreshCw className="spin" size={48} />
        <p>Cargando...</p>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="page">
        <div className="empty-state">
          <Building2 size={64} />
          <h3>Empresa no encontrada</h3>
          <Link to="/companies" className="btn btn-primary">Volver a Empresas</Link>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/companies" className="back-link">
            <ArrowLeft size={18} />
            Volver a Empresas
          </Link>
          <h1>{company.name}</h1>
          <p>{company.description || 'Dashboard financiero'}</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

      {/* Resumen General */}
      <div className="dashboard-summary">
        <div className="summary-card-large primary">
          <div className="summary-icon">
            <TrendingUp size={32} />
          </div>
          <div className="summary-content">
            <span className="summary-label">Posición Total</span>
            <span className={`summary-value ${totals.total.saldo >= 0 ? '' : 'negative'}`}>
              {formatCurrency(totals.total.saldo)}
            </span>
            <span className="summary-sublabel">
              Disponible: {formatCurrency(totals.total.disponible)}
            </span>
          </div>
        </div>
      </div>

      {/* Desglose por Tipo */}
      <div className="stats-grid three-cols">
        {/* Cuentas Corrientes */}
        <div className="stat-card-detailed">
          <div className="stat-header">
            <div className="stat-icon corriente">
              <Wallet size={24} />
            </div>
            <span className="stat-type">Cuentas Corrientes</span>
          </div>
          <div className="stat-body">
            <div className="stat-row">
              <span className="stat-label">Saldo</span>
              <span className={`stat-value ${totals.corriente.saldo >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(totals.corriente.saldo)}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Disponible</span>
              <span className="stat-value">{formatCurrency(totals.corriente.disponible)}</span>
            </div>
            <div className="stat-row muted">
              <span className="stat-label">Nº Cuentas</span>
              <span className="stat-value">{totals.corriente.count}</span>
            </div>
          </div>
        </div>

        {/* Cuentas de Crédito */}
        <div className="stat-card-detailed">
          <div className="stat-header">
            <div className="stat-icon credito">
              <CreditCard size={24} />
            </div>
            <span className="stat-type">Líneas de Crédito</span>
          </div>
          <div className="stat-body">
            <div className="stat-row">
              <span className="stat-label">Dispuesto</span>
              <span className={`stat-value ${totals.credito.saldo >= 0 ? '' : 'negative'}`}>
                {formatCurrency(Math.abs(totals.credito.saldo))}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Disponible</span>
              <span className="stat-value positive">{formatCurrency(totals.credito.disponible)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Límite Total</span>
              <span className="stat-value">{formatCurrency(totals.credito.limite)}</span>
            </div>
            <div className="stat-row muted">
              <span className="stat-label">Nº Cuentas</span>
              <span className="stat-value">{totals.credito.count}</span>
            </div>
          </div>
        </div>

        {/* Confirming */}
        <div className="stat-card-detailed">
          <div className="stat-header">
            <div className="stat-icon confirming">
              <FileCheck size={24} />
            </div>
            <span className="stat-type">Confirming</span>
          </div>
          <div className="stat-body">
            <div className="stat-row">
              <span className="stat-label">Emitido</span>
              <span className={`stat-value ${totals.confirming.saldo >= 0 ? '' : 'negative'}`}>
                {formatCurrency(Math.abs(totals.confirming.saldo))}
              </span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Disponible</span>
              <span className="stat-value positive">{formatCurrency(totals.confirming.disponible)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Concedido</span>
              <span className="stat-value">{formatCurrency(totals.confirming.limite)}</span>
            </div>
            <div className="stat-row muted">
              <span className="stat-label">Nº Cuentas</span>
              <span className="stat-value">{totals.confirming.count}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalle de Cuentas */}
      <section className="card">
        <div className="card-header">
          <h2>Detalle de Cuentas</h2>
        </div>
        {accounts.length === 0 ? (
          <p className="empty-message">No hay cuentas en esta empresa</p>
        ) : (
          <div className="accounts-table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th className="text-right">Saldo</th>
                  <th className="text-right">Límite</th>
                  <th className="text-right">Disponible</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} onClick={() => viewAccountTransactions(account)} className="clickable-row">
                    <td>
                      <div className="account-name-cell">
                        {account.account_type === 'corriente' && <Wallet size={18} />}
                        {account.account_type === 'credito' && <CreditCard size={18} />}
                        {account.account_type === 'confirming' && <FileCheck size={18} />}
                        {account.name}
                      </div>
                    </td>
                    <td>
                      <span className={`account-type-badge ${account.account_type}`}>
                        {account.account_type === 'corriente' && 'Corriente'}
                        {account.account_type === 'credito' && 'Crédito'}
                        {account.account_type === 'confirming' && 'Confirming'}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`balance ${parseFloat(account.balance) >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(account.balance, account.currency)}
                      </span>
                    </td>
                    <td className="text-right">
                      {account.account_type !== 'corriente' 
                        ? formatCurrency(account.credit_limit, account.currency)
                        : '-'
                      }
                    </td>
                    <td className="text-right">
                      <span className="balance positive">
                        {formatCurrency(account.available, account.currency)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Últimos Movimientos */}
      <section className="card">
        <div className="card-header">
          <h2>Últimos Movimientos</h2>
          <Link to="/transactions" className="btn btn-text">Ver todos</Link>
        </div>
        {transactions.length === 0 ? (
          <p className="empty-message">No hay movimientos</p>
        ) : (
          <div className="transactions-list">
            {transactions.map((tx) => {
              const isOutgoing = accounts.some(a => a.id === tx.from_account_id);
              const isIncoming = accounts.some(a => a.id === tx.to_account_id);
              
              return (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-icon">
                    {isOutgoing && !isIncoming ? (
                      <TrendingDown className="text-red" size={20} />
                    ) : isIncoming && !isOutgoing ? (
                      <TrendingUp className="text-green" size={20} />
                    ) : (
                      <RefreshCw className="text-blue" size={20} />
                    )}
                  </div>
                  <div className="transaction-info">
                    <span className="transaction-desc">
                      {tx.description || tx.transaction_type}
                    </span>
                    <span className="transaction-accounts">
                      {tx.from_account?.name || 'Externo'} → {tx.to_account?.name || 'Externo'}
                    </span>
                  </div>
                  <div className="transaction-right">
                    <span className={`transaction-amount ${isOutgoing && !isIncoming ? 'negative' : 'positive'}`}>
                      {isOutgoing && !isIncoming ? '-' : '+'}
                      {formatCurrency(tx.amount)}
                    </span>
                    <span className="transaction-date">{formatDate(tx.created_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal de Transacciones de Cuenta */}
      {selectedAccount && (
        <div className="modal-overlay" onClick={closeAccountModal}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedAccount.name}</h2>
                <span className="modal-subtitle">
                  {selectedAccount.account_type === 'corriente' && 'Cuenta Corriente'}
                  {selectedAccount.account_type === 'credito' && 'Línea de Crédito'}
                  {selectedAccount.account_type === 'confirming' && 'Confirming'}
                  {' • '}Saldo: {formatCurrency(selectedAccount.balance)} 
                  {' • '}Disponible: {formatCurrency(selectedAccount.available)}
                </span>
              </div>
              <button className="btn btn-icon" onClick={closeAccountModal}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {loadingAccountTx ? (
                <div className="loading-container">
                  <RefreshCw className="spin" size={32} />
                  <p>Cargando transacciones...</p>
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
                        <th>Tipo</th>
                        <th>Descripción</th>
                        <th>Origen</th>
                        <th>Destino</th>
                        <th className="text-right">Monto</th>
                        <th className="text-right">Saldo</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountTransactions.map((tx) => {
                        const isOutgoing = tx.from_account_id === selectedAccount.id;
                        const balanceAfter = isOutgoing ? tx.from_balance_after : tx.to_balance_after;
                        return (
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
                            <td className="date-cell">{formatDate(tx.created_at)}</td>
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
    </div>
  );
};

export default CompanyDashboard;
