import { useEffect, useState } from 'react';
import { Plus, Trash2, Clock, Pencil } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';

const EMPTY_FORM = { name: '', basePrice: '', durationMinutes: '' };


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

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); };
  const openEdit   = (s) => {
    setForm({ name: s.name, basePrice: String(s.basePrice), durationMinutes: String(s.durationMinutes) });
    setEditId(s.id); setModalOpen(true);
  };

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
        <Button onClick={openCreate} className="self-start sm:self-auto">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services.map((s, i) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group"
            >
              <img src="/logonailcontrol.png" alt="" className="w-11 h-11 object-contain mb-4" />
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
                  onClick={() => openEdit(s)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-blush-50 hover:text-blush-600 transition-colors"
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} /> Eliminar
                </button>
              </div>
            </div>
          ))}

          {services.length === 0 && (
            <p className="col-span-full text-center text-sm text-gray-400 py-8">
              No hay servicios registrados
            </p>
          )}

          {/* Add card */}
          <button
            onClick={openCreate}
            className="rounded-2xl border-2 border-dashed border-blush-200 p-5 flex flex-col items-center justify-center gap-2 text-blush-300 hover:border-blush-400 hover:text-blush-500 hover:bg-blush-50 transition-all min-h-[180px]"
          >
            <Plus size={22} strokeWidth={1.5} />
            <span className="text-xs font-medium">Agregar servicio</span>
          </button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Servicio' : 'Nuevo Servicio'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre del Servicio *" id="svc-name" value={form.name} required placeholder="Ej: Manicure Semipermanente"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Precio Base (COP) *" id="svc-price" type="number" min="0" step="1000" value={form.basePrice} required placeholder="35000"
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
