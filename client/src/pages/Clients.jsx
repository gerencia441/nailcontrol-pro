import { useEffect, useState } from 'react';
import { Plus, Search, Phone, Pencil, Trash2, Tag, ClipboardList, UserCheck, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import { useAuth } from '../lib/AuthContext.jsx';
import { resolveManicuristColor } from '../lib/manicuristColors.js';

const EMPTY_FORM = { name: '', phone: '', birthDate: '', tags: '', technicalNotes: '' };


function TagChip({ tag }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blush-50 text-blush-600 text-xs font-medium">
      <Tag size={9} />
      {tag}
    </span>
  );
}

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

function formatApptDate(d) {
  return new Date(d).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}
function formatApptTime(d) {
  return new Date(d).toLocaleTimeString('en-US', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true,
  }).toLowerCase();
}

const STATUS_ICON = {
  COMPLETED: <CheckCircle size={13} className="text-emerald-500" />,
  CANCELLED: <XCircle    size={13} className="text-red-400"     />,
  PENDING:   <Clock      size={13} className="text-amber-400"   />,
};
const STATUS_LABEL = { COMPLETED: 'Completada', CANCELLED: 'Cancelada', PENDING: 'Pendiente' };

export default function Clients() {
  const { isAdmin } = useAuth();
  const [clients,   setClients]   = useState([]);
  const [search,    setSearch]    = useState('');
  const [loading,   setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);

  const [profileOpen,   setProfileOpen]   = useState(false);
  const [profileClient, setProfileClient] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

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

  const openProfile = async (id) => {
    setProfileOpen(true);
    setProfileClient(null);
    setProfileLoading(true);
    try { setProfileClient(await api.getClient(id)); }
    catch (err) { alert(err.message); setProfileOpen(false); }
    finally { setProfileLoading(false); }
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
              <div className={`grid gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 ${isAdmin ? 'grid-cols-[2fr_1fr_2fr_auto]' : 'grid-cols-[2fr_2fr_auto]'}`}>
                <span className="table-header">Cliente</span>
                {isAdmin && <span className="table-header">Teléfono</span>}
                <span className="table-header">Etiquetas</span>
                <span className="table-header">Acción</span>
              </div>
              <div className="divide-y divide-gray-50">
                {clients.map((c) => (
                  <div key={c.id} className={`grid gap-4 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors group ${isAdmin ? 'grid-cols-[2fr_1fr_2fr_auto]' : 'grid-cols-[2fr_2fr_auto]'}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{c.name}</p>
                        {c.technicalNotes && (
                          <p className="text-xs text-gray-400 truncate">{c.technicalNotes}</p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <Phone size={11} className="text-gray-300" />
                        <span className="text-sm text-gray-500">{c.phone || '—'}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).length === 0
                        ? <span className="text-xs text-gray-300">—</span>
                        : (c.tags || []).map((tag) => <TagChip key={tag} tag={tag} />)
                      }
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openProfile(c.id)}
                        title="Ver historial"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-mauve-50 hover:text-mauve-600 transition-colors"
                      >
                        <ClipboardList size={13} />
                      </button>
                      <button
                        onClick={() => openEdit(c)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blush-50 hover:text-blush-600 transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
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
                    {isAdmin && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone size={11} className="text-gray-300 flex-shrink-0" />
                        <span className="text-xs text-gray-400 truncate">{c.phone || '—'}</span>
                      </div>
                    )}
                    {(c.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(c.tags || []).map((tag) => <TagChip key={tag} tag={tag} />)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openProfile(c.id)}
                      title="Ver historial"
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-mauve-50 hover:text-mauve-600 transition-colors"
                    >
                      <ClipboardList size={14} />
                    </button>
                    <button
                      onClick={() => openEdit(c)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-blush-50 hover:text-blush-600 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Profile / History Modal */}
      <Modal isOpen={profileOpen} onClose={() => setProfileOpen(false)} title="Historial de Clienta" maxWidth="max-w-2xl">
        {profileLoading || !profileClient ? (
          <div className="py-12 text-center text-gray-400 text-sm">Cargando historial...</div>
        ) : (
          <div className="space-y-5">
            {/* Client header */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 pb-4 border-b border-gray-100">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-800">{profileClient.name}</h3>
                {isAdmin && profileClient.phone && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Phone size={12} className="text-gray-400" />
                    <span className="text-sm text-gray-500">{profileClient.phone}</span>
                  </div>
                )}
                {(profileClient.tags || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(profileClient.tags || []).map((t) => <TagChip key={t} tag={t} />)}
                  </div>
                )}
                {profileClient.technicalNotes && (
                  <p className="text-xs text-gray-400 mt-2 italic">{profileClient.technicalNotes}</p>
                )}
              </div>
              {/* Stats */}
              <div className="flex gap-3 flex-shrink-0">
                <div className="text-center px-3 py-2 bg-blush-50 rounded-xl">
                  <p className="text-lg font-bold text-blush-600">{profileClient.appointments?.length ?? 0}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Citas</p>
                </div>
                <div className="text-center px-3 py-2 bg-mauve-50 rounded-xl">
                  <p className="text-base font-bold text-mauve-600">
                    {formatCurrency(
                      (profileClient.appointments || [])
                        .filter((a) => a.status === 'COMPLETED')
                        .reduce((s, a) => s + (a.finalPricePaid || 0), 0)
                    )}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total pagado</p>
                </div>
              </div>
            </div>

            {/* Appointment history */}
            {(profileClient.appointments || []).length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">Esta clienta no tiene citas registradas.</p>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {(profileClient.appointments || []).map((a) => {
                  const mColor = resolveManicuristColor(a.manicurist?.color);
                  const svcsLabel = (a.services || []).map((s) => s.name).join(' + ') || (a.service?.name ?? '—');
                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors bg-white">
                      {/* Date/time column */}
                      <div className="flex-shrink-0 min-w-[90px]">
                        <p className="text-xs font-semibold text-gray-700">{formatApptDate(a.date)}</p>
                        <p className="text-xs text-gray-400">{formatApptTime(a.date)}</p>
                      </div>
                      {/* Services */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{svcsLabel}</p>
                        {a.manicurist && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: mColor }}
                            />
                            <span className="text-xs text-gray-500">{a.manicurist.name}</span>
                          </div>
                        )}
                      </div>
                      {/* Status + price */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          {STATUS_ICON[a.status]}
                          <span className="text-xs text-gray-500">{STATUS_LABEL[a.status]}</span>
                        </div>
                        {a.status === 'COMPLETED' && a.finalPricePaid != null && (
                          <span className="text-xs font-semibold text-emerald-600">{formatCurrency(a.finalPricePaid)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Clienta' : 'Nueva Clienta'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre *" id="client-name" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Nombre completo" />
          {isAdmin && (
            <Input label="Teléfono" id="client-phone" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="300 000 0000" />
          )}
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
