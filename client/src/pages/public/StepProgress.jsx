const LABELS = ['Servicios', 'Manicurista', 'Fecha y hora', 'Tus datos', 'Confirmar'];

export default function StepProgress({ step, total = 5 }) {
  return (
    <div className="px-5 pt-5 pb-1">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{LABELS[step - 1]}</span>
        <span className="text-xs text-gray-400">
          Paso {step} de {total}
        </span>
      </div>
      <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-blush-500' : 'bg-blush-100'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
