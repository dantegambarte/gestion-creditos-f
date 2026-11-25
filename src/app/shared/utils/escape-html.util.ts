const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escapa un valor que viene del servidor para interpolarlo dentro de un mensaje
 * que se renderiza como HTML (por ejemplo, ConfirmationService), de modo que se
 * muestre como texto literal y no altere el diálogo.
 * @param value - Texto a escapar; null/undefined se convierten en cadena vacía.
 * @returns El texto con `& < > " '` reemplazados por entidades HTML.
 */
export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
