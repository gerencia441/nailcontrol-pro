export function formatPhoneInput(value) {
  if (!value) return '';
  let digits = String(value).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('57')) {
    digits = digits.slice(2);
  }
  digits = digits.slice(0, 10);
  if (!digits) return '';

  let out = '+57';
  out += ` ${digits.slice(0, 3)}`;
  if (digits.length > 3) out += ` ${digits.slice(3, 10)}`;
  return out;
}

export function isValidColombianPhone(value) {
  return /^\+57 \d{3} \d{7}$/.test(String(value || '').trim());
}
