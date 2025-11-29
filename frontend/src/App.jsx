import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Companies from './pages/Companies';
import CompanyDashboard from './pages/CompanyDashboard';
import Accounts from './pages/Accounts';
import Transactions from './pages/Transactions';
import UsersPage from './pages/Users';
import Permissions from './pages/Permissions';
import Operations from './pages/Operations';
import './index.css';

const PrivateRoute = ({ children, requireSupervisor = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requireSupervisor && user.role !== 'supervisor') {
    return <Navigate to="/" />;
  }

  return <Layout>{children}</Layout>;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  if (user) {
    return <Navigate to="/" />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <Register />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/companies"
            element={
              <PrivateRoute>
                <Companies />
              </PrivateRoute>
            }
          />
          <Route
            path="/companies/:companyId"
            element={
              <PrivateRoute>
                <CompanyDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/accounts"
            element={
              <PrivateRoute>
                <Accounts />
              </PrivateRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <PrivateRoute>
                <Transactions />
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute requireSupervisor>
                <UsersPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/permissions"
            element={
              <PrivateRoute requireSupervisor>
                <Permissions />
              </PrivateRoute>
            }
          />
          <Route
            path="/operations"
            element={
              <PrivateRoute requireSupervisor>
                <Operations />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
