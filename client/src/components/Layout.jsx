import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-spa-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="lg:hidden flex items-center justify-between border-b border-pink-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center justify-center p-1 rounded-xl bg-pink-50 text-pink-700 hover:bg-pink-100"
          >
            <Menu size={20} />
          </button>
          <div className="text-base font-semibold text-gray-800">NailControl Pro</div>
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
