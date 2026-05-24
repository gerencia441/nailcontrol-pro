import { useEffect, useState } from 'react';
import { CalendarDays, Clock, DollarSign, TrendingUp, UserCheck, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { StatusBadge } from '../components/ui/Badge.jsx';

const formatCurrency = (v) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v || 0);

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('es-CO', {
    timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function initials(name = '') {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
}

function StatCard({ label, value, sub, Icon, iconCls }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconCls}`}>
          <Icon size={18} className="text-white" strokeWidth={2} />
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <ArrowUpRight size={11} strokeWidth={2.5} />
          hoy
        </span>
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
        <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data,        setData]        = useState(null);
  const [todayAppts,  setTodayAppts]  = useState([]);
  const [loading,     setLoading]     = useState(true);

  const today = todayStr();

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      api.getAppointments({ date: today }),
    ]).then(([dash, appts]) => {
      setData(dash);
      setTodayAppts(appts.slice(0, 6));
    }).finally(() => setLoading(false));
  }, [today]);

  const dayLabel = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h1 className="page-title">Buenos días ✦</h1>
          <p className="text-sm text-gray-400 mt-1 capitalize">{dayLabel}</p>
        </div>
        {data && (
          <div className="sm:text-right">
            <p className="text-xs text-gray-400">Hoy en ingresos</p>
            <p className="text-xl sm:text-2xl font-bold text-blush-600">
              {formatCurrency(data.totalIncomeToday)}
            </p>
          </div>
        )}
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-28 animate-pulse border border-gray-100 shadow-card" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard label="Citas hoy"           value={data?.appointmentsToday ?? 0}        sub="agendadas"               Icon={CalendarDays} iconCls="bg-mauve-400"  />
          <StatCard label="Ingresos del día"    value={formatCurrency(data?.totalIncomeToday)} sub="todos los métodos"     Icon={DollarSign}   iconCls="bg-blush-400" />
          <StatCard label="Pendientes de cobro" value={data?.pendingCount ?? 0}              sub="citas sin finalizar"     Icon={Clock}        iconCls="bg-amber-400" />
          <StatCard label="Efectivo hoy"        value={formatCurrency(data?.cashToday)}      sub="ingresos en efectivo"   Icon={TrendingUp}   iconCls="bg-emerald-500"/>
        </div>
      )}

      {/* Today's appointments */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-50">
          <p className="section-title">Citas de hoy</p>
          <a href="/appointments" className="text-xs font-semibold text-blush-500 hover:text-blush-600 transition-colors">
            Ver todas →
          </a>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Cargando...</div>
        ) : todayAppts.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-300">No hay citas para hoy.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {todayAppts.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 hover:bg-gray-50 transition-colors">
                {/* Time */}
                <div className="flex items-center gap-1 w-16 sm:w-20 flex-shrink-0">
                  <Clock size={12} className="text-gray-300 hidden sm:block" />
                  <span className="text-xs sm:text-sm font-medium text-gray-600">{formatTime(appt.date)}</span>
                </div>

                {/* Client avatar + info */}
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blush-100 to-petal-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-blush-700">{initials(appt.client?.name)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{appt.client?.name}</p>
                    <p className="text-xs text-gray-400 truncate hidden sm:block">
                      {(appt.services || (appt.service ? [appt.service] : [])).map((s) => s.name).join(' + ')}
                    </p>
                  </div>
                </div>

                {/* Manicurist */}
                <span className="text-xs text-gray-400 hidden lg:block w-24 truncate flex-shrink-0 flex items-center gap-1">
                  <UserCheck size={11} className="text-gray-300" />
                  {appt.manicurist?.name?.split(' ')[0]}
                </span>

                {/* Status */}
                <StatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <h2 className="section-title mb-4">Accesos Rápidos</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Nueva Cita',    href: '/appointments', cls: 'bg-blush-50 text-blush-700 hover:bg-blush-100'     },
            { label: 'Nueva Clienta', href: '/clients',       cls: 'bg-mauve-50 text-mauve-700 hover:bg-mauve-100'     },
            { label: 'Cierre del Día',href: '/finances',      cls: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
          ].map(({ label, href, cls }) => (
            <a key={href} href={href} className={`block text-center py-3 rounded-xl text-sm font-semibold transition-colors ${cls}`}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
