import { useEffect, useState } from 'react';
import { Plus, Trash2, Percent } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';

const EMPTY_FORM = { name: '', phone: '', commissionPercentage: '' };

export default function Manicurists() {
  const [manicurists, setManicurists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.getManicurists().then(setManicurists).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); };
  const openEdit   = (m) => {
    setForm({ name: m.name, phone: m.phone || '', commissionPercentage: String(m.commissionPercentage) });
    setEditId(m.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) { await api.updateManicurist(editId, form); }
      else        { await api.createManicurist(form); }
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta manicurista?')) return;
    try { await api.deleteManicurist(id); load(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Manicuristas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{manicurists.length} registradas</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nueva Manicurista
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : manicurists.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay manicuristas registradas.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 table-header">Nombre</th>
                <th className="text-left px-5 py-3 table-header">Teléfono</th>
                <th className="text-left px-5 py-3 table-header">% Comisión</th>
              </tr>
            </thead>
            <tbody>
              {manicurists.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openEdit(m)}
                >
                  <td className="px-5 py-3 font-semibold text-gray-800">{m.name}</td>
                  <td className="px-5 py-3 text-gray-500">{m.phone || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-mauve-100 text-mauve-700 text-xs font-medium">
                      <Percent size={11} />
                      {m.commissionPercentage}%
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
        title={editId ? 'Editar Manicurista' : 'Nueva Manicurista'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nombre *"
            id="man-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Nombre completo"
          />
          <Input
            label="Teléfono"
            id="man-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="300 000 0000"
          />
          <Input
            label="% de Comisión *"
            id="man-commission"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={form.commissionPercentage}
            onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })}
            required
            placeholder="40"
          />
          <div className="flex gap-2 pt-2 justify-between">
            {editId && (
              <Button
                type="button"
                variant="danger"
                onClick={() => { if (confirm('¿Eliminar esta manicurista?')) { handleDelete(editId); setModalOpen(false); } }}
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
