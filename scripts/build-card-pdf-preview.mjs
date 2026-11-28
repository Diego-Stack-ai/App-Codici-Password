#!/usr/bin/env node
import {mkdir, readFile, writeFile, copyFile, rm} from 'node:fs/promises';
import path from 'node:path';

// Sito di collaudo isolato per il PDF della Tessera digitale (issue #379, PR #380).
// Contiene il pannello reale, il modello, le azioni PDF, il bundle pdf-lib e i font.
// Firebase, sblocco, ponte del frame Vault e foto profilo sono sostituiti da adattatori
// sintetici: la pagina non contatta alcun servizio e la CSP blocca ogni origine esterna.
// Non fa parte del sito di produzione: viene generato in una cartella separata.
const root = path.resolve(import.meta.dirname, '..');
const publicRoot = path.join(root, 'Frontend/public');
const outArg = process.argv.indexOf('--out');
if (outArg < 0 || !process.argv[outArg + 1]) throw Error('Uso: node scripts/build-card-pdf-preview.mjs --out <cartella> [--sha <commit>]');
const out = path.resolve(process.argv[outArg + 1]);
const shaArg = process.argv.indexOf('--sha');
const sha = shaArg >= 0 ? String(process.argv[shaArg + 1] || '') : 'locale';
if (!/^(locale|[0-9a-f]{7,40})$/.test(sha)) throw Error('SHA non valido');
const site = path.join(out, 'public');

export const REAL_FILES = [
    'assets/js/modules/privato/digital-card-pdf.js',
    'assets/js/modules/privato/digital-card-pdf-model.js',
    'assets/js/modules/azienda/pdf/company-summary-browser.js',
    'assets/js/modules/shared/contact-card-photo.js',
    'assets/js/modules/shared/contact-card-model.js',
    'assets/js/dom-utils.js',
    'assets/js/translations/profile.js',
    'assets/js/vendor/company-summary-pdf.js',
    'assets/pdf/LiberationSans-Regular.ttf',
    'assets/pdf/LiberationSans-Bold.ttf',
    'assets/pdf/LICENSE_LIBERATION'
];
const stubs = {
    'assets/js/firebase-config.js': `export const auth = {currentUser: {uid: 'collaudo-sintetico'}};\n`,
    'assets/js/vendor/firebase-runtime.js': `export function onAuthStateChanged(_auth, callback) {callback({uid: 'collaudo-sintetico'}); return () => {};}\n`,
    'assets/js/modules/core/security-manager.js': `export function isVaultUnlocked() {return true;}\n`,
    // Come nell'app: l'azione nativa parte nello stesso clic, senza attese.
    'assets/js/modules/core/vault-frame-client.js': `export function executeFrameNativeAction(target, action) {return action(target.snapshotBytes);}\n`,
    'assets/js/translations.js': `import {profileCatalogs} from './translations/profile.js';
const lang = new URLSearchParams(location.search).get('lang') || 'it';
const catalog = profileCatalogs[lang] || profileCatalogs.it;
export function t(key) {return catalog[key] ?? profileCatalogs.it[key] ?? key;}\n`
};
const page = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Collaudo Tessera PDF</title>
<link rel="stylesheet" href="collaudo.css">
</head>
<body>
<main>
  <p class="banner">Pagina di collaudo della PR #380 — solo dati sintetici, nessun servizio collegato. Commit <code>${sha}</code>.</p>
  <h1>Tessera digitale — PDF</h1>
  <fieldset id="choices">
    <legend>Dati della Tessera da includere</legend>
    <label><input type="checkbox" name="photo" checked> Foto (sintetica)</label>
    <label><input type="checkbox" name="nome" checked> Nome e cognome</label>
    <label><input type="checkbox" name="cf" checked> Codice fiscale</label>
    <label><input type="checkbox" name="nascita"> Data e luogo di nascita</label>
    <label><input type="checkbox" name="phone" checked> Telefono (Cellulare)</label>
    <label><input type="checkbox" name="email" checked> Email (Lavoro)</label>
    <label><input type="checkbox" name="address"> Indirizzo (Residenza)</label>
    <label><input type="checkbox" name="custom" checked> Campo personalizzato «Club»</label>
  </fieldset>
  <section class="expect">
    <h2>Cosa verificare nel PDF</h2>
    <p><strong>Devono esserci</strong> solo i dati spuntati qui sopra, e la foto (quadrato rosso e blu) solo se spuntata.</p>
    <p id="expected"></p>
    <p><strong>Non devono mai esserci:</strong> SEGRETO-PIN, SEGRETO-CIFRATO, il secondo telefono +39 333 000 0002, esclusa@example.invalid.</p>
  </section>
  <div id="panel"></div>
  <p class="note">Su iPhone: «Prepara PDF», poi «Condividi PDF» apre il menu nativo; «Scarica PDF» resta disponibile. Lingua: aggiungi <code>?lang=en</code> all'indirizzo.</p>
