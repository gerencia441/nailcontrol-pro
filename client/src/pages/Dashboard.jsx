import { useEffect, useState } from 'react';
import { CalendarDays, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { api } from '../lib/api.js';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

function KpiCard({ title, value, subtitle, Icon, gradient }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${gradient}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard().then(setData).finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-0.5 capitalize">{today}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 h-24 animate-pulse border border-gray-100 shadow-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Citas Hoy"
            value={data?.appointmentsToday ?? 0}
            subtitle="agendadas para hoy"
            Icon={CalendarDays}
            gradient="bg-brand-gradient"
          />
          <KpiCard
            title="Pendientes"
            value={data?.pendingCount ?? 0}
            subtitle="citas sin finalizar"
            Icon={Clock}
            gradient="bg-gradient-to-br from-amber-400 to-orange-400"
          />
          <KpiCard
            title="Efectivo Hoy"
            value={formatCurrency(data?.cashToday ?? 0)}
            subtitle="ingresos en efectivo"
            Icon={DollarSign}
            gradient="bg-gradient-to-br from-emerald-400 to-emerald-600"
          />
          <KpiCard
            title="Caja Total"
            value={formatCurrency(data?.totalIncomeToday ?? 0)}
            subtitle="todos los métodos"
            Icon={TrendingUp}
            gradient="bg-gradient-to-br from-mauve-400 to-mauve-500"
          />
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <h2 className="section-title mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Nueva Cita',   href: '/appointments', cls: 'bg-blush-50 text-blush-700 hover:bg-blush-100'    },
            { label: 'Nueva Clienta',href: '/clients',       cls: 'bg-mauve-50 text-mauve-700 hover:bg-mauve-100'    },
            { label: 'Cierre del Día',href: '/finances',     cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
          ].map(({ label, href, cls }) => (
            <a
              key={href}
              href={href}
              className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${cls}`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
