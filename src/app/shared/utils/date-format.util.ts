/**
 * Convierte una fecha ISO (`YYYY-MM-DD` o `YYYY-MM-DDTHH:mm...`) a `DD/MM/YYYY`
 * sin pasar por `Date`, para no correr el día por zona horaria.
 * @param {string | null | undefined} iso - fecha ISO de la API
 * @returns {string} fecha en formato `DD/MM/YYYY`, o `—` si no hay valor
 */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}
