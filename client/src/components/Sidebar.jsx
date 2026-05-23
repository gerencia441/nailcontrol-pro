import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Scissors,
  UserCheck,
  CalendarDays,
  DollarSign,
  Settings,
} from 'lucide-react';

const links = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/appointments', label: 'Citas', Icon: CalendarDays },
  { to: '/clients', label: 'Clientas', Icon: Users },
  { to: '/services', label: 'Servicios', Icon: Scissors },
  { to: '/manicurists', label: 'Manicuristas', Icon: UserCheck },
  { to: '/finances', label: 'Finanzas', Icon: DollarSign },
  { to: '/settings', label: 'Ajustes', Icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="w-60 bg-white border-r border-pink-100 flex flex-col shadow-sm flex-shrink-0">
      <div className="px-6 py-5 border-b border-pink-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
            <Scissors size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-pink-700 leading-tight">NailControl Pro</h1>
            <p className="text-xs text-pink-400 leading-tight">Nail Spa Manager</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
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
        <p className="text-xs text-gray-400 text-center">v1.0.0</p>
      </div>
    </aside>
  );
}
