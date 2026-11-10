// Preparation only. These routes are synthetic fixtures in the loopback lab.
export const FRAME_PROTOCOL = 'vault-frame-lab/v1';
export const PRIVATE_FRAME_PATHS = Object.freeze([
  '/home_page.html', '/area_privata.html', '/account_privati.html',
  '/lista_aziende.html', '/account_azienda.html', '/dettaglio_account_privato.html',
  '/dettaglio_account_azienda.html', '/profilo_privato.html', '/dati_azienda.html', '/scadenze.html',
]);
export const SENSITIVE_ACTIONS = Object.freeze([
  'backup-export', 'portable-export', 'master-change', 'sharing-change', 'permanent-delete',
]);

export function privateFrameUrl(value, origin) {
  if (typeof value !== 'string' || value.length > 2048 || /[\\\u0000-\u0020]/.test(value)) return null;
  try {
    const base = new URL(origin);
    if (!['https:', 'http:'].includes(base.protocol) || base.origin !== origin) return null;
    const url = new URL(value, origin);
    if (url.origin !== origin || url.protocol !== base.protocol || url.username || url.password || url.hash) return null;
    const rawPath = value.startsWith(origin) ? value.slice(origin.length).split('?')[0] : value.split('?')[0];
    if (rawPath.startsWith('//') || /%(?:25|2e|2f|5c)/i.test(rawPath) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath)) return null;
    if (!PRIVATE_FRAME_PATHS.includes(url.pathname)) return null;
    for (const [key, item] of url.searchParams) {
      if (!['id', 'filter', 'profileTab'].includes(key) || !/^[\w-]{1,120}$/.test(item) || url.searchParams.getAll(key).length !== 1) return null;
    }
    return url;
  } catch { return null; }
}
