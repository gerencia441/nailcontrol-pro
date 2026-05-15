const statusStyles = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const paymentStyles = {
  CASH: 'bg-emerald-100 text-emerald-700',
  BANCOLOMBIA: 'bg-blue-100 text-blue-700',
  NEQUI: 'bg-purple-100 text-purple-700',
};

const statusLabels = {
  PENDING: 'Pendiente',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
};

const paymentLabels = {
  CASH: 'Efectivo',
  BANCOLOMBIA: 'Bancolombia',
  NEQUI: 'Nequi',
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyles[status] || 'bg-gray-100 text-gray-500'}`}
    >
      {statusLabels[status] || status}
    </span>
  );
}

export function PaymentBadge({ method }) {
  if (!method) return null;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${paymentStyles[method] || 'bg-gray-100 text-gray-500'}`}
    >
      {paymentLabels[method] || method}
    </span>
  );
}
