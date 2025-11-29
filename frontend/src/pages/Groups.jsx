import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit, Trash2, X, FolderTree, RefreshCw } from 'lucide-react';

const Groups = () => {
  const { isSupervisor } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/groups/');
      setGroups(response.data);
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
      if (editingGroup) {
        await api.patch(`/groups/${editingGroup.id}`, formData);
      } else {
        await api.post('/groups/', formData);
      }
      setShowModal(false);
      setEditingGroup(null);
      setFormData({ name: '', description: '' });
      fetchGroups();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map(e => e.msg).join(', '));
      } else if (typeof detail === 'string') {
        setError(detail);
      } else {
        setError('Error al guardar grupo');
      }
    }
  };

  const handleEdit = (group) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      description: group.description || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (group) => {
    if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return;

    try {
      await api.delete(`/groups/${group.id}`);
      fetchGroups();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar grupo');
    }
  };

  const openNewModal = () => {
    setEditingGroup(null);
    setFormData({ name: '', description: '' });
    setShowModal(true);
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
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1>Grupos</h1>
          <p>Gestiona los grupos de empresas</p>
        </div>
        {isSupervisor() && (
          <button className="btn btn-primary" onClick={openNewModal}>
            <Plus size={18} />
            Nuevo Grupo
          </button>
        )}
      </header>

      {groups.length === 0 ? (
        <div className="empty-state">
          <FolderTree size={48} />
          <h3>No hay grupos</h3>
          <p>Crea el primer grupo para organizar tus empresas</p>
          {isSupervisor() && (
            <button className="btn btn-primary" onClick={openNewModal}>
              <Plus size={18} />
              Crear Grupo
            </button>
          )}
        </div>
      ) : (
        <div className="cards-grid">
          {groups.map((group) => (
            <div key={group.id} className="card group-card">
              <div className="card-header">
                <div className="group-icon">
                  <FolderTree size={24} />
                </div>
                <h3>{group.name}</h3>
              </div>
              <p className="group-description">{group.description || 'Sin descripción'}</p>
              {isSupervisor() && (
                <div className="card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(group)}>
                    <Edit size={16} />
                    Editar
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(group)}>
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}</h2>
              <button className="btn btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="name">Nombre del Grupo</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Ej: Grupo Alimentación"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Descripción</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descripción opcional del grupo"
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGroup ? 'Guardar' : 'Crear Grupo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
