import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'docs', 'FILE_INVENTORY.md');
const candidates = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root })
  .toString('utf8').split('\0').filter(Boolean)
  .filter(file => !file.includes('node_modules/') && !file.startsWith('.codex-worktrees/'))
  .filter(file => !path.basename(file).startsWith('~$'))
  .filter(file => file !== 'docs/FILE_INVENTORY.md');
const tracked = [];
for (const file of candidates) {
  try {
    await access(path.join(root, file));
    tracked.push(file);
  } catch {
    // Una cancellazione non ancora indicizzata può essere ancora elencata da git ls-files.
  }
}

const exactPurpose = new Map(Object.entries({
  '.firebaserc': 'Associa Firebase CLI al progetto appcodici-password.',
  'firebase.json': 'Configura Hosting, header di sicurezza, emulatori, Firestore, Storage e Functions.',
  'firestore.rules': 'Autorizzazioni Firestore per proprietari, condivisioni, inviti e notifiche.',
  'firestore.indexes.json': 'Indici Firestore, incluso array-contains collection-group degli account condivisi.',
  'storage.rules': 'Limiti, MIME e isolamento UID degli upload Firebase Storage.',
  'package.json': 'Comandi di audit, test e versione; dipendenze di sviluppo della radice.',
  'functions/package.json': 'Runtime e dipendenze delle Cloud Functions.',
  'functions/index.js': 'Backend MFA recovery, inviti, email, push e scheduler delle scadenze.',
  'functions/recovery-security.js': 'Generazione, hash e rate-limit dei codici MFA di recupero.',
  'Frontend/public/sw.js': 'Service worker: shell offline, cache runtime, push in background e deep link.',
  'Frontend/public/manifest.json': 'Manifest PWA, icone, nome, scope e pagina iniziale.',
  'Frontend/public/assets/js/main-v129.js': 'Bootstrap autenticato globale, router, inviti e notifiche.',
  'Frontend/public/assets/js/login-entry.js': 'Bootstrap minimo della pagina di accesso.',
  'Frontend/public/assets/js/pages-init.js': 'Router con import dinamici dei moduli pagina.',
  'Frontend/public/assets/js/firebase-config.js': 'Singleton Firebase e cache Firestore persistente multi-tab.',
  'Frontend/public/assets/js/auth.js': 'Registrazione, login, TOTP, logout e reset account Firebase Auth.',
  'Frontend/public/assets/js/components-v129.js': 'Header, footer e navigazione condivisa.',
  'Frontend/public/assets/js/ui-core-v129.js': 'Toast, modali, input protetti e componenti UI globali.',
  'Frontend/public/assets/js/dom-utils.js': 'Creazione DOM sicura e protezione da inserimenti HTML arbitrari.',
  'Frontend/public/assets/js/inactivity-timer.js': 'Blocco Vault dopo inattività secondo la preferenza utente.',
  'Frontend/public/assets/js/theme-init.js': 'Applica il tema prima del rendering per evitare lampeggiamenti.',
  'Frontend/public/assets/js/translations.js': 'Dizionario italiano e caricamento differito delle altre lingue.',
  'Frontend/public/assets/js/modules/core/security-manager.js': 'Orchestrazione Master Password, envelope Vault e sblocco biometrico.',
  'Frontend/public/assets/js/modules/core/crypto-utils.js': 'Primitive KDF, AES-GCM, verifier e codifiche crittografiche.',
  'Frontend/public/assets/js/modules/core/vault-session.js': 'Sessione Vault cifrata e limitata alla scheda/browser session.',
  'Frontend/public/assets/js/modules/core/webauthn-manager.js': 'Registrazione e uso WebAuthn/PRF della credenziale locale.',
  'Frontend/public/assets/js/modules/core/mfa-manager.js': 'Enroll, rimozione, recupero e revoca sessioni TOTP.',
  'Frontend/public/assets/js/modules/shared/attachment-security.js': 'Validazione e cifratura degli allegati prima di Storage.',
  'Frontend/public/assets/js/modules/shared/push-manager.js': 'Registrazione dispositivo FCM e preferenze push per ambito.',
  'Frontend/public/assets/js/modules/shared/banking-renderer.js': 'Renderer condiviso per conti bancari e carte.',
  'Frontend/public/assets/js/modules/shared/qr_code_utils.js': 'Caricamento QR e generazione vCard.',
}));

