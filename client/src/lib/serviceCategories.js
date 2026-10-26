// Catálogo de categorías de servicio. Espejo en el servidor:
// server/src/lib/serviceCategories.js (validación).
import { Hand, Footprints, Brush, Eye } from 'lucide-react';

export const SERVICE_CATEGORIES = [
  { value: 'MANICURE', label: 'Manicure', Icon: Hand },
  { value: 'PEDICURE', label: 'Pedicure', Icon: Footprints },
  { value: 'EYEBROWS', label: 'Cejas',    Icon: Brush },
  { value: 'LASHES',   label: 'Pestañas', Icon: Eye },
];

// Solo MANICURE tiene subcategorías.
export const SUBCATEGORIES_BY_CATEGORY = {
  MANICURE: [
    { value: 'NATURAL_NAIL_OVERLAY', label: 'Forrado de uña natural' },
    { value: 'ARTIFICIAL_SYSTEMS',   label: 'Sistemas artificiales' },
    { value: 'MANICURE_SERVICES',    label: 'Servicios de manicure' },
  ],
};

const BY_VALUE = Object.fromEntries(SERVICE_CATEGORIES.map((c) => [c.value, c]));

export function categoryInfo(category) {
  return BY_VALUE[category] || BY_VALUE.MANICURE;
}

export function subcategoryLabel(category, subcategory) {
  return (SUBCATEGORIES_BY_CATEGORY[category] || []).find((s) => s.value === subcategory)?.label || null;
}

// Agrupa servicios por categoría (en el orden de SERVICE_CATEGORIES) y, dentro
// de cada una, por subcategoría. Los servicios sin subcategoría van al final
// del grupo con `label: null`. Omite categorías vacías.
export function groupServicesByCategory(services = []) {
  return SERVICE_CATEGORIES.map((cat) => {
    const inCat = services.filter((s) => (s.category || 'MANICURE') === cat.value);
    const subs = SUBCATEGORIES_BY_CATEGORY[cat.value] || [];
    const groups = [
      ...subs.map((sub) => ({
        subcategory: sub.value,
        label: sub.label,
        services: inCat.filter((s) => s.subcategory === sub.value),
      })),
      {
        subcategory: null,
        label: subs.length ? 'Sin subcategoría' : null,
        services: inCat.filter((s) => !subs.some((sub) => sub.value === s.subcategory)),
      },
    ].filter((g) => g.services.length > 0);
    return { ...cat, services: inCat, groups };
  }).filter((c) => c.services.length > 0);
}
