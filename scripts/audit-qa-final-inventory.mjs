import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeGeneratedDocSection } from './lib/generated-doc-section.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'Frontend', 'public');
const catalogPath = path.join(publicRoot, 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json');
const outputPath = path.join(root, 'docs', 'evidenze', 'COLLAUDI.md');

export const FIXTURE_PLANS = Object.freeze({
    index: 'Nessuna scrittura; ingresso e inoltro verso Accesso.',
    'login': 'Identità QA verificata, password tecnica e Master Password DPAPI; nessun dato reale.',
    registrati: 'Solo percorso controllato o ambiente isolato; non creare nuove identità durante il passaggio ordinario.',
    reset_password: 'Solo controllo UI; non inviare e-mail durante il passaggio ordinario.',
    imposta_nuova_password: 'Solo controllo UI con collegamento sintetico dedicato quando autorizzato.',
    home_page: 'Scadenze sintetiche future, odierne, urgenti e ricevute per riepiloghi e comandi rapidi.',
    area_privata: 'Un record sintetico per Account, Condiviso, Memorandum e Memorandum condiviso.',
    account_privati: 'Quattro modalità Account, stato vuoto, ricerca, ordinamento e un archiviato escluso.',
    form_account_privato: 'Account standard, bancario, Memorandum e condiviso; Widget, credenziale comune e allegato piccolo.',
    dettaglio_account_privato: 'Record completo con password, nota, banking, Widget, credenziale comune, allegato e permessi.',
    profilo_privato: 'Anagrafica, contatti, indirizzo, utenze, Documento con allegato, tessera digitale e collegamenti Account/Scadenza.',
    lista_aziende: 'Due aziende sintetiche, una con sedi e record nelle quattro modalità Account.',
    dati_azienda: 'Azienda completa con sede, contatti, QR/tessera e riepilogo PDF sintetico.',
    modifica_azienda: 'Anagrafica, dati fiscali non validi, referente fittizio, sedi, tre e-mail non raggiungibili, note e immagini sintetiche.',
    account_azienda: 'Quattro modalità Account nell’azienda QA, ricerca, filtri, ordinamento e archiviato escluso.',
    form_account_azienda: 'Account standard, bancario, Memorandum e condiviso nel contesto aziendale; Widget e credenziale comune.',
    dettaglio_account_azienda: 'Record aziendale completo con nota, banking, Widget, allegato e permessi.',
    scadenze: 'Scadenze sintetiche proprie/ricevute, future/odierne/urgenti/archiviate e ricerca.',
    aggiungi_scadenza: 'Scadenza personale e aziendale con data, regola, destinatario non raggiungibile, pianificazione e allegato piccolo.',
    dettaglio_scadenza: 'Scadenza completa con pianificazione, fonte, destinatari, allegato e azioni permesse.',
    regole_scadenze: 'Regole sintetiche in ogni linguetta operativa e Documento personale collegato.',
    configurazione_automezzi: 'Regola veicolo con modello/targa fittizi, oggetto, testo e pianificazione.',
    configurazione_documenti: 'Tipo, modello e testo sintetici per Documento.',
    configurazione_generali: 'Tipo e testo sintetici per regola generale.',
    impostazioni: 'Preferenze QA reversibili; Account archiviato, credenziale comune, backup/archivio sintetici e diagnostica senza notifiche reali.',
    gestione_destinatari: 'Tre destinatari .invalid: privato, aziendale e disattivato; nessun recapito raggiungibile.',
    archivio_account: 'Account e Memorandum sintetici archiviati; ripristino e cancellazione soltanto delle fixture QA.',
    contatto_condiviso: 'vCard/QR completamente fittizio e privo di recapiti reali.',
    privacy: 'Nessuna fixture; lettura, navigazione, zoom, tastiera e link.',
    termini: 'Nessuna fixture; lettura, navigazione, zoom, tastiera e link.'
});

const BASELINE = new Map([
    ['login', 'BASELINE AUTOMATICA'],
    ['home_page', 'BASELINE AUTOMATICA'],
    ['profilo_privato', 'PARZIALE · dati completi e Account collegato; Scadenza rinviata alla creazione della regola QA'],
    ['lista_aziende', 'PASSA · azienda sintetica unica creata e riletta'],
    ['modifica_azienda', 'PASSA · anagrafica, sedi, contatti, immagini e allegato completi'],
    ['dati_azienda', 'PASSA · schede, segreti mascherati, QR e PDF verificati']
]);

function escapeCell(value) {
    return String(value || '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function extractTitle(html) {
    return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || '—';
}

function extractStaticFields(html) {
    const fields = new Set();
    for (const match of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
        const element = match[0];
        const id = element.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
        const name = element.match(/\bname\s*=\s*["']([^"']+)["']/i)?.[1];
        const type = element.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
        if (type === 'hidden') continue;
        const identifier = id || name;
        if (identifier) fields.add(identifier);
    }
    return [...fields].sort((left, right) => left.localeCompare(right, 'it'));
}

export async function buildQaFinalInventory() {
    const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
    const canonicalPages = (await readdir(publicRoot)).filter(name => name.endsWith('.html') && name !== 'prova.html').sort();
    assert.equal(canonicalPages.length, 30, 'Riesaminare la matrice quando cambia il numero di pagine canoniche');
    assert.deepEqual(catalog.pages.map(page => `${page.pageId}.html`).sort(), canonicalPages,
        'Catalogo Ricerca e pagine canoniche non coincidono');
    assert.deepEqual(Object.keys(FIXTURE_PLANS).sort(), catalog.pages.map(page => page.pageId).sort(),
        'Ogni pagina deve avere esattamente un piano fixture QA');

    const rows = [];
    for (const page of catalog.pages) {
        const html = await readFile(path.join(publicRoot, `${page.pageId}.html`), 'utf8');
        const staticFields = extractStaticFields(html);
        const targets = page.steps.filter(step => step.target).map(step => step.target);
        for (const target of targets) {
            const id = target.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            assert.match(html, new RegExp(`\\bid\\s*=\\s*["']${id}["']`, 'i'), `Target guida assente: ${page.pageId} ${target}`);
        }
        rows.push({
            pageId: page.pageId,
            title: extractTitle(html),
            family: page.family,
            staticFields,
            targets,
            related: page.relatedPageIds,
            fixture: FIXTURE_PLANS[page.pageId],
            status: BASELINE.get(page.pageId) || 'NON ESEGUITO'
        });
    }
    return Object.freeze({
        pages: rows,
        totals: Object.freeze({
            pages: rows.length,
            steps: catalog.pages.reduce((total, page) => total + page.steps.length, 0),
            targets: rows.reduce((total, row) => total + row.targets.length, 0),
            staticFields: rows.reduce((total, row) => total + row.staticFields.length, 0)
        })
    });
}

export function renderQaFinalInventory(inventory) {
    const { totals } = inventory;
    let markdown = '## Inventario QA finale\n\n';
    markdown += `Fonte verificata: **${totals.pages} pagine canoniche**, **${totals.steps} istruzioni**, `
        + `**${totals.targets} target guida** e **${totals.staticFields} campi HTML statici compilabili**.\n\n`;
    markdown += '> I campi creati dinamicamente dai moduli JavaScript non sono dichiarati coperti da questo inventario statico: '
        + 'vengono censiti e provati nel passaggio browser. BASELINE AUTOMATICA indica soltanto accesso/sblocco/Home, non il collaudo visivo completo della pagina.\n\n';
    markdown += '| Pagina | Famiglia | Campi HTML statici | Target guida | Fixture necessaria | Stato |\n';
    markdown += '|---|---|---|---|---|---|\n';
    for (const row of inventory.pages) {
        markdown += `| \`${row.pageId}\`<br>${escapeCell(row.title)} | ${escapeCell(row.family)} | `
            + `${row.staticFields.length}: ${escapeCell(row.staticFields.join(', '))} | `
            + `${row.targets.length}: ${escapeCell(row.targets.join(', '))} | ${escapeCell(row.fixture)} | **${row.status}** |\n`;
    }
    markdown += '\n## Regole di esecuzione\n\n';
    markdown += '- Ogni riga passa da `NON ESEGUITO` a un esito soltanto dopo controllo browser della pagina reale.\n';
    markdown += '- Per ogni percorso si registrano viewport, Console, rete, focus/tastiera, creazione, rilettura, modifica e cleanup applicabili.\n';
    markdown += '- I valori usano il prefisso `QA-SINTETICO` e domini `.invalid`; allegati e immagini sono piccoli e generati per il test.\n';
    markdown += '- Condivisioni, notifiche reali, MFA, biometria e prove fisiche restano evidenze separate e non vengono simulate come riuscite.\n';
    return markdown;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const inventory = await buildQaFinalInventory();
    await writeGeneratedDocSection(outputPath, 'pages', renderQaFinalInventory(inventory));
    console.log(`Inventario QA finale: ${inventory.totals.pages} pagine, ${inventory.totals.steps} istruzioni, `
        + `${inventory.totals.targets} target e ${inventory.totals.staticFields} campi statici.`);
}