function purpose(file) {
  if (exactPurpose.has(file)) return exactPurpose.get(file);
  const name = path.basename(file, path.extname(file)).replaceAll('_', ' ');
  if (/home-v12[6-9]\.html$/.test(file)) return 'Redirect storico di compatibilità verso la Home canonica.';
  if (file.endsWith('.html')) return `Struttura della pagina ${name}; comportamento demandato ai moduli.`;
  if (file.includes('/assets/css/')) return `Stili della ${name === 'core' ? 'base e dei token globali' : `sezione ${name}`}.`;
  if (file.includes('/translations/')) return `Dizionario differito per la lingua ${name}.`;
  if (file.includes('/modules/assistant/')) return `Modulo dell’assistente Vault: ${name}.`;
  if (file.includes('/modules/auth/')) return `Flusso autenticazione: ${name}.`;
  if (file.includes('/modules/azienda/')) return `Flusso aziende/account aziendali: ${name}.`;
  if (file.includes('/modules/privato/')) return `Flusso profilo/account personali: ${name}.`;
  if (file.includes('/modules/scadenze/')) return `Flusso scadenze/configurazione: ${name}.`;
  if (file.includes('/modules/settings/')) return `Impostazioni applicative: ${name}.`;
  if (file.includes('/assets/js/')) return `Supporto frontend: ${name}.`;
  if (file.includes('/assets/fonts/')) return `Font locale ${path.basename(file)}.`;
  if (file.includes('/assets/images/')) return `Asset immagine ${path.basename(file)}.`;
  if (file.startsWith('scripts/')) return `Strumento manutenzione/test: ${name}.`;
  if (file.startsWith('tests/') || file.includes('/test/')) return `Test automatico: ${name}.`;
  if (file.endsWith('package-lock.json')) return 'Lockfile riproducibile delle dipendenze npm.';
  if (file.endsWith('.md')) return `Documentazione: ${name}.`;
  if (file.endsWith('.gitignore')) return 'Esclusioni Git per file generati o locali.';
  return `File di progetto: ${name}.`;
}

function kind(file) {
  const ext = path.extname(file).slice(1).toUpperCase();
  if (file.endsWith('.rules')) return 'RULES';
  if (file.endsWith('.woff2')) return 'FONT';
  return ext || 'CONFIG';
}

const rows = [];
const hashGroups = new Map();
for (const file of tracked) {
  const bytes = await readFile(path.join(root, file));
  const hash = createHash('sha256').update(bytes).digest('hex');
  hashGroups.set(hash, [...(hashGroups.get(hash) || []), file]);
  const binary = /\.(?:png|jpe?g|woff2|docx)$/i.test(file);
  rows.push({
    file,
    type: kind(file),
    bytes: bytes.length,
    lines: binary ? '—' : bytes.toString('utf8').split(/\r?\n/).length,
    purpose: purpose(file),
  });
}

const duplicates = [...hashGroups.values()].filter(group => group.length > 1);
const escape = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const sections = new Map();
for (const row of rows) {
  const section = row.file.split('/')[0];
  sections.set(section, [...(sections.get(section) || []), row]);
}

let markdown = '# Inventario completo dei file\n\n';
markdown += '> Generato da `npm run audit:inventory`. Ogni file sorgente viene letto integralmente per calcolare metadati e hash. I file in `node_modules` e questo rapporto generato sono esclusi dal conteggio.\n\n';
markdown += `File censiti: **${rows.length}**. Duplicati byte-per-byte: **${duplicates.length} gruppi**.\n\n`;
for (const [section, items] of sections) {
  markdown += `## ${section}\n\n| File | Tipo | Byte | Righe | Responsabilità |\n|---|---:|---:|---:|---|\n`;
  for (const row of items) markdown += `| \`${escape(row.file)}\` | ${row.type} | ${row.bytes} | ${row.lines} | ${escape(row.purpose)} |\n`;
  markdown += '\n';
}
markdown += '## Duplicati esatti\n\n';
markdown += duplicates.length ? duplicates.map(group => `- ${group.map(file => `\`${file}\``).join(' = ')}`).join('\n') : 'Nessun file sorgente è identico byte-per-byte.';
markdown += '\n';

await writeFile(output, markdown, 'utf8');
console.log(`Inventario scritto: ${path.relative(root, output)} (${rows.length} file).`);
