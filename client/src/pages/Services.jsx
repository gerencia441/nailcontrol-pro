import { useEffect, useState } from 'react';
import { Plus, Trash2, Clock, DollarSign } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';

const EMPTY_FORM = { name: '', basePrice: '', durationMinutes: '' };

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(v);

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.getServices().then(setServices).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); };
  const openEdit   = (s) => {
    setForm({ name: s.name, basePrice: String(s.basePrice), durationMinutes: String(s.durationMinutes) });
    setEditId(s.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) { await api.updateService(editId, form); }
      else        { await api.createService(form); }
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este servicio?')) return;
    try { await api.deleteService(id); load(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Servicios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{services.length} registrados</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nuevo Servicio
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : services.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay servicios registrados.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 table-header">Servicio</th>
                <th className="text-left px-5 py-3 table-header">Precio Base</th>
                <th className="text-left px-5 py-3 table-header">Duración</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openEdit(s)}
                >
                  <td className="px-5 py-3 font-semibold text-gray-800">{s.name}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <DollarSign size={13} />
                      {formatCurrency(s.basePrice)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-500">
                      <Clock size={13} />
                      {s.durationMinutes} min
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Servicio' : 'Nuevo Servicio'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nombre del Servicio *"
            id="svc-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Ej: Manicure Semipermanente"
          />
          <Input
            label="Precio Base (COP) *"
            id="svc-price"
            type="number"
            min="0"
            step="1000"
            value={form.basePrice}
            onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
            required
            placeholder="35000"
          />
          <Input
            label="Duración (minutos) *"
            id="svc-duration"
            type="number"
            min="1"
            value={form.durationMinutes}
            onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            required
            placeholder="60"
          />
          <div className="flex gap-2 pt-2 justify-between">
            {editId && (
              <Button
                type="button"
                variant="danger"
                onClick={() => { if (confirm('¿Eliminar este servicio?')) { handleDelete(editId); setModalOpen(false); } }}
              >
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
