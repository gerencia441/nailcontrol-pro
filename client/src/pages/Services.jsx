import { useEffect, useState } from 'react';
import { Plus, Trash2, Clock, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';
import {
  SERVICE_CATEGORIES, SUBCATEGORIES_BY_CATEGORY, groupServicesByCategory,
} from '../lib/serviceCategories.js';

const EMPTY_FORM = { name: '', basePrice: '', durationMinutes: '', category: 'MANICURE', subcategory: '' };


const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

export default function Services() {
  const [services,  setServices]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);

  const load = () => api.getServices().then(setServices).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  // Al crear desde una sección, el servicio nace en esa categoría.
  const openCreate = (category = 'MANICURE') => {
    setForm({ ...EMPTY_FORM, category }); setEditId(null); setModalOpen(true);
  };
  const openEdit   = (s) => {
    setForm({
      name: s.name, basePrice: String(s.basePrice), durationMinutes: String(s.durationMinutes),
      category: s.category || 'MANICURE', subcategory: s.subcategory || '',
    });
    setEditId(s.id); setModalOpen(true);
  };

  const subcategoryOptions = SUBCATEGORIES_BY_CATEGORY[form.category] || [];
  const grouped = groupServicesByCategory(services);
  const emptyCategories = SERVICE_CATEGORIES.filter((c) => !grouped.some((g) => g.value === c.value));

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) { await api.updateService(editId, form); }
      else        { await api.createService(form); }
      setModalOpen(false); load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await api.deleteService(id); load(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{services.length} servicios disponibles</p>
        </div>
        <Button onClick={() => openCreate()} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nuevo Servicio
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-44 animate-pulse border border-gray-100 shadow-card" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {services.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">No hay servicios registrados</p>
          )}

          {grouped.map((cat) => (
            <section key={cat.value} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blush-50 flex items-center justify-center">
                  <cat.Icon size={16} className="text-blush-500" />
                </span>
                <h2 className="section-title">{cat.label}</h2>
                <span className="text-xs text-gray-400">{cat.services.length}</span>
              </div>
              {cat.groups.map((g) => (
                <div key={g.subcategory || 'none'} className="space-y-2">
                  {g.label && (
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{g.label}</p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {g.services.map((s) => (
                      <ServiceCard key={s.id} service={s} Icon={cat.Icon}
                        onEdit={() => openEdit(s)} onDelete={() => handleDelete(s.id)} />
                    ))}
                  </div>
                </div>
              ))}
              <AddButton onClick={() => openCreate(cat.value)}>Agregar servicio de {cat.label.toLowerCase()}</AddButton>
            </section>
          ))}

          {/* Categorías que aún no tienen servicios: acceso directo para crear el primero */}
          {emptyCategories.length > 0 && (
            <section className="space-y-3">
              <h2 className="section-title">Categorías sin servicios</h2>
              <div className="flex flex-wrap gap-2">
                {emptyCategories.map((c) => (
                  <AddButton key={c.value} onClick={() => openCreate(c.value)}>
                    <c.Icon size={14} /> {c.label}
                  </AddButton>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Servicio' : 'Nuevo Servicio'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre del Servicio *" id="svc-name" value={form.name} required placeholder="Ej: Manicure Semipermanente"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Categoría *" id="svc-category" value={form.category} required
              onChange={(e) => setForm({ ...form, category: e.target.value, subcategory: '' })}>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
            {subcategoryOptions.length > 0 && (
              <Select label="Subcategoría" id="svc-subcategory" value={form.subcategory}
                onChange={(e) => setForm({ ...form, subcategory: e.target.value })}>
                <option value="">Sin subcategoría</option>
                {subcategoryOptions.map((sc) => (
                  <option key={sc.value} value={sc.value}>{sc.label}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Precio Base (COP) *" id="svc-price" type="number" min="0" step="1" value={form.basePrice} required placeholder="35000"
              onChange={(e) => setForm({ ...form, basePrice: e.target.value })} />
            <Input label="Duración (minutos) *" id="svc-duration" type="number" min="1" value={form.durationMinutes} required placeholder="60"
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2 justify-between">
            {editId && (
              <Button type="button" variant="danger"
                onClick={() => { if (confirm('¿Eliminar este servicio?')) { handleDelete(editId); setModalOpen(false); } }}>
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function ServiceCard({ service: s, Icon, onEdit, onDelete }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
      <span className="w-11 h-11 rounded-2xl bg-blush-50 flex items-center justify-center mb-4">
        <Icon size={20} className="text-blush-500" />
      </span>
      <h3 className="font-semibold text-gray-800 text-sm leading-snug mb-3">{s.name}</h3>
      <div className="space-y-1.5 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Precio base</span>
          <span className="text-sm font-bold text-blush-600">{formatCurrency(s.basePrice)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-gray-300" />
          <span className="text-xs text-gray-400">{s.durationMinutes} minutos</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 border-t border-gray-50 pt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-blush-50 hover:text-blush-600 transition-colors"
        >
          <Pencil size={12} /> Editar
        </button>
        <button
          onClick={onDelete}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <Trash2 size={12} /> Eliminar
        </button>
      </div>
    </div>
  );
}

function AddButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-blush-200 text-xs font-medium text-blush-400 hover:border-blush-400 hover:text-blush-500 hover:bg-blush-50 transition-all">
      <Plus size={14} /> {children}
    </button>
  );
}
