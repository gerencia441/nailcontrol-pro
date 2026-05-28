import { useEffect, useState } from 'react';
import { Plus, Search, Phone, Pencil, Trash2, Tag } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';

const EMPTY_FORM = { name: '', phone: '', birthDate: '', tags: '', technicalNotes: '' };


function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blush-50 text-blush-600 text-xs font-medium">
      <Tag size={9} />
      {tag}
    </span>
  );
}

export default function Clients() {
  const [clients,   setClients]   = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);

  const load = (q) => api.getClients(q).then(setClients).finally(() => setLoading(false));
  useEffect(() => { load(''); }, []);

  const handleSearch = (e) => { setSearch(e.target.value); load(e.target.value); };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); };
  const openEdit   = (c) => {
    setForm({
      name: c.name, phone: c.phone || '',
      birthDate: c.birthDate ? c.birthDate.slice(0, 10) : '',
      tags: (c.tags || []).join(', '), technicalNotes: c.technicalNotes || '',
    });
    setEditId(c.id); setModalOpen(true);
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
      if (editId) { await api.updateClient(editId, data); }
      else        { await api.createClient(data); }
      setModalOpen(false);
      load(search);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta clienta?')) return;
    try { await api.deleteClient(id); load(search); }
    catch (err) { alert(err.message); }
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

      {/* Search bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={handleSearch}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 transition"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : clients.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay clientas registradas.</div>
        ) : (
          <>
            {/* Desktop table — hidden on mobile */}
            <div className="hidden md:block">
              <div className="grid grid-cols-[2fr_1fr_2fr_auto] gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100">
                <span className="table-header">Cliente</span>
                <span className="table-header">Teléfono</span>
                <span className="table-header">Etiquetas</span>
                <span className="table-header">Acción</span>
              </div>
              <div className="divide-y divide-gray-50">
                {clients.map((c) => (
                  <div key={c.id} className="grid grid-cols-[2fr_1fr_2fr_auto] gap-4 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                        {c.technicalNotes && (
                          <p className="text-xs text-gray-400 truncate">{c.technicalNotes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Phone size={11} className="text-gray-300" />
                      <span className="text-sm text-gray-500">{c.phone || '—'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).length === 0
                        ? <span className="text-xs text-gray-300">—</span>
                        : (c.tags || []).map((tag) => <TagChip key={tag} tag={tag} />)
                      }
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(c)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blush-50 hover:text-blush-600 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile card list — hidden on md+ */}
            <div className="md:hidden divide-y divide-gray-50">
              {clients.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={11} className="text-gray-300 flex-shrink-0" />
                      <span className="text-xs text-gray-400 truncate">{c.phone || '—'}</span>
                    </div>
                    {(c.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(c.tags || []).map((tag) => <TagChip key={tag} tag={tag} />)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(c)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-blush-50 hover:text-blush-600 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Clienta' : 'Nueva Clienta'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre *" id="client-name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Nombre completo" />
          <Input label="Teléfono" id="client-phone" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="300 000 0000" />
          <Input label="Fecha de Nacimiento" id="client-birth" type="date" value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <Input label="Etiquetas (separadas por coma)" id="client-tags" value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Manicure, Pedicure, Acrílicas" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="client-notes" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas Técnicas</label>
            <textarea id="client-notes" value={form.technicalNotes} rows={3}
              onChange={(e) => setForm({ ...form, technicalNotes: e.target.value })}
              placeholder="Alergias, preferencias, observaciones..."
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 resize-none transition"
            />
          </div>
          <div className="flex gap-2 pt-2 justify-between">
            {editId && (
              <Button type="button" variant="danger"
                onClick={() => { if (confirm('¿Eliminar esta clienta?')) { handleDelete(editId); setModalOpen(false); } }}>
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
