import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CalendarDays,
  DollarSign,
  LogOut,
  X,
  Settings,
} from 'lucide-react';

const NailIcon = () => <img src="/logonailcontrol.png" alt="" className="w-5 h-5 object-contain" />;
import { useAuth } from '../lib/AuthContext';

const links = [
  { to: '/dashboard',   label: 'Dashboard',    Icon: LayoutDashboard },
  { to: '/appointments',label: 'Citas',         Icon: CalendarDays    },
  { to: '/clients',     label: 'Clientas',      Icon: Users           },
  { to: '/services',    label: 'Servicios',     Icon: NailIcon        },
  { to: '/manicurists', label: 'Manicuristas',  Icon: UserCheck       },
  { to: '/finances',    label: 'Finanzas',      Icon: DollarSign      },
  { to: '/settings',    label: 'Ajustes',       Icon: Settings        },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-30 lg:hidden transition-opacity duration-300 ${
          isOpen ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 max-w-full bg-white border-r border-gray-200/70 flex flex-col shadow-sm transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img src="/logonailcontrol.png" alt="NailControl" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-gray-900 leading-tight">NailControl</h1>
              <p className="text-[10px] text-gray-400 leading-tight font-medium tracking-wide">PRO</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {links.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => onClose?.()}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'nav-item-active' : 'nav-item-default'}`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User chip + logout */}
        <div className="px-3 py-4 border-t border-gray-100 space-y-1">
          {user && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-white">
                  {user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0,2) : 'U'}
                </span>
              </div>
              <span className="text-xs font-medium text-gray-700 truncate">{user.name || user.email}</span>
            </div>
          )}
          <button
            onClick={() => { logout(); onClose?.(); }}
            className="nav-item nav-item-default w-full text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={17} />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
