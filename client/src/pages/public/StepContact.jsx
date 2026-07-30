import { formatPhoneInput, formatNationalDisplay } from '../../lib/phone.js';

// El prefijo +57 vive en un nodo aparte del input: así es físicamente
// imposible seleccionarlo o borrarlo, sin interceptar teclas ni manipular el
// cursor. En el estado se guarda el valor canónico completo ("+57 300 1234567")
// para que isValidColombianPhone y el envío a la API funcionen sin cambios;
// lo que se muestra es solo la parte nacional.
function PhoneField({ value, onChange, error }) {
  const display = formatNationalDisplay(value);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="booking-phone" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Celular *
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-500 select-none">
          +57
        </span>
        <input
          id="booking-phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="300 1234567"
          value={display}
          maxLength={11}
          // Lo que se escribe aquí son solo los dígitos nacionales; el prefijo
          // NO se vuelve a agregar al texto antes de formatear, porque eso hacía
          // que su "57" se contara como parte del número.
          onChange={(e) => onChange(formatPhoneInput(e.target.value))}
          className={`w-full pl-14 pr-3 py-3 rounded-xl border bg-white text-base text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${
            error
              ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-300'
              : 'border-gray-200 focus:ring-blush-300 focus:border-blush-300'
          }`}
        />
      </div>
      {error ? (
        <p className="text-xs text-rose-600">{error}</p>
      ) : (
        <p className="text-xs text-gray-400">Te escribiremos a este número para confirmar.</p>
      )}
    </div>
  );
}

export default function StepContact({ name, phone, errors, onChangeName, onChangePhone, honeypot, onChangeHoneypot }) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Solo necesitamos cómo te llamas y tu celular.
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="booking-name" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Nombre completo *
        </label>
        <input
          id="booking-name"
          type="text"
          autoComplete="name"
          placeholder="Tu nombre"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          className={`w-full px-3 py-3 rounded-xl border bg-white text-base text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 transition ${
            errors.name
              ? 'border-rose-300 focus:ring-rose-200 focus:border-rose-300'
              : 'border-gray-200 focus:ring-blush-300 focus:border-blush-300'
          }`}
        />
        {errors.name && <p className="text-xs text-rose-600">{errors.name}</p>}
      </div>

      <PhoneField value={phone} onChange={onChangePhone} error={errors.phone} />

      {/* Trampa para bots: invisible para personas, debe llegar vacío. */}
      <div className="absolute w-px h-px overflow-hidden -left-96" aria-hidden="true">
        <label htmlFor="website">No llenar</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => onChangeHoneypot(e.target.value)}
        />
      </div>

      <div className="rounded-2xl bg-blush-25 border border-blush-100 p-4">
        <p className="text-xs text-gray-600 leading-relaxed">
          Tu reserva queda <strong className="font-semibold">pendiente por confirmar</strong>. Te
          contactamos por WhatsApp o llamada para confirmarla.
        </p>
      </div>
    </div>
  );
}
