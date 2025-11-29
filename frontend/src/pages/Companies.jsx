import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, Edit, Trash2, X, Eye, FolderTree } from 'lucide-react';

const Companies = () => {
  const { isSupervisor } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', group_id: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [companiesRes, groupsRes] = await Promise.all([
        api.get('/companies/'),
        api.get('/groups/')
      ]);
      setCompanies(companiesRes.data);
      setGroups(groupsRes.data);
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
      const dataToSend = {
        name: formData.name,
        description: formData.description,
        group_id: formData.group_id || null
      };
      
      if (editingCompany) {
        await api.patch(`/companies/${editingCompany.id}`, dataToSend);
      } else {
        await api.post('/companies/', dataToSend);
      }
      setShowModal(false);
      setFormData({ name: '', description: '', group_id: '' });
      setEditingCompany(null);
      fetchData();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(e => e.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Error al guardar');
      }
    }
  };

  const handleEdit = (company) => {
    setEditingCompany(company);
    setFormData({ 
      name: company.name, 
      description: company.description || '',
      group_id: company.group_id || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Estás seguro de desactivar esta empresa?')) return;

    try {
      await api.delete(`/companies/${id}`);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar');
    }
  };

  const openNewModal = () => {
    setEditingCompany(null);
    setFormData({ name: '', description: '', group_id: '' });
    setShowModal(true);
  };

  const getGroupName = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : null;
  };

  if (loading) {
    return <div className="loading-container"><p>Cargando...</p></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Empresas</h1>
          <p>Gestiona las empresas del sistema</p>
        </div>
        {isSupervisor() && (
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Nueva Empresa
          </button>
        )}
      </header>

      <div className="companies-grid">
        {companies.length === 0 ? (
          <div className="empty-state">
            <Building2 size={64} />
            <h3>No hay empresas</h3>
            <p>No tienes acceso a ninguna empresa</p>
          </div>
        ) : (
          companies.map((company) => (
            <div key={company.id} className="company-card">
              <div className="company-header">
                <Building2 size={24} />
                <h3>{company.name}</h3>
              </div>
              {company.group_id && (
                <div className="company-group">
                  <FolderTree size={14} />
                  <span>{getGroupName(company.group_id)}</span>
                </div>
              )}
              {company.description && (
                <p className="company-description">{company.description}</p>
              )}
              <div className="company-stats">
                <span>{company.accounts?.length || 0} cuentas</span>
              </div>
              <div className="company-footer">
                <Link to={`/companies/${company.id}`} className="btn btn-secondary btn-small">
                  <Eye size={16} />
                  Ver Dashboard
                </Link>
                {isSupervisor() && (
                  <div className="company-actions">
                    <button className="btn btn-icon" onClick={() => handleEdit(company)}>
                      <Edit size={16} />
                    </button>
                    <button className="btn btn-icon danger" onClick={() => handleDelete(company.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCompany ? 'Editar Empresa' : 'Nueva Empresa'}</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="name">Nombre</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="group_id">Grupo (opcional)</label>
                <select
                  id="group_id"
                  value={formData.group_id}
                  onChange={(e) => setFormData({ ...formData, group_id: e.target.value })}
                >
                  <option value="">Sin grupo</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingCompany ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Companies;
