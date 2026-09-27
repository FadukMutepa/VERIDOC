/**
 * Utilitário de Higienização de Strings contra Cross-Site Scripting (XSS)
 * Converte caracteres perigosos em entidades HTML seguras.
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
