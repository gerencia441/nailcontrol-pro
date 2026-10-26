import { useState } from 'react';
import { AlertTriangle, Heart, Sparkles, StickyNote, Pencil, Trash2, Plus } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Button from './ui/Button.jsx';

// Bitácora de notas de la clienta. La ven todas las especialistas; cada una
// edita/borra solo las suyas y la administradora todas (el servidor lo valida
// igual en server/src/routes/clients.js).

export const NOTE_TYPES = [
  { value: 'ALLERGY',    label: 'Alergia',     Icon: AlertTriangle, chip: 'bg-red-50 text-red-600 border-red-100' },
  { value: 'PREFERENCE', label: 'Preferencia', Icon: Heart,         chip: 'bg-blush-50 text-blush-600 border-blush-100' },
  { value: 'SERVICE',    label: 'Servicio',    Icon: Sparkles,      chip: 'bg-mauve-50 text-mauve-500 border-mauve-100' },
  { value: 'GENERAL',    label: 'General',     Icon: StickyNote,    chip: 'bg-gray-50 text-gray-600 border-gray-100' },
];
const TYPE_BY_VALUE = Object.fromEntries(NOTE_TYPES.map((t) => [t.value, t]));

const formatNoteDate = (d) =>
  new Date(d).toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric',
  });

// Aviso destacado con las alergias de la clienta. `notes` puede traer solo las
// alergias (citas) o todas las notas (historial).
export function AllergyAlert({ notes = [], className = '' }) {
  const allergies = notes.filter((n) => !n.type || n.type === 'ALLERGY');
  if (allergies.length === 0) return null;
  return (
    <div className={`rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-bold text-red-600 uppercase tracking-wide">
        <AlertTriangle size={13} /> Alergias
      </p>
      <ul className="mt-1 space-y-0.5">
        {allergies.map((n) => (
          <li key={n.id} className="text-sm text-red-700 whitespace-pre-line break-words">{n.text}</li>
        ))}
      </ul>
    </div>
  );
}

function TypePicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTE_TYPES.map((t) => (
        <button key={t.value} type="button" onClick={() => onChange(t.value)} aria-pressed={value === t.value}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            value === t.value ? t.chip + ' ring-2 ring-offset-1 ring-blush-200' : 'bg-white border-gray-200 text-gray-500 hover:border-blush-300'
          }`}>
          <t.Icon size={12} /> {t.label}
        </button>
      ))}
    </div>
  );
}

function NoteEditor({ initial, onSave, onCancel, saving }) {
  const [type, setType] = useState(initial?.type || 'GENERAL');
  const [text, setText] = useState(initial?.text || '');
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSave({ type, text: text.trim() }); }}
      className="space-y-2.5 rounded-xl border border-blush-100 bg-blush-25 p-3"
    >
      <TypePicker value={type} onChange={setType} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} required autoFocus
        placeholder="Ej: alérgica al pegamento de pestañas, prefiere tonos nude, uñas frágiles..."
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 resize-y transition" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={saving || !text.trim()}>{saving ? 'Guardando...' : 'Guardar'}</Button>
      </div>
    </form>
  );
}

export default function ClientNotes({ clientId, notes, onChange }) {
  const { user, isAdmin } = useAuth();
  const [adding,  setAdding]  = useState(false);
  const [editId,  setEditId]  = useState(null);
  const [saving,  setSaving]  = useState(false);

  const canEdit = (n) => isAdmin || (n.authorUserId != null && n.authorUserId === user?.id);

  // Alergias primero (son lo que no se puede pasar por alto), luego el resto;
  // dentro de cada grupo, la más reciente arriba (así llegan del servidor).
  const sorted = [...notes].sort((a, b) => (a.type === 'ALLERGY' ? 0 : 1) - (b.type === 'ALLERGY' ? 0 : 1));

  const create = async (data) => {
    setSaving(true);
    try {
      const note = await api.createClientNote(clientId, data);
      onChange([note, ...notes]);
      setAdding(false);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const update = async (id, data) => {
    setSaving(true);
    try {
      const note = await api.updateClientNote(clientId, id, data);
      onChange(notes.map((n) => (n.id === id ? note : n)));
      setEditId(null);
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await api.deleteClientNote(clientId, id);
      onChange(notes.filter((n) => n.id !== id));
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="section-title">Notas de la clienta</h2>
          <p className="text-xs text-gray-400 mt-0.5">Alergias, preferencias y todo lo relevante para sus servicios. Las ve todo el equipo.</p>
        </div>
        {!adding && (
          <Button onClick={() => { setAdding(true); setEditId(null); }} className="flex-shrink-0">
            <Plus size={15} strokeWidth={2.5} /> <span className="hidden sm:inline">Agregar nota</span>
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-3">
          <NoteEditor onSave={create} onCancel={() => setAdding(false)} saving={saving} />
        </div>
      )}

      {sorted.length === 0 && !adding ? (
        <p className="text-center text-sm text-gray-400 py-4">Todavía no hay notas para esta clienta.</p>
      ) : (
        <ul className="space-y-2">
          {sorted.map((n) => {
            const t = TYPE_BY_VALUE[n.type] || TYPE_BY_VALUE.GENERAL;
            if (editId === n.id) {
              return (
                <li key={n.id}>
                  <NoteEditor initial={n} onSave={(data) => update(n.id, data)} onCancel={() => setEditId(null)} saving={saving} />
                </li>
              );
            }
            const edited = new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime() > 1000;
            return (
              <li key={n.id}
                className={`p-3 rounded-xl border ${n.type === 'ALLERGY' ? 'border-red-100 bg-red-50/40' : 'border-gray-100 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${t.chip}`}>
                    <t.Icon size={11} /> {t.label}
                  </span>
                  {canEdit(n) && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => { setEditId(n.id); setAdding(false); }} title="Editar nota"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blush-50 hover:text-blush-600 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => remove(n.id)} title="Eliminar nota"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-line break-words">{n.text}</p>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  {n.authorName} · {formatNoteDate(n.createdAt)}{edited && ` · editada ${formatNoteDate(n.updatedAt)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
