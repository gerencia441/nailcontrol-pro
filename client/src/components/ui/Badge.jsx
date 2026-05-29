const statusStyles = {
  PENDING:   'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const paymentStyles = {
  CASH:        'bg-gray-100 text-gray-700',
  BANCOLOMBIA: 'bg-sky-100 text-sky-700',
  NEQUI:       'bg-mauve-100 text-mauve-600',
};

const statusLabels = {
  PENDING:   'Pendiente',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const paymentLabels = {
  CASH:        'Efectivo',
  BANCOLOMBIA: 'Bancolombia',
  NEQUI:       'Nequi',
  UNKNOWN:     'Sin método',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-500'}`}>
      {statusLabels[status] || status}
    </span>
  );
}

export function PaymentBadge({ method }) {
  if (!method) return null;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStyles[method] || 'bg-gray-100 text-gray-500'}`}>
      {paymentLabels[method] || method}
    </span>
  );
}
