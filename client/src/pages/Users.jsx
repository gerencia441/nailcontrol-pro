import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ShieldCheck, User } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/AuthContext.jsx';
import Button from '../components/ui/Button.jsx';
import Modal from '../components/ui/Modal.jsx';
import Input from '../components/ui/Input.jsx';
import Select from '../components/ui/Select.jsx';

const EMPTY_FORM = { username: '', password: '', role: 'MANICURIST', manicuristId: '' };

export default function Users() {
  const { user: me } = useAuth();
  const [users,       setUsers]       = useState([]);
  const [manicurists, setManicurists] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);

  const load = () =>
    Promise.all([api.getUsers(), api.getManicurists()])
      .then(([u, m]) => { setUsers(u); setManicurists(m); })
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModalOpen(true); };
  const openEdit = (u) => {
    setForm({ username: u.username, password: '', role: u.role, manicuristId: u.manicuristId || '' });
    setEditId(u.id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, manicuristId: form.manicuristId || null };
      if (!data.password) delete data.password;
      if (editId) { await api.updateUser(editId, data); }
      else        { await api.createUser(data); }
      setModalOpen(false);
      load();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try { await api.deleteUser(id); load(); }
    catch (err) { alert(err.message); }
  };

  const manicuristName = (id) => manicurists.find(m => m.id === id)?.name || '—';

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} usuarios registrados</p>
        </div>
        <Button onClick={openCreate} className="self-start sm:self-auto">
          <Plus size={16} strokeWidth={2.5} /> Nuevo Usuario
        </Button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No hay usuarios.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-white">
                    {u.username.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-800">{u.username}</p>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      u.role === 'ADMIN'
                        ? 'bg-blush-50 text-blush-600 border border-blush-200'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {u.role === 'ADMIN' ? <ShieldCheck size={9} /> : <User size={9} />}
                      {u.role === 'ADMIN' ? 'Administrador' : 'Manicurista'}
                    </span>
                  </div>
                  {u.manicuristId && (
                    <p className="text-xs text-gray-400 mt-0.5">Vinculada a: {manicuristName(u.manicuristId)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onClick={() => openEdit(u)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blush-50 hover:text-blush-600 transition-colors"
                  >
                    <Pencil size={13} />
                  </button>
                  {u.id !== me?.id && (
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar Usuario' : 'Nuevo Usuario'} maxWidth="max-w-sm">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label="Nombre de usuario *" id="u-username" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} required placeholder="usuario123" />
          <Input label={editId ? 'Nueva contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'}
            id="u-password" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editId} placeholder="••••••••" />
          <Select label="Rol *" id="u-role" value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="MANICURIST">Manicurista</option>
            <option value="ADMIN">Administrador</option>
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Vincular a manicurista
            </label>
            <select
              value={form.manicuristId}
              onChange={(e) => setForm({ ...form, manicuristId: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blush-300 focus:border-blush-300 transition bg-white"
            >
              <option value="">— Sin vincular —</option>
              {manicurists.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400">
              Necesario para que el usuario manicurista vea sus propias finanzas.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saving} className="flex-1">
              {saving ? 'Guardando...' : editId ? 'Guardar Cambios' : 'Crear Usuario'}
            </Button>
            <button type="button" onClick={() => setModalOpen(false)}
              className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
