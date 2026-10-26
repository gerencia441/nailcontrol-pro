import { useEffect, useState } from 'react';
import { Plus, Trash2, Percent, Phone, Pencil, Sparkles } from 'lucide-react';
import { api } from '../lib/api.js';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import { MANICURIST_PALETTE, resolveManicuristColor } from '../lib/manicuristColors.js';
import { SERVICE_CATEGORIES, groupServicesByCategory } from '../lib/serviceCategories.js';
import { providesService } from '../lib/manicuristServices.js';

// Página "Especialistas" (modelo Manicurist en el código y la API).
const EMPTY_FORM = { name: '', phone: '', commissionPercentage: '', color: '', categories: [], serviceIds: [] };

// Resumen por categoría de lo que presta una especialista, para la tarjeta:
// `mode` es 'all' (categoría completa, incluye servicios futuros), 'some'
// (categoría acotada a servicios concretos) o 'extra' (servicios sueltos de
// una categoría que no tiene asignada).
function assignmentSummary(m, services) {
  const own = new Set(m.serviceIds || []);
  return SERVICE_CATEGORIES.map((cat) => {
    const assigned = (m.categories || []).includes(cat.value);
    const inCat = services.filter((s) => s.category === cat.value);
    const explicit = inCat.filter((s) => own.has(s.id));
    if (assigned && explicit.length === 0) return { ...cat, mode: 'all', services: [] };
    if (explicit.length > 0) return { ...cat, mode: assigned ? 'some' : 'extra', services: explicit, total: inCat.length };
    return null;
  }).filter(Boolean);
}

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
    // Nace sin categorías: hay que elegir explícitamente qué presta.
    setForm({ ...EMPTY_FORM, color: defaultColor });
    setEditId(null); setModalOpen(true);
  };
  const openEdit   = (m) => {
    setForm({
      name: m.name, phone: m.phone || '', commissionPercentage: String(m.commissionPercentage),
      color: m.color || resolveManicuristColor(m),
      categories: m.categories || [],
      serviceIds: m.serviceIds || [],
    });
    setEditId(m.id); setModalOpen(true);
  };

  // Activar o quitar una categoría descarta los servicios explícitos que tuviera
  // en ella: al activarla presta la categoría completa; al quitarla no deja
  // excepciones olvidadas.
  const toggleFormCategory = (category) => {
    setForm((f) => {
      const inCat = new Set(services.filter((s) => s.category === category).map((s) => s.id));
      return {
        ...f,
        categories: f.categories.includes(category)
          ? f.categories.filter((c) => c !== category)
          : [...f.categories, category],
        serviceIds: f.serviceIds.filter((id) => !inCat.has(id)),
      };
    });
  };

  // Los checks muestran lo que realmente presta (regla de manicuristServices.js)
  // y al cambiarlos se recalcula la asignación de esa categoría.
  const toggleFormService = (service) => {
    setForm((f) => {
      const cat = service.category;
      const inCat = services.filter((s) => s.category === cat);
      const effective = inCat.filter((s) => providesService(f, s, services)).map((s) => s.id);
      const next = effective.includes(service.id)
        ? effective.filter((id) => id !== service.id)
        : [...effective, service.id];
      const others = f.serviceIds.filter((id) => !inCat.some((s) => s.id === id));
      const assigned = f.categories.includes(cat);

      if (assigned && next.length === inCat.length) {
        // Todos marcados = categoría completa, así incluye los servicios futuros.
        return { ...f, serviceIds: others };
      }
      if (assigned && next.length === 0) {
        // Sin ninguno marcado deja de tener la categoría.
        return { ...f, categories: f.categories.filter((c) => c !== cat), serviceIds: others };
      }
      return { ...f, serviceIds: [...others, ...next] };
    });
  };

  const groupedServices = groupServicesByCategory(services);
  const formProvidesNothing = form.categories.length === 0 && form.serviceIds.length === 0;

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
    if (!confirm('¿Eliminar esta especialista?')) return;
    try { await api.deleteManicurist(id); load(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Especialistas</h1>
          <p className="text-sm text-gray-400 mt-0.5">{manicurists.length} colaboradoras activas</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nueva especialista
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
                {/* Color strip — color de identificación de la especialista */}
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

                  {/* Servicios que presta, por categoría */}
                  <div className="mb-4">
                    <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                      <Sparkles size={11} className="text-blush-300" />
                      Servicios que presta
                    </p>
                    {assignmentSummary(m, services).length === 0 ? (
                      <span className="inline-block text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                        Sin servicios asignados
                      </span>
                    ) : (
                      <div className="space-y-1.5">
                        {assignmentSummary(m, services).map((a) => (
                          <div key={a.value}>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blush-600 bg-blush-50 px-2 py-1 rounded-lg">
                              <a.Icon size={11} />
                              {a.label}
                              {a.mode === 'all' && ': todos'}
                              {a.mode === 'some' && `: ${a.services.length} de ${a.total}`}
                              {a.mode === 'extra' && ' (excepción)'}
                            </span>
                            {a.services.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {a.services.map((s) => (
                                  <span key={s.id} className="text-[11px] text-gray-600 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg">
                                    {s.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
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

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar especialista' : 'Nueva especialista'}>
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre *" id="man-name" value={form.name} required placeholder="Nombre completo"
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="Teléfono" id="man-phone" value={form.phone} placeholder="300 000 0000"
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="% de Comisión *" id="man-commission" type="number" min="0" max="100" step="0.5" value={form.commissionPercentage} required placeholder="40"
            onChange={(e) => setForm({ ...form, commissionPercentage: e.target.value })} />

          {/* Categorías — asignar una = presta todos sus servicios, incluidos los futuros */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Categorías</span>
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((c) => {
                const active = form.categories.includes(c.value);
                return (
                  <button key={c.value} type="button" aria-pressed={active}
                    onClick={() => toggleFormCategory(c.value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blush-500 border-blush-500 text-white'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-blush-300'
                    }`}>
                    <c.Icon size={13} /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Servicios que presta — determina en qué citas se la puede elegir */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Servicios que presta</span>
            <p className="text-xs text-gray-400 -mt-0.5">
              Con todos los servicios de una categoría marcados, también prestará los que se creen después.
              Desmarca los que no haga. Un servicio de otra categoría se puede marcar como excepción.
            </p>

            {services.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Todavía no hay servicios creados.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                {groupedServices.map((cat) => {
                  const assigned = form.categories.includes(cat.value);
                  const count = cat.services.filter((s) => providesService(form, s, services)).length;
                  return (
                    <div key={cat.value}>
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                          <cat.Icon size={12} /> {cat.label}
                        </span>
                        <span className={`text-[11px] ${assigned ? 'text-blush-600' : 'text-gray-400'}`}>
                          {assigned
                            ? (count === cat.services.length ? 'Todos' : `${count} de ${cat.services.length}`)
                            : (count > 0 ? `${count} excepción(es)` : 'No asignada')}
                        </span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {cat.services.map((s) => (
                          <label key={s.id} htmlFor={`man-svc-${s.id}`}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                            <input id={`man-svc-${s.id}`} type="checkbox" className="accent-blush-500"
                              checked={providesService(form, s, services)}
                              onChange={() => toggleFormService(s)} />
                            <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                            <span className="text-xs text-gray-400">{s.durationMinutes} min</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {formProvidesNothing && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
                Sin categorías ni servicios marcados <strong>no se le podrán agendar citas</strong>.
              </p>
            )}
          </div>

          {/* Color de identificación */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color de identificación</span>
            <p className="text-xs text-gray-400 -mt-0.5">Identifica las citas de esta especialista en toda la app.</p>
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
                onClick={() => { if (confirm('¿Eliminar esta especialista?')) { handleDelete(editId); setModalOpen(false); } }}>
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
