import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, Edit, Trash2, X, Eye, FolderTree } from 'lucide-react';

const Companies = () => {
  const { isSupervisor } = useAuth();
  const [searchParams] = useSearchParams();
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', group_id: '' });
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '' });
  const [error, setError] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('all');

  useEffect(() => {
    // Leer grupo de la URL si existe
    const groupFromUrl = searchParams.get('group');
    if (groupFromUrl) {
      setSelectedGroupFilter(groupFromUrl);
    }
    fetchData();
  }, [searchParams]);

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

  // Funciones para empresas
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
    setError('');
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
    setError('');
    setShowModal(true);
  };

  // Funciones para grupos
  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingGroup) {
        await api.patch(`/groups/${editingGroup.id}`, groupFormData);
      } else {
        await api.post('/groups/', groupFormData);
      }
      setShowGroupModal(false);
      setGroupFormData({ name: '', description: '' });
      setEditingGroup(null);
      fetchData();
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

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setGroupFormData({ 
      name: group.name, 
      description: group.description || ''
    });
    setError('');
    setShowGroupModal(true);
  };

  const handleDeleteGroup = async (group) => {
    const companiesInGroup = companies.filter(c => c.group_id === group.id);
    if (companiesInGroup.length > 0) {
      alert(`No se puede eliminar: hay ${companiesInGroup.length} empresa(s) en este grupo`);
      return;
    }
    
    if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return;

    try {
      await api.delete(`/groups/${group.id}`);
      if (selectedGroupFilter === group.id) {
        setSelectedGroupFilter('all');
      }
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Error al eliminar grupo');
    }
  };

  const openNewGroupModal = () => {
    setEditingGroup(null);
    setGroupFormData({ name: '', description: '' });
    setError('');
    setShowGroupModal(true);
  };

  const getGroupName = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : null;
  };

  // Filtrar empresas
  const filteredCompanies = selectedGroupFilter === 'all' 
    ? companies 
    : selectedGroupFilter === 'none'
      ? companies.filter(c => !c.group_id)
      : companies.filter(c => c.group_id === selectedGroupFilter);

  // Contar empresas por grupo
  const getCompanyCount = (groupId) => {
    return companies.filter(c => c.group_id === groupId).length;
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
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={openNewGroupModal}>
              <FolderTree size={18} />
              Nuevo Grupo
            </button>
            <button className="btn btn-primary" onClick={openNewModal}>
              <Plus size={18} />
              Nueva Empresa
            </button>
          </div>
        )}
      </header>

      {/* Filtro de grupos */}
      {groups.length > 0 && (
        <div className="groups-filter">
          <div className="groups-chips">
            <button 
              className={`group-chip ${selectedGroupFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedGroupFilter('all')}
            >
              Todos ({companies.length})
            </button>
            {groups.map((group) => (
              <div key={group.id} className="group-chip-wrapper">
                <button 
                  className={`group-chip ${selectedGroupFilter === group.id ? 'active' : ''}`}
                  onClick={() => setSelectedGroupFilter(group.id)}
                >
                  <FolderTree size={14} />
                  {group.name} ({getCompanyCount(group.id)})
                </button>
                {isSupervisor() && (
                  <div className="group-chip-actions">
                    <button 
                      className="btn btn-icon btn-tiny"
                      onClick={(e) => { e.stopPropagation(); handleEditGroup(group); }}
                      title="Editar grupo"
                    >
                      <Edit size={12} />
                    </button>
                    <button 
                      className="btn btn-icon btn-tiny danger"
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group); }}
                      title="Eliminar grupo"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button 
              className={`group-chip muted ${selectedGroupFilter === 'none' ? 'active' : ''}`}
              onClick={() => setSelectedGroupFilter('none')}
            >
              Sin grupo ({companies.filter(c => !c.group_id).length})
            </button>
          </div>
        </div>
      )}

      <div className="companies-grid">
        {filteredCompanies.length === 0 ? (
          <div className="empty-state">
            <Building2 size={64} />
            <h3>No hay empresas</h3>
            <p>{selectedGroupFilter !== 'all' ? 'No hay empresas en este grupo' : 'No tienes acceso a ninguna empresa'}</p>
          </div>
        ) : (
          filteredCompanies.map((company) => (
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

      {/* Modal Empresa */}
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

      {/* Modal Grupo */}
      {showGroupModal && (
        <div className="modal-overlay" onClick={() => setShowGroupModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGroup ? 'Editar Grupo' : 'Nuevo Grupo'}</h2>
              <button className="btn btn-icon" onClick={() => setShowGroupModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleGroupSubmit}>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label htmlFor="group-name">Nombre del grupo</label>
                <input
                  type="text"
                  id="group-name"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  placeholder="Ej: Grupo Hostelería"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="group-description">Descripción</label>
                <textarea
                  id="group-description"
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  placeholder="Descripción del grupo..."
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>
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

export default Companies;
