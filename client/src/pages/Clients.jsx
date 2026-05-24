import { useEffect, useState } from 'react';
import { Plus, Search, Trash2, Tag } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';

const EMPTY_FORM = {
  name: '',
  phone: '',
  birthDate: '',
  tags: '',
  technicalNotes: '',
};

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = (q) =>
    api.getClients(q).then(setClients).finally(() => setLoading(false));

  useEffect(() => { load(''); }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name,
      phone: c.phone || '',
      birthDate: c.birthDate ? c.birthDate.slice(0, 10) : '',
      tags: (c.tags || []).join(', '),
      technicalNotes: c.technicalNotes || '',
    });
    setEditId(c.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = {
        ...form,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        birthDate: form.birthDate || null,
      };
      if (editId) {
        await api.updateClient(editId, data);
      } else {
        await api.createClient(data);
      }
      setModalOpen(false);
      load(search);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta clienta?')) return;
    try {
      await api.deleteClient(id);
      load(search);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Clientas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{clients.length} registradas</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nueva Clienta
        </Button>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre..."
              value={search}
              onChange={handleSearch}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay clientas registradas.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 table-header">Nombre</th>
                  <th className="text-left px-5 py-3 table-header">Teléfono</th>
                  <th className="text-left px-5 py-3 table-header">Etiquetas</th>
                  <th className="text-left px-5 py-3 table-header">Notas</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => openEdit(c)}
                  >
                    <td className="px-5 py-3 font-semibold text-gray-800">{c.name}</td>
                    <td className="px-5 py-3 text-gray-500">{c.phone || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blush-50 text-blush-600 text-xs font-medium"
                          >
                            <Tag size={10} />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-400 max-w-xs truncate text-xs">
                      {c.technicalNotes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Clienta' : 'Nueva Clienta'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Nombre *"
            id="client-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="Nombre completo"
          />
          <Input
            label="Teléfono"
            id="client-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="300 000 0000"
          />
          <Input
            label="Fecha de Nacimiento"
            id="client-birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
          />
          <Input
            label="Etiquetas (separadas por coma)"
            id="client-tags"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="Manicure, Pedicure, Acrílicas"
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-notes" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Notas Técnicas
            </label>
            <textarea
              id="client-notes"
              value={form.technicalNotes}
              onChange={(e) => setForm({ ...form, technicalNotes: e.target.value })}
              rows={3}
              placeholder="Alergias, preferencias, observaciones..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 resize-none transition"
            />
          </div>
          <div className="flex gap-2 pt-2 justify-between">
            {editId && (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  if (confirm('¿Eliminar esta clienta?')) {
                    handleDelete(editId);
                    setModalOpen(false);
                  }
                }}
              >
                <Trash2 size={14} /> Eliminar
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
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
