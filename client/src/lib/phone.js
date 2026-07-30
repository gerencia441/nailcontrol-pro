// Extrae los 10 dígitos nacionales de lo que haya escrito o pegado la persona.
//
// Es importante quitar el prefijo "+57" del TEXTO antes de contar dígitos: el
// valor que se está editando ya contiene el prefijo, y si se cuenta como parte
// del número, cada tecla vuelve a absorber ese "57" y el campo se corrompe
// (escribir "3" mostraba "573", luego "575 730", y al llegar a 10 dígitos se
// bloqueaba).
function extractNationalDigits(value) {
  let rest = String(value ?? '').trim();

  if (rest.startsWith('+57')) {
    rest = rest.slice(3);
  } else if (rest.startsWith('+')) {
    // Otro código de país: se ignora el prefijo, la validación lo rechazará.
    rest = rest.slice(1);
  }

  let digits = rest.replace(/\D/g, '');

  // Pegar un número con indicativo pero sin "+" (ej. "573001234567").
  if (digits.length > 10 && digits.startsWith('57')) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 10);
}

export function formatPhoneInput(value) {
  const digits = extractNationalDigits(value);
  if (!digits) return '';

  let out = `+57 ${digits.slice(0, 3)}`;
  if (digits.length > 3) out += ` ${digits.slice(3)}`;
  return out;
}

// Solo los dígitos nacionales, para inputs que muestran el "+57" aparte.
export function nationalDigits(value) {
  return extractNationalDigits(value);
}

// Agrupa los dígitos nacionales como "300 1234567" (sin el prefijo).
export function formatNationalDisplay(value) {
  const digits = extractNationalDigits(value);
  if (digits.length <= 3) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

export function isValidColombianPhone(value) {
  return /^\+57 \d{3} \d{7}$/.test(String(value || '').trim());
}
