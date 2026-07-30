import { useEffect, useState } from 'react';
import { Plus, Trash2, Percent, Phone, Pencil, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import { MANICURIST_PALETTE, resolveManicuristColor } from '../lib/manicuristColors.js';

const EMPTY_FORM = { name: '', phone: '', commissionPercentage: '', color: '', serviceIds: [] };

function initials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function Manicurists() {
  const [manicurists, setManicurists] = useState([]);
  const [services,    setServices]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);

  const load = () => api.getManicurists().then(setManicurists).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { api.getServices().then(setServices).catch(() => setServices([])); }, []);

  const openCreate = () => {
    // Asigna por defecto el primer color de la paleta que no esté en uso.
    const used = new Set(manicurists.map((m) => m.color).filter(Boolean));
    const defaultColor = MANICURIST_PALETTE.find((c) => !used.has(c)) || MANICURIST_PALETTE[0];
    // Nace prestando todo el catálogo: acotar es la excepción, no la norma.
    setForm({ ...EMPTY_FORM, color: defaultColor, serviceIds: services.map((s) => s.id) });
    setEditId(null); setModalOpen(true);
  };
  const openEdit   = (m) => {
    setForm({
      name: m.name, phone: m.phone || '', commissionPercentage: String(m.commissionPercentage),
      color: m.color || resolveManicuristColor(m),
      serviceIds: m.serviceIds || [],
    });
    setEditId(m.id); setModalOpen(true);
  };

  const toggleFormService = (id) => {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((s) => s !== id)
        : [...f.serviceIds, id],
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) { await api.updateManicurist(editId, form); }
      else        { await api.createManicurist(form); }
      setModalOpen(false); load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta manicurista?')) return;
    try { await api.deleteManicurist(id); load(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Manicuristas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{manicurists.length} colaboradoras activas</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nueva Manicurista
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-52 animate-pulse border border-gray-100 shadow-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {manicurists.map((m) => {
            const color = resolveManicuristColor(m);
            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden hover:shadow-card-hover transition-all group"
              >
                {/* Color strip — color de identificación de la manicurista */}
                <div className="h-2" style={{ backgroundColor: color }} />

                <div className="p-5">
                  {/* Avatar + name */}
                  <div className="flex items-start gap-3 mb-5">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color }}>
                      <span className="text-sm font-bold text-gray-700">{initials(m.name)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800">{m.name}</h3>
                      {m.phone && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-gray-300" />
                          <span className="text-xs text-gray-400">{m.phone}</span>
                        </div>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg flex-shrink-0">
                      <Percent size={10} />
                      {m.commissionPercentage}%
                    </span>
                  </div>

                  {/* Commission info */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-3">
                    <p className="text-xs text-gray-400 mb-1">Comisión sobre cobros</p>
                    <p className="text-lg font-bold text-gray-800">{m.commissionPercentage}%</p>
                  </div>

                  {/* Servicios que presta — sin asignación explícita presta todos */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                      <Sparkles size={11} className="text-blush-300" />
                      Servicios que presta
                    </p>
                    {(m.serviceIds?.length || 0) === 0 ? (
                      <span className="inline-block text-xs font-medium text-blush-600 bg-blush-50 px-2 py-1 rounded-lg">
                        Todos los servicios
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {services
                          .filter((s) => m.serviceIds.includes(s.id))
                          .map((s) => (
                            <span key={s.id} className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                              {s.name}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Actions — visible on hover */}
                  <div className="flex gap-2 border-t border-gray-50 pt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(m)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-blush-50 hover:text-blush-600 border border-gray-100 transition-colors"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 border border-gray-100 transition-colors"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add card */}
          <button
            onClick={openCreate}
            className="rounded-2xl border-2 border-dashed border-blush-200 flex flex-col items-center justify-center gap-2 text-blush-300 hover:border-blush-400 hover:text-blush-500 hover:bg-blush-50 transition-all min-h-[240px]"
          >
            <Plus size={22} strokeWidth={1.5} />
            <span className="text-xs font-medium">Agregar colaboradora</span>
          </button>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Manicurista' : 'Nueva Manicurista'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre *" id="man-name" value={form.name} required placeholder="Nombre completo"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Teléfono" id="man-phone" value={form.phone} placeholder="300 000 0000"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="% de Comisión *" id="man-commission" type="number" min="0" max="100" step="0.5" value={form.commissionPercentage} required placeholder="40"
            onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })} />

          {/* Servicios que presta — determina en qué citas se la puede elegir */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios que presta</span>
              <div className="flex gap-2 text-[11px] font-medium">
                <button type="button" className="text-blush-500 hover:text-blush-600"
                  onClick={() => setForm({ ...form, serviceIds: services.map((s) => s.id) })}>
                  Todos
                </button>
                <span className="text-gray-200">·</span>
                <button type="button" className="text-gray-400 hover:text-gray-600"
                  onClick={() => setForm({ ...form, serviceIds: [] })}>
                  Ninguno
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-0.5">
              Al agendar, solo se podrá elegir a esta manicurista para los servicios marcados.
            </p>

            {services.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Todavía no hay servicios creados.</p>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-50">
                {services.map((s) => (
                  <label key={s.id} htmlFor={`man-svc-${s.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input id={`man-svc-${s.id}`} type="checkbox" className="accent-blush-500"
                      checked={form.serviceIds.includes(s.id)}
                      onChange={() => toggleFormService(s.id)} />
                    <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                    <span className="text-xs text-gray-400">{s.durationMinutes} min</span>
                  </label>
                ))}
              </div>
            )}

            {form.serviceIds.length === 0 ? (
              <p className="text-xs text-blush-600 bg-blush-50 rounded-lg px-2.5 py-1.5">
                Sin ninguno marcado se asume que presta <strong>todos</strong> los servicios.
              </p>
            ) : (
              <p className="text-xs text-gray-400">{form.serviceIds.length} de {services.length} seleccionados</p>
            )}
          </div>

          {/* Color de identificación */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color de identificación</span>
            <p className="text-xs text-gray-400 -mt-0.5">Identifica las citas de esta manicurista en toda la app.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {MANICURIST_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Color ${c}`}
                  className={`w-8 h-8 rounded-full transition-all ${
                    form.color === c
                      ? 'ring-2 ring-offset-2 ring-gray-400 scale-110'
                      : 'border border-gray-200 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 justify-between">
            {editId && (
              <Button type="button" variant="danger"
                onClick={() => { if (confirm('¿Eliminar esta manicurista?')) { handleDelete(editId); setModalOpen(false); } }}>
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