</main>
<script type="module" src="collaudo.js"></script>
</body>
</html>
`;
const css = `:root{color-scheme:light dark;--bg:#f5f6f8;--fg:#18202b;--card:#fff;--line:#c3cad4;--accent:#0a5fb8}
@media (prefers-color-scheme:dark){:root{--bg:#11151b;--fg:#e8ecf1;--card:#1b222b;--line:#3a4552;--accent:#6fb0ff}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.45 -apple-system,system-ui,sans-serif}
main{max-width:40rem;margin:0 auto;padding:16px}
.banner{padding:.6rem .8rem;border:1px solid var(--accent);border-radius:.6rem;font-size:.85rem}
fieldset,.expect,.digital-card-pdf{background:var(--card);border:1px solid var(--line);border-radius:.8rem;padding:.8rem;margin:0 0 1rem}
fieldset label{display:flex;gap:.6rem;align-items:center;min-height:44px}
.digital-card-actions{display:flex;flex-wrap:wrap;gap:.6rem}
.digital-card-actions button{min-height:44px;padding:0 1rem;border-radius:.6rem;border:1px solid var(--accent);background:var(--accent);color:#fff;font:inherit}
.digital-card-actions button:disabled{opacity:.45}
.digital-card-warning{font-size:.9rem}.note{font-size:.85rem}
`;
const boot = `import {mountDigitalCardPdf} from './assets/js/modules/privato/digital-card-pdf.js';
// Foto sintetica disegnata sul dispositivo: nessuna richiesta di rete.
async function syntheticPhoto() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 240;
    const context = canvas.getContext('2d');
    context.fillStyle = '#c81e1e'; context.fillRect(0, 0, 240, 240);
    context.fillStyle = '#1e5ac8'; context.fillRect(60, 60, 120, 120);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
const userData = {nome: 'Mario', cognome: 'Rossi', birth_date: '01/02/1980', birth_place: 'Padova',
    photoURL: 'https://collaudo.invalid/foto-sintetica.png',
    documenti: [{type: 'Codice Fiscale', cf_value: 'RSSMRA80B01G224X'}]};
const options = {
    contactPhones: [{id: 'p1', number: '+39 333 000 0001', label: 'Cellulare'}, {id: 'p2', number: '+39 333 000 0002'}],
    contactEmails: [{id: 'e1', address: 'mario@example.invalid', label: 'Lavoro'}, {id: 'e2', address: 'esclusa@example.invalid'}],
    userAddresses: [{id: 'a1', type: 'Residenza', address: 'Via Roma', civic: '1', cap: '35100', city: 'Padova'}]};
const custom = {label: 'Tessera club', qrLabel: 'Club', type: 'identifier', value: 'CLUB-42', includeInQr: true};
const hidden = [{label: 'PIN', type: 'text', value: 'SEGRETO-PIN', includeInQr: true, sensitivity: 'secret'},
    {label: 'Cifrato', type: 'text', value: 'SEGRETO-CIFRATO', includeInQr: true, encrypted: true}];
const form = document.getElementById('choices'), panel = document.getElementById('panel'), expected = document.getElementById('expected');
let dispose = () => {};
function source() {
    const on = name => form.elements[name].checked;
    const inclusions = {photo: on('photo'), nome: on('nome'), cf: on('cf'), nascita: on('nascita'),
        phones: on('phone') ? ['p1'] : [], emails: on('email') ? ['e1'] : [], addresses: on('address') ? ['a1'] : []};
    return {userData, inclusions, options: {...options, customFields: [...(on('custom') ? [custom] : []), ...hidden]}};
}
function describe() {
    const on = name => form.elements[name].checked, items = [];
    if (on('nome')) items.push('Mario Rossi'); if (on('cf')) items.push('RSSMRA80B01G224X');
    if (on('nascita')) items.push('01/02/1980, Padova'); if (on('phone')) items.push('+39 333 000 0001');
    if (on('email')) items.push('mario@example.invalid'); if (on('address')) items.push('Via Roma 1, 35100 Padova');
    if (on('custom')) items.push('Club: CLUB-42');
    expected.textContent = 'Attesi: ' + (items.join(' · ') || 'nessun dato (il PDF deve essere rifiutato)') + (on('photo') ? ' · con foto' : ' · senza foto');
}
function mount() {
    dispose(); describe();
    dispose = mountDigitalCardPdf(panel, {getSource: source, loadPhoto: syntheticPhoto});
}
form.addEventListener('change', mount);
mount();
`;
const firebaseJson = {hosting: {public: 'public', ignore: ['firebase.json'], headers: [{source: '**', headers: [
    {key: 'Content-Security-Policy', value: "default-src 'self'; connect-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"},
    {key: 'X-Robots-Tag', value: 'noindex, nofollow'},
    {key: 'Cache-Control', value: 'no-store'},
    {key: 'Referrer-Policy', value: 'no-referrer'}]}]}};

await rm(out, {recursive: true, force: true});
for (const file of REAL_FILES) {
    await mkdir(path.dirname(path.join(site, file)), {recursive: true});
    await copyFile(path.join(publicRoot, file), path.join(site, file));
}
for (const [file, body] of Object.entries(stubs)) {
    await mkdir(path.dirname(path.join(site, file)), {recursive: true});
    await writeFile(path.join(site, file), body);
}
// Le importazioni del pannello devono risolversi tutte dentro il sito di collaudo.
const panelSource = await readFile(path.join(site, 'assets/js/modules/privato/digital-card-pdf.js'), 'utf8');
for (const [, specifier] of panelSource.matchAll(/from\s+'([^']+)'/g)) {
    const target = specifier.startsWith('/') ? path.join(site, specifier.split('?')[0]) : path.resolve(path.join(site, 'assets/js/modules/privato'), specifier.split('?')[0]);
    await readFile(target).catch(() => {throw Error('Import non coperto dal sito di collaudo: ' + specifier);});
}
await writeFile(path.join(site, 'index.html'), page);
await writeFile(path.join(site, 'collaudo.css'), css);
await writeFile(path.join(site, 'collaudo.js'), boot);
await writeFile(path.join(out, 'firebase.json'), JSON.stringify(firebaseJson, null, 2) + '\n');
console.log(`Sito di collaudo Tessera PDF in ${path.relative(root, out) || out} (commit ${sha}).`);
