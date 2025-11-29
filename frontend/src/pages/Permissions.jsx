import { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, Plus, X, Trash2, Check } from 'lucide-react';

const Permissions = () => {
  const [permissions, setPermissions] = useState([]);
  const [users, setUsers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    user_id: '',
    account_id: '',
    can_view: true,
    can_transfer: false
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [permissionsRes, usersRes, accountsRes] = await Promise.all([
        api.get('/permissions/'),
        api.get('/users/'),
        api.get('/accounts/')
      ]);
      setPermissions(permissionsRes.data);
      setUsers(usersRes.data.filter(u => u.role !== 'supervisor'));
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
      await api.post('/permissions/', formData);
      setShowModal(false);
      setFormData({ user_id: '', account_id: '', can_view: true, can_transfer: false });
      fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear permiso');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este permiso?')) return;

    try {
      await api.delete(`/permissions/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const handleToggleTransfer = async (permission) => {
    try {
      await api.patch(`/permissions/${permission.id}`, {
        can_transfer: !permission.can_transfer
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al actualizar');
    }
  };

  // Agrupar permisos por usuario
  const permissionsByUser = permissions.reduce((acc, perm) => {
    const userId = perm.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        user: perm.user,
        permissions: []
      };
    }
    acc[userId].permissions.push(perm);
    return acc;
  }, {});

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Permisos</h1>
          <p>Gestiona el acceso de usuarios a las cuentas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} />
          Asignar Permiso
        </button>
      </header>

      {Object.keys(permissionsByUser).length === 0 ? (
        <div className="empty-state">
          <Shield size={64} />
          <h3>No hay permisos asignados</h3>
          <p>Asigna permisos a usuarios para que puedan ver cuentas</p>
        </div>
      ) : (
        Object.values(permissionsByUser).map(({ user, permissions }) => (
          <section key={user.id} className="card permissions-section">
            <div className="section-header">
              <div className="user-cell">
                <div className="user-avatar small">
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3>{user.full_name}</h3>
                  <span className="text-muted">{user.email}</span>
                </div>
              </div>
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Cuenta</th>
                  <th>Puede Ver</th>
                  <th>Puede Transferir</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.id}>
                    <td>{perm.account?.company?.name}</td>
                    <td>{perm.account?.name}</td>
                    <td>
                      <Check className="text-green" size={18} />
                    </td>
                    <td>
                      <button
                        className={`btn btn-toggle ${perm.can_transfer ? 'active' : ''}`}
                        onClick={() => handleToggleTransfer(perm)}
                      >
                        {perm.can_transfer ? 'Sí' : 'No'}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-icon danger"
                        onClick={() => handleDelete(perm.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Asignar Permiso</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}

              <div className="form-group">
                <label htmlFor="user_id">Usuario</label>
                <select
                  id="user_id"
                  value={formData.user_id}
                  onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar usuario</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="account_id">Cuenta</label>
                <select
                  id="account_id"
                  value={formData.account_id}
                  onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  required
                >
                  <option value="">Seleccionar cuenta</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.company?.name} - {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.can_transfer}
                    onChange={(e) => setFormData({ ...formData, can_transfer: e.target.checked })}
                  />
                  <span>Permitir transferencias</span>
                </label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Asignar Permiso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Permissions;
