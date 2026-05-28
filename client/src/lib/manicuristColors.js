// Paleta de pasteles muy claros para identificar a cada manicurista.
// El color elegido se guarda en Manicurist.color (hex). Si una manicurista
// todavía no tiene color asignado, se deriva uno de forma determinista a
// partir de su id para que siempre se vea consistente en toda la app.
export const MANICURIST_PALETTE = [
  '#FFD9E1', // rosa
  '#FFE3CF', // durazno
  '#FFF3C4', // amarillo
  '#D8F5E3', // menta
  '#D6ECFF', // celeste
  '#E7DCFF', // lavanda
  '#F6D9F2', // lila
  '#FFDAD6', // coral
  '#D9F2F0', // aqua
  '#E6EBD3', // verde oliva claro
];

function hashString(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Devuelve el color de la manicurista (el asignado, o uno derivado del id).
export function resolveManicuristColor(manicurist) {
  if (manicurist?.color) return manicurist.color;
  if (manicurist?.id) {
    return MANICURIST_PALETTE[hashString(manicurist.id) % MANICURIST_PALETTE.length];
  }
  return null;
}

function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Estilo "franja lateral + tinte suave" para una tarjeta o fila de cita.
export function apptCardStyle(color) {
  if (!color) return undefined;
  return {
    borderLeftColor: color,
    borderLeftWidth: '4px',
    backgroundColor: hexToRgba(color, 0.28) || undefined,
  };
}
