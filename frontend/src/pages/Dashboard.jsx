import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Wallet,
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accountsRes, transactionsRes] = await Promise.all([
        api.get('/accounts/'),
        api.get('/transactions/?limit=10')
      ]);
      setAccounts(accountsRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + parseFloat(acc.balance),
    0
  );

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
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="text-green" />;
      case 'withdrawal':
        return <ArrowUpRight className="text-red" />;
      default:
        return <RefreshCw className="text-blue" />;
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

  return (
    <div className="dashboard">
      <header className="page-header">
        <div>
          <h1>Bienvenido, {user?.full_name}</h1>
          <p>Resumen de tus finanzas</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchData}>
          <RefreshCw size={18} />
          Actualizar
        </button>
      </header>

      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Balance Total</span>
            <span className="stat-value">{formatCurrency(totalBalance)}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Wallet size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Cuentas</span>
            <span className="stat-value">{accounts.length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Empresas</span>
            <span className="stat-value">
              {new Set(accounts.map(a => a.company_id)).size}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="card-header">
            <h2>Cuentas</h2>
            <Link to="/accounts" className="btn btn-text">Ver todas</Link>
          </div>
          <div className="accounts-list">
            {accounts.length === 0 ? (
              <p className="empty-message">No tienes cuentas asignadas</p>
            ) : (
              accounts.slice(0, 5).map((account) => (
                <div key={account.id} className="account-item">
                  <div className="account-info">
                    <span className="account-name">{account.name}</span>
                    <span className="account-company">{account.company?.name}</span>
                  </div>
                  <span className="account-balance">
                    {formatCurrency(account.balance, account.currency)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Últimas Transacciones</h2>
            <Link to="/transactions" className="btn btn-text">Ver todas</Link>
          </div>
          <div className="transactions-list">
            {transactions.length === 0 ? (
              <p className="empty-message">No hay transacciones</p>
            ) : (
              transactions.map((tx) => (
                <div key={tx.id} className="transaction-item">
                  <div className="transaction-icon">
                    {getTransactionIcon(tx.transaction_type)}
                  </div>
                  <div className="transaction-info">
                    <span className="transaction-desc">
                      {tx.description || tx.transaction_type}
                    </span>
                    <span className="transaction-date">{formatDate(tx.created_at)}</span>
                  </div>
                  <span className={`transaction-amount ${
                    tx.transaction_type === 'deposit' ? 'positive' : 
                    tx.transaction_type === 'withdrawal' ? 'negative' : ''
                  }`}>
                    {tx.transaction_type === 'deposit' ? '+' : 
                     tx.transaction_type === 'withdrawal' ? '-' : ''}
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
