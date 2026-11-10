// Public routes are not a security boundary against same-origin script execution.
export const FRAME_PROTOCOL = 'vault-frame/v1';
export const SENSITIVE_ACTIONS = Object.freeze(['backup-export', 'portable-export', 'master-change', 'sharing-change', 'permanent-delete']);
export const FRAME_ROUTES = Object.freeze({
  home_page: [], area_privata: [], lista_aziende: [], archivio_account: [],
  configurazione_documenti: [], configurazione_generali: [],
  account_privati: ['type', 'afterWrite', 'm6refresh'],
  form_account_privato: ['id', 'type', 'profileContactId', 'linkShared'],
  dettaglio_account_privato: ['id', 'ownerId', 'afterWrite', 'm6refresh', 'linkShared'],
  account_azienda: ['id', 'type'],
  form_account_azienda: ['id', 'aziendaId', 'profileContactId', 'type', 'linkShared'],
  dettaglio_account_azienda: ['id', 'aziendaId', 'ownerId', 'afterWrite', 'serverRefresh', 'linkShared'],
  dati_azienda: ['id', 'afterWrite', 'profileTab'], modifica_azienda: ['id'],
  profilo_privato: ['profileTab', 'profileDocumentId', 'assistantDoc'],
  impostazioni: ['firstConfiguration'], scadenze: ['filter', 'rule'],
  aggiungi_scadenza: ['id', 'profileDocumentId', 'accountSource'],
  dettaglio_scadenza: ['id', 'received', 'notification'],
  regole_scadenze: ['return', 'domain'], configurazione_automezzi: ['source', 'rule', 'domain'],
  gestione_destinatari: ['return', 'companyKind', 'companyId', 'companyName']
});

export const FRAME_STANDALONE_QUERY = '__frame_standalone_once';
export function consumeFrameStandaloneMarker(win) {
  if (win.parent !== win) return false;
  const url = new URL(win.location.href);
  if (!url.searchParams.has(FRAME_STANDALONE_QUERY)) return false;
  url.searchParams.delete(FRAME_STANDALONE_QUERY); win.history.replaceState(null, '', url.href); return true;
}
export const FRAME_ANCHORS = Object.freeze({
  modifica_azienda: ['section-fiscal-main','section-referente-main','section-locations-main','section-legale','section-emails-main','section-email','section-notes-main'],
  form_account_privato: ['banking-section','shared-credentials-section','account-widgets-section'],
  form_account_azienda: ['banking-section','shared-credentials-section','account-widgets-section'],
  profilo_privato: ['profile-tabs','indirizzi-view-container','telefoni-view-container','email-view-container','documenti-view-container'],
  dati_azienda: ['wrapper-email-section','referente-container','fiscal-container','allegati-container']
});
export function frameStandaloneTarget(target, origin) {
  const url = privateFrameUrl(target, origin);
  if (!url) return null;
  url.searchParams.set(FRAME_STANDALONE_QUERY, '1'); return url;
}

export function privateFrameUrl(value, origin, nested = false) {
  try {
    if (typeof value === 'string' && value.includes('\\')) return null;
    const url = new URL(value, origin);
    if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.href.length > 4096) return null;
    if (url.pathname === '/home') url.pathname = '/home_page.html';
    const match = /^\/([a-z_]+)\.html$/.exec(url.pathname), allowed = match && FRAME_ROUTES[match[1]];
    if (url.hash && !(FRAME_ANCHORS[match?.[1]] || []).includes(url.hash.slice(1))) return null;
    if (!allowed || /[\u0000-\u001f\u007f]/.test(decodeURIComponent(url.search + url.hash))) return null;
    for (const [key, value] of url.searchParams) {
      if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1 || value.length > 1024) return null;
      if (['linkShared', 'accountSource', 'firstConfiguration', 'afterWrite', 'm6refresh', 'serverRefresh'].includes(key) && value !== '1') return null;
      const enums = {
        type: ['standard', 'shared', 'memo', 'shared_memo'],
        profileTab: ['overview', 'personal', 'contacts', 'addresses', 'documents', 'digital-card', ...(match[1] === 'dati_azienda' ? ['pdf-summary'] : [])],
        filter: ['urgenti', 'in_scadenza'], source: ['deadlineConfig', 'deadlineConfigDocuments', 'generalConfig'],
        domain: ['personal', 'vehicles', 'home', 'health', 'sport', 'contracts', 'user-company', 'company'],
        companyKind: ['external', 'company']
      };
      if (enums[key] && !enums[key].includes(value)) return null;
      if (key === 'assistantDoc' && !/^\d+$/.test(value)) return null;
      if (['id', 'ownerId', 'aziendaId', 'profileContactId', 'profileDocumentId', 'received', 'notification'].includes(key) &&
        !/^[A-Za-z0-9_-]{1,1024}$/.test(value)) return null;
      if (key === 'return') {
        if (nested) return null;
        const target = privateFrameUrl(value, origin, true);
        const routes = match[1] === 'regole_scadenze' ? ['/aggiungi_scadenza.html'] :
          ['/aggiungi_scadenza.html', '/form_account_privato.html', '/form_account_azienda.html'];
        if (!target || !routes.includes(target.pathname)) return null;
      }
    }
    return url;
  } catch { return null; }
}

export function invalidInactivityPreference(value) {
  return value !== null && value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0);
}

export function inactivityMilliseconds(value) {
  if (value === null || value === undefined) return 180_000;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 60_000;
  return value * 60_000;
}

export function safeAreaInsets(value, width, height) {
  const names = ['top', 'right', 'bottom', 'left'];
  if (!value || Object.keys(value).length !== 4 || ![width, height].every(number => typeof number === 'number' && Number.isFinite(number) && number > 0) ||
    !names.every(name => typeof value[name] === 'number' && Number.isFinite(value[name]) && value[name] >= 0) ||
    value.left + value.right > width || value.top + value.bottom > height) return null;
  return Object.freeze(Object.fromEntries(names.map(name => [name, value[name]])));
}

export function residualInsets(insets, viewport, frame) {
  const valid = safeAreaInsets(insets, viewport.width, viewport.height);
  if (!valid || ![frame.width, frame.height].every(number => typeof number === 'number' && Number.isFinite(number) && number > 0) ||
    !['top', 'right', 'bottom', 'left'].every(name => typeof frame[name] === 'number' && Number.isFinite(frame[name]))) return null;
  const clamp = (value, limit) => Math.min(limit, Math.max(0, value));
  return safeAreaInsets({top: clamp(valid.top - frame.top, frame.height),
    left: clamp(valid.left - frame.left, frame.width),
    bottom: clamp(frame.bottom - (viewport.height - valid.bottom), frame.height),
    right: clamp(frame.right - (viewport.width - valid.right), frame.width)}, frame.width, frame.height);
}
