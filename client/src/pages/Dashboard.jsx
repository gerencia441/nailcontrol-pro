import { useEffect, useState } from 'react';
import { CalendarDays, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { api } from '../lib/api.js';

function KpiCard({ title, value, subtitle, Icon, color }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-pink-50 flex items-start gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-gray-800 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('es-CO', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-24 animate-pulse border border-pink-50" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Citas Hoy"
            value={data?.appointmentsToday ?? 0}
            subtitle="agendadas para hoy"
            Icon={CalendarDays}
            color="bg-gradient-to-br from-pink-400 to-pink-600"
          />
          <KpiCard
            title="Pendientes de Cobro"
            value={data?.pendingCount ?? 0}
            subtitle="citas sin finalizar"
            Icon={Clock}
            color="bg-gradient-to-br from-yellow-400 to-orange-400"
          />
          <KpiCard
            title="Efectivo Hoy"
            value={formatCurrency(data?.cashToday ?? 0)}
            subtitle="ingresos en efectivo"
            Icon={DollarSign}
            color="bg-gradient-to-br from-emerald-400 to-emerald-600"
          />
          <KpiCard
            title="Caja Total Hoy"
            value={formatCurrency(data?.totalIncomeToday ?? 0)}
            subtitle="todos los métodos"
            Icon={TrendingUp}
            color="bg-gradient-to-br from-purple-400 to-purple-600"
          />
        </div>
      )}

      <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-pink-50">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Nueva Cita', href: '/appointments', color: 'bg-pink-50 text-pink-700 hover:bg-pink-100' },
            { label: 'Nueva Clienta', href: '/clients', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
            { label: 'Cierre del Día', href: '/finances', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
          ].map(({ label, href, color }) => (
            <a
              key={href}
              href={href}
              className={`block text-center py-3 rounded-xl text-sm font-medium transition-colors ${color}`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
