import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import NotificationBell from './NotificationBell.jsx';
import { useOnlineBookings } from '../lib/useOnlineBookings.js';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // El sondeo vive aquí, una sola vez, y se comparte con las dos campanitas
  // (la del encabezado móvil y la de la barra lateral en escritorio).
  const online = useOnlineBookings();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} online={online} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between border-b border-gray-200/70 bg-white px-4 py-3 flex-shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logonailcontrol.png" alt="NailControl" className="w-7 h-7 object-contain" />
            <span className="text-sm font-semibold text-gray-800">NailControl Pro</span>
          </div>
          <NotificationBell
            count={online.count}
            appointments={online.appointments}
            permission={online.permission}
            onRequestPermission={online.requestPermission}
          />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1400px] mx-auto animate-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
