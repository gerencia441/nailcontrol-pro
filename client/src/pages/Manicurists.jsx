import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
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

  const load = () =>
    api
      .getManicurists()
      .then(setManicurists)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (m) => {
    setForm({
      name: m.name,
      phone: m.phone || '',
      commissionPercentage: String(m.commissionPercentage),
    });
    setEditId(m.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.updateManicurist(editId, form);
      } else {
        await api.createManicurist(form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta manicurista?')) return;
    try {
      await api.deleteManicurist(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Manicuristas</h1>
          <p className="text-sm text-gray-500 mt-1">{manicurists.length} registradas</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Nueva Manicurista
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-pink-50 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : manicurists.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No hay manicuristas registradas.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pink-50 bg-pink-50/50">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Nombre</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Teléfono</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">% Comisión</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {manicurists.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-pink-50 last:border-0 hover:bg-pink-50/30 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-gray-800">{m.name}</td>
                  <td className="px-5 py-3 text-gray-500">{m.phone || '—'}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">
                      <Percent size={11} />
                      {m.commissionPercentage}%
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                        <Pencil size={14} />
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(m.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
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
          <div className="flex gap-2 pt-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
