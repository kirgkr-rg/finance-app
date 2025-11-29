import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FolderTree,
  Building2,
  Wallet,
  ArrowLeftRight,
  Users,
  Shield,
  GitBranch,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

const Layout = ({ children }) => {
  const { user, logout, isSupervisor } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/companies', icon: Building2, label: 'Empresas' },
    { path: '/accounts', icon: Wallet, label: 'Cuentas' },
    { path: '/transactions', icon: ArrowLeftRight, label: 'Transacciones' },
  ];

  if (isSupervisor()) {
    navItems.push(
      { path: '/operations', icon: GitBranch, label: 'Operaciones' },
      { path: '/groups', icon: FolderTree, label: 'Grupos' },
      { path: '/users', icon: Users, label: 'Usuarios' },
      { path: '/permissions', icon: Shield, label: 'Permisos' }
    );
  }

  return (
    <div className="layout">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <Wallet size={32} />
          <h2>Finance App</h2>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.full_name}</span>
              <span className="user-role">
                {user?.role === 'supervisor' ? 'Supervisor' : 'Usuario'}
              </span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
