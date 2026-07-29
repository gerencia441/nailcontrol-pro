function normalizeColombianPhone(raw) {
  if (raw === undefined || raw === null || !String(raw).trim()) return null;

  const value = String(raw).trim();
  let digits;

  if (value.startsWith('+57')) {
    digits = value.slice(3).replace(/\D/g, '');
  } else if (value.startsWith('+')) {
    throw new Error('El código de país debe ser +57 (Colombia).');
  } else {
    const stripped = value.replace(/\D/g, '');
    digits = stripped.length === 12 && stripped.startsWith('57') ? stripped.slice(2) : stripped;
  }

  if (!/^\d{10}$/.test(digits)) {
    throw new Error('Número de teléfono inválido. Debe tener 10 dígitos después de +57.');
  }

  return `+57 ${digits.slice(0, 3)} ${digits.slice(3)}`;
}

module.exports = { normalizeColombianPhone };
