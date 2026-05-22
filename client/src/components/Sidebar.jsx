import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Scissors,
  UserCheck,
  CalendarDays,
  DollarSign,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

const links = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/appointments', label: 'Citas', Icon: CalendarDays },
  { to: '/clients', label: 'Clientas', Icon: Users },
  { to: '/services', label: 'Servicios', Icon: Scissors },
  { to: '/manicurists', label: 'Manicuristas', Icon: UserCheck },
  { to: '/finances', label: 'Finanzas', Icon: DollarSign },
];

export default function Sidebar({ isOpen, onClose }) {
  const { logout } = useAuth();
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-30 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
        }`}
        onClick={onClose}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 max-w-full bg-white border-r border-pink-100 flex flex-col shadow-sm transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:translate-x-0 lg:visible lg:opacity-100`}
      >
        <div className="px-6 py-5 border-b border-pink-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
              <Scissors size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-pink-700 leading-tight">NailControl Pro</h1>
              <p className="text-xs text-pink-400 leading-tight">Nail Spa Manager</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 rounded-xl text-gray-500 hover:bg-pink-50"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-pink-100 text-pink-700'
                    : 'text-gray-500 hover:bg-pink-50 hover:text-pink-600'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-pink-100">
          <button
            onClick={() => {
              logout();
              onClose?.();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={17} />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
