import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { loadQaCredentialBundle } from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
if (origin !== 'https://appcodici-password.web.app' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}

const credentials = await loadQaCredentialBundle();
const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const profileDir = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-profile-'));
const fixture = Object.freeze({
    name: 'Collaudo',
    surname: 'Sintetico',
    birthDate: '1980-01-15',
    birthPlace: 'Citta QA',
    birthProvince: 'QA',
    note: 'QA-SINTETICO · nota profilo per collaudo funzionale.',
    phone: '0000000000',
    email: 'profilo.qa@appcodici-password.invalid',
    emailNote: 'QA-SINTETICO · recapito non raggiungibile.',
    address: 'Via Collaudo Sintetico',
    civic: '1',
    postalCode: '00000',
    city: 'Citta QA',
    province: 'QA',
    utility: 'QA-SINTETICO-POD-0001',
    documentNumber: 'QA-DOC-0001',
    documentIssuer: 'Ente QA non reale',
    documentPlace: 'Citta QA',
    documentIssueDate: '2030-01-15',
    documentExpiryDate: '2040-01-15',
    documentWebsite: 'https://example.invalid/qa-documento',
    documentUsername: 'QA-DOC-USER',
    documentPassword: 'QA-DOC-PASSWORD-NON-REALE',
    documentPin: '0000',
    documentPuk: '00000000',
    documentAppCode: 'QA-APP-CODE',
    documentNote: 'QA-SINTETICO · documento privo di validita.',
    attachmentName: 'qa-allegato-sintetico.txt',
    widgetTitle: 'QA Widget Profilo',
    widgetPublicLabel: 'Codice QA visibile',
    widgetPublicValue: 'QA-VIS-0001',
    widgetSecretLabel: 'Segreto QA cifrato',
    widgetSecretValue: 'QA-SEGRETO-NON-REALE'
});
const report = {
    schemaVersion: 2,
    origin,
    startedAt: new Date().toISOString(),
    actions: [],
    consoleErrors: [],
    networkErrors: []
};

function record(action, status, detail = '') {
    report.actions.push({ action, status, ...(detail ? { detail } : {}) });
}

async function fillModal(page, values, afterSave = null) {
    const modal = page.locator('#profile-edit-modal');
    await modal.waitFor({ state: 'visible', timeout: 10_000 });
    for (const [label, value] of Object.entries(values)) {
        const fields = modal.locator('.glass-field-container');
        let field = null;
        for (let index = 0; index < await fields.count(); index += 1) {
            const candidate = fields.nth(index);
            const candidateLabel = (await candidate.locator('label').first().textContent().catch(() => ''))?.trim();
            if (candidateLabel === label || candidateLabel?.startsWith(`${label} (`)) {
                field = candidate;
                break;
            }
        }
        assert.ok(field, `Campo modale non trovato: ${label}`);
        const select = field.locator('select');
        if (await select.count()) await select.selectOption({ label: value }, { force: true });
        else await field.locator('input, textarea').first().fill(value);
    }
    await modal.locator('.btn-primary').click();
    await afterSave?.();
    try {
        await modal.waitFor({ state: 'detached', timeout: 20_000 });
    } catch {
        const toast = (await page.locator('#toast').textContent().catch(() => ''))?.trim();
        throw new Error(`PROFILE_MODAL_SAVE_FAILED:${toast || 'NO_TOAST'}`);
    }
}

async function dismissConfirm(page) {
    const confirm = page.locator('#protocol-confirm-modal');
    await confirm.waitFor({ state: 'visible', timeout: 20_000 });
    const previousTitle = (await confirm.locator('.modal-title').textContent())?.trim() || '';
    await confirm.locator('#confirm-cancel-btn').click();
    await page.waitForFunction(title => {
        const current = document.getElementById('protocol-confirm-modal');
        return !current || current.querySelector('.modal-title')?.textContent?.trim() !== title;
    }, previousTitle, { timeout: 20_000 });
}

async function ensureChoiceChecked(label) {
    const input = label.locator('input[type="checkbox"]');
    if (!await input.isChecked()) await label.click();
    await assert.doesNotReject(() => input.isChecked().then(value => assert.equal(value, true)));
}

async function activateTab(page, name) {
    await page.locator(`[data-profile-tab-target="${name}"]`).click();
    await page.locator(`[data-profile-tab="${name}"]`).first().waitFor({ state: 'visible', timeout: 10_000 });
}

async function expandSection(page, name) {
    const header = page.locator(`.collapsible-header[data-section="${name}"]`);
    const container = page.locator(`#${name}-view-container`);
    if (await header.evaluate(element => element.classList.contains('collapsed'))) await header.click();
    await container.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForFunction(section => !document.getElementById(`${section}-view-container`)?.classList.contains('collapsed'), name);
}

let browser;
try {
    browser = await chromium.launchPersistentContext(profileDir, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check'],
        viewport: { width: 1440, height: 1000 }
    });
    const page = browser.pages()[0] || await browser.newPage();
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({
            text: message.text().slice(0, 400),
            resource: String(message.location()?.url || '').slice(0, 300)
        });
    });
    page.on('pageerror', error => report.consoleErrors.push({ text: String(error?.message || error).slice(0, 400), resource: 'page' }));
    page.on('response', response => {
        if (response.status() >= 400) report.networkErrors.push({ status: response.status(), url: response.url().slice(0, 300) });
    });

    await page.goto(`${origin}/login.html`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    const languageDialog = page.locator('#initial-language-dialog');
    if (await languageDialog.isVisible().catch(() => false)) {
        await languageDialog.locator('button[data-code="it"]').click();
        await languageDialog.locator('.first-configuration-primary').click();
        await page.waitForLoadState('networkidle', { timeout: 45_000 });
        await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
        record('initial-language', 'confirmed-it');
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.accountPassword);
    await page.locator('#login-submit-btn').click();
    await page.waitForURL(/\/home_page\.html(?:[?#]|$)/, { timeout: 45_000 });
    await page.locator('#protocol-input-modal-input').fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(async () => (await import('/assets/js/modules/core/security-manager.js')).isVaultUnlocked(), null, { timeout: 45_000 });

    await page.goto(`${origin}/profilo_privato.html`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    await page.locator('#profile-tabs').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('#profile-overview')?.children.length > 0, null, { timeout: 20_000 });

    await activateTab(page, 'personal');
    await page.locator('[data-action="edit-section"][data-target="dati-personali"]').click();
    await fillModal(page, {
        Nome: fixture.name,
        Cognome: fixture.surname,
        'Data di Nascita': fixture.birthDate,
        'Luogo di Nascita': fixture.birthPlace,
        'Provincia Nascita': fixture.birthProvince
    });
    await page.waitForFunction(expected => document.querySelector('#nome-view')?.textContent?.includes(expected), `${fixture.name} ${fixture.surname}`);
    record('personal-data', 'saved-and-read');

    await page.locator('[data-action="edit-section"][data-target="note"]').click();
    await fillModal(page, { Note: fixture.note });
    await page.waitForFunction(expected => document.querySelector('#note-view')?.textContent?.includes(expected), 'QA-SINTETICO');
    record('profile-note', 'saved-encrypted-and-read');

    await activateTab(page, 'contacts');
    await expandSection(page, 'telefoni');
    await expandSection(page, 'email');
    const phoneContainer = page.locator('#telefoni-view-container');
    if (!await phoneContainer.getByText(fixture.phone, { exact: true }).count()) {
        await phoneContainer.locator(':scope > .btn-upload-trigger').click();
        await fillModal(page, { Etichetta: 'Cellulare', Numero: fixture.phone, 'Telefono principale': 'Sì' });
        record('phone', 'created');
    } else record('phone', 'already-present');
    await phoneContainer.getByText(fixture.phone, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    const emailContainer = page.locator('#email-view-container');
    if (!await emailContainer.getByText(fixture.email, { exact: true }).count()) {
        await emailContainer.locator(':scope > .btn-upload-trigger').click();
        await fillModal(page, {
            Etichetta: 'Personale',
            'Indirizzo Email': fixture.email,
            'Note (opzionale)': fixture.emailNote,
            'Email principale': 'Sì'
        });
        record('email', 'created');
    } else record('email', 'already-present');
    await emailContainer.getByText(fixture.email, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

    await activateTab(page, 'addresses');
    await expandSection(page, 'indirizzi');
    const addressContainer = page.locator('#indirizzi-view-container');
    let addressCard = addressContainer.locator('.form-card').filter({ hasText: fixture.address }).first();
    if (!await addressCard.count()) {
        await addressContainer.locator(':scope > .btn-upload-trigger').click();
        await fillModal(page, {
            Tipo: 'Residenza',
            Indirizzo: fixture.address,
            Civico: fixture.civic,
            CAP: fixture.postalCode,
            'Città': fixture.city,
            Provincia: fixture.province,
            'Indirizzo principale': 'Sì'
        });
        record('address', 'created');
        addressCard = addressContainer.locator('.form-card').filter({ hasText: fixture.address }).first();
    } else record('address', 'already-present');
    await addressCard.waitFor({ state: 'visible', timeout: 15_000 });

    if (!await addressCard.getByText(fixture.utility, { exact: true }).count()) {
        await addressCard.locator('[data-action="add-utility"]').click();
        await fillModal(page, { Tipo: 'Codice POD', 'Codice / Identificativo': fixture.utility });
        record('utility', 'created-encrypted');
    } else record('utility', 'already-present');
    addressCard = addressContainer.locator('.form-card').filter({ hasText: fixture.address }).first();
    const utilityValue = addressCard.getByText(fixture.utility, { exact: true });
    if (!await utilityValue.isVisible().catch(() => false)) {
        // A successful save must survive a fresh read. Reloading here also
        // distinguishes a stale post-save render from a persistence failure.
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
        await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
        await page.locator('#profile-tabs').waitFor({ state: 'visible', timeout: 20_000 });
        await page.waitForFunction(() => document.querySelector('#profile-overview')?.children.length > 0, null, { timeout: 20_000 });
        await activateTab(page, 'addresses');
        await expandSection(page, 'indirizzi');
        const reloadedAddressCard = page.locator('#indirizzi-view-container .form-card').filter({ hasText: fixture.address }).first();
        const reloadedUtilityValue = reloadedAddressCard.getByText(fixture.utility, { exact: true });
        if (!await reloadedUtilityValue.isVisible().catch(() => false)) {
            const utilityRows = await reloadedAddressCard.locator('.card-utility-item').allTextContents();
            throw new Error(`PROFILE_UTILITY_READBACK_MISSING:${JSON.stringify(
                utilityRows.map(value => value.trim()).filter(Boolean)
            )}`);
        }
        record('utility-readback', 'passed-after-reload');
    } else {
        record('utility-readback', 'passed-immediately');
    }

    await activateTab(page, 'documents');
    await expandSection(page, 'documenti');
    const documentsContainer = page.locator('#documenti-view-container');
    let documentCard = documentsContainer.locator('.form-card').filter({ hasText: fixture.documentNumber }).first();
    if (!await documentCard.count()) {
        await page.locator('#btn-add-profile-document').click();
        await fillModal(page, {
            'Tipo Documento': 'Carta Identità',
            'Numero Carta': fixture.documentNumber,
            'Emessa da': fixture.documentIssuer,
            'Luogo Rilascio': fixture.documentPlace,
            'Data di Emissione': fixture.documentIssueDate,
            'Data di Scadenza': fixture.documentExpiryDate,
            'Home Page / Sito': fixture.documentWebsite,
            'Username / CF': fixture.documentUsername,
            Password: fixture.documentPassword,
            PIN: fixture.documentPin,
            PUK: fixture.documentPuk,
            'Codice App': fixture.documentAppCode,
            Note: fixture.documentNote
        }, async () => {
            await dismissConfirm(page); // allegato: lo gestiamo in modo deterministico dopo il salvataggio
            await dismissConfirm(page); // scadenza: sara collaudata nel lotto Scadenze
        });
        record('profile-document', 'created-with-synthetic-fields');
        documentCard = documentsContainer.locator('.form-card').filter({ hasText: fixture.documentNumber }).first();
    } else record('profile-document', 'already-present');
    await documentCard.waitFor({ state: 'visible', timeout: 20_000 });
    await documentCard.getByText(fixture.documentNumber, { exact: true }).waitFor({ state: 'visible' });
    await documentCard.getByText(fixture.documentNote, { exact: true }).waitFor({ state: 'visible' });

    let profileDocumentAttachmentAvailable = await documentCard.getByText(fixture.attachmentName, { exact: true }).count() > 0;
    if (origin !== 'https://appcodici-password.web.app') {
        record('profile-document-attachment', 'skipped-on-local-app-check-origin');
    } else if (!profileDocumentAttachmentAvailable) {
        const attachmentPath = path.join(profileDir, fixture.attachmentName);
        await writeFile(attachmentPath, 'Allegato sintetico QA. Nessun dato reale.\n', 'utf8');
        await documentCard.locator('[data-action="document-attachments"]').click();
        const attachmentsDialog = page.locator('.profile-document-attachments-dialog');
        await attachmentsDialog.waitFor({ state: 'visible', timeout: 20_000 });
        await attachmentsDialog.locator('input[accept*=".txt"]').setInputFiles(attachmentPath);
        try {
            await attachmentsDialog.getByText(/1\/10 allegati\./).waitFor({ state: 'visible', timeout: 45_000 });
            profileDocumentAttachmentAvailable = true;
            record('profile-document-attachment', 'created-encrypted');
        } catch (error) {
            const appCheckBlocked = report.networkErrors.some(entry => entry.status === 401
                && entry.url?.includes('uploadProfileDocumentAttachment'));
            if (!appCheckBlocked) throw error;
            record('profile-document-attachment', 'blocked-by-app-check-no-bypass');
        }
        await attachmentsDialog.locator('button[title="Chiudi"]').click();
        await attachmentsDialog.waitFor({ state: 'detached', timeout: 20_000 });
        documentCard = documentsContainer.locator('.form-card').filter({ hasText: fixture.documentNumber }).first();
    } else record('profile-document-attachment', 'already-present');
    if (profileDocumentAttachmentAvailable) {
        await documentCard.getByText(fixture.attachmentName, { exact: true }).first().waitFor({ state: 'visible', timeout: 20_000 });
    }

    await activateTab(page, 'personal');
    const widgetZone = page.locator('.profile-widget-zone[data-widget-zone="personal"]');
    let widgetCard = widgetZone.locator('.profile-widget').filter({ hasText: fixture.widgetTitle }).first();
    if (!await widgetCard.count()) {
        await widgetZone.locator('button[aria-label="Aggiungi widget"]').click();
        await fillModal(page, {
            Titolo: fixture.widgetTitle,
            Descrizione: 'Widget sintetico per collaudo del Profilo.',
            'Icona Material Symbols': 'verified_user',
            Colore: '#3b82f6',
            Linguetta: 'personal',
            Dimensione: 'medium'
        });
        record('profile-widget', 'created');
        widgetCard = widgetZone.locator('.profile-widget').filter({ hasText: fixture.widgetTitle }).first();
    } else record('profile-widget', 'already-present');
    await widgetCard.waitFor({ state: 'visible', timeout: 20_000 });

    if (!await widgetCard.getByText(fixture.widgetPublicLabel, { exact: true }).count()) {
        await widgetCard.getByRole('button', { name: 'Aggiungi campo' }).click();
        await fillModal(page, {
            Etichetta: fixture.widgetPublicLabel,
            Tipo: 'identifier',
            Valore: fixture.widgetPublicValue,
            'Mostra in anteprima': 'Sì',
            'Consenti copia': 'Sì',
            'Includi nel QR': 'Sì',
            'Etichetta QR': fixture.widgetPublicLabel,
            'Ordine QR': '1'
        });
        record('profile-widget-public-field', 'created');
        widgetCard = widgetZone.locator('.profile-widget').filter({ hasText: fixture.widgetTitle }).first();
    } else record('profile-widget-public-field', 'already-present');
    await widgetCard.getByText(fixture.widgetPublicValue, { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });

    if (!await widgetCard.getByText(fixture.widgetSecretLabel, { exact: true }).count()) {
        await widgetCard.getByRole('button', { name: 'Aggiungi campo' }).click();
        await fillModal(page, {
            Etichetta: fixture.widgetSecretLabel,
            Tipo: 'sensitive',
            Valore: fixture.widgetSecretValue,
            'Mostra in anteprima': 'Sì',
            'Consenti copia': 'No',
            'Includi nel QR': 'No',
            'Etichetta QR': fixture.widgetSecretLabel,
            'Ordine QR': '2'
        });
        record('profile-widget-secret-field', 'created-encrypted');
        widgetCard = widgetZone.locator('.profile-widget').filter({ hasText: fixture.widgetTitle }).first();
    } else record('profile-widget-secret-field', 'already-present');
    await widgetCard.getByText(fixture.widgetSecretLabel, { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
    await widgetCard.getByText('••••••••', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });

    await activateTab(page, 'overview');
    const qrPrimaryCoverage = [];
    for (const selector of ['#qr-toggle-nome', '#qr-toggle-cf', '#qr-toggle-nascita']) {
        const toggle = page.locator(selector);
        if (!await toggle.isVisible()) {
            qrPrimaryCoverage.push(`${selector}:not-visible-not-applicable`);
            continue;
        }
        if (!await toggle.isChecked()) await toggle.check();
        assert.equal(await toggle.isChecked(), true, `${selector} deve risultare incluso nel QR del profilo QA`);
        qrPrimaryCoverage.push(`${selector}:selected`);
    }
    record('profile-qr-primary-fields', 'checked-visible-controls', qrPrimaryCoverage.join(', '));

    await activateTab(page, 'digital-card');
    const digitalCard = page.locator('#profile-digital-card');
    await digitalCard.getByText('Anteprima Tessera digitale', { exact: true }).waitFor({ state: 'visible', timeout: 20_000 });
    await ensureChoiceChecked(digitalCard.locator('label.digital-card-choice').filter({ hasText: 'Nome e cognome' }));
    await ensureChoiceChecked(digitalCard.locator('label.digital-card-choice').filter({ hasText: 'Telefono: Cellulare' }));
    await ensureChoiceChecked(digitalCard.locator('label.digital-card-choice').filter({ hasText: 'Email: Personale' }));
    await ensureChoiceChecked(digitalCard.locator('label.digital-card-choice').filter({ hasText: 'Indirizzo: Residenza' }));
    await ensureChoiceChecked(digitalCard.locator('label.digital-card-choice').filter({ hasText: fixture.widgetPublicLabel }));
    assert.equal(await digitalCard.getByText(fixture.widgetSecretLabel, { exact: false }).count(), 0,
        'Il campo cifrato non deve essere proponibile nella Tessera digitale');
    record('digital-card', 'public-fields-selected-secret-excluded');

    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, { timeout: 20_000 });
    await page.locator('#profile-tabs').waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction(() => document.querySelector('#profile-overview')?.children.length > 0, null, { timeout: 20_000 });
    assert.match(await page.locator('#nome-view').textContent(), /Collaudo Sintetico/);
    await activateTab(page, 'contacts');
    await expandSection(page, 'telefoni');
    await expandSection(page, 'email');
    await page.locator('#telefoni-view-container').getByText(fixture.phone, { exact: true }).waitFor({ state: 'visible' });
    await page.locator('#email-view-container').getByText(fixture.email, { exact: true }).waitFor({ state: 'visible' });
    await activateTab(page, 'addresses');
    await expandSection(page, 'indirizzi');
    await page.getByText(fixture.utility, { exact: true }).waitFor({ state: 'visible' });
    await activateTab(page, 'documents');
    await expandSection(page, 'documenti');
    await page.locator('#documenti-view-container').getByText(fixture.documentNumber, { exact: true }).waitFor({ state: 'visible' });
    if (profileDocumentAttachmentAvailable) {
        await page.locator('#documenti-view-container').getByText(fixture.attachmentName, { exact: true }).first().waitFor({ state: 'visible' });
    } else {
        record('profile-document-attachment-reload', 'skipped-on-local-app-check-origin');
    }
    await activateTab(page, 'personal');
    widgetCard = page.locator('.profile-widget-zone[data-widget-zone="personal"] .profile-widget').filter({ hasText: fixture.widgetTitle }).first();
    await widgetCard.getByText(fixture.widgetPublicValue, { exact: true }).waitFor({ state: 'visible' });
    await widgetCard.getByText('••••••••', { exact: true }).waitFor({ state: 'visible' });
    await activateTab(page, 'digital-card');
    await page.locator('#profile-digital-card').getByText('Anteprima Tessera digitale', { exact: true }).waitFor({ state: 'visible' });
    record('reload-verification', 'passed');

    await mkdir(outputRoot, { recursive: true });
    await page.screenshot({ path: path.join(outputRoot, 'profile-populated.png'), fullPage: true });
    await activateTab(page, 'personal');
    widgetCard = page.locator('.profile-widget-zone[data-widget-zone="personal"] .profile-widget').filter({ hasText: fixture.widgetTitle }).first();
    await widgetCard.getByText(fixture.widgetPublicValue, { exact: true }).waitFor({ state: 'visible' });
    await widgetCard.getByText('••••••••', { exact: true }).waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(outputRoot, 'profile-widget.png'), fullPage: true });
    await activateTab(page, 'documents');
    await expandSection(page, 'documenti');
    await page.screenshot({ path: path.join(outputRoot, 'profile-documents.png'), fullPage: true });
} catch (error) {
    report.failure = String(error?.message || error).slice(0, 800);
} finally {
    await browser?.close().catch(() => {});
    const resolved = path.resolve(profileDir);
    if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('codici-password-qa-profile-')) {
        await rm(resolved, { recursive: true, force: true });
    }
}

const appCheckUrl = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
const sharingUrl = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
const profileAttachmentUrl = 'europe-west1-appcodici-password.cloudfunctions.net/uploadProfileDocumentAttachment';
const attachmentBlockedByAppCheck = report.actions.some(action => action.action === 'profile-document-attachment'
    && action.status === 'blocked-by-app-check-no-bypass');
report.consoleErrors = report.consoleErrors.filter(error => !error.resource.includes(appCheckUrl)
    && !error.resource.includes(sharingUrl)
    && !(attachmentBlockedByAppCheck && error.resource.includes(profileAttachmentUrl)));
report.consoleErrors = report.consoleErrors.filter(error => !(error.text.includes("Framing 'https://www.google.com/'")
    && error.text.includes('report-only Content Security Policy') && error.text.includes("frame-ancestors 'self'")));
report.consoleErrors = report.consoleErrors.filter(error => !(origin.startsWith('http://localhost:')
    && error.resource === `${origin}/favicon.ico` && error.text.includes('404')));
report.networkErrors = report.networkErrors.filter(error => !((error.status === 403 && error.url.includes(appCheckUrl))
    || (error.status === 401 && error.url.includes(sharingUrl))
    || (attachmentBlockedByAppCheck && error.status === 401 && error.url.includes(profileAttachmentUrl))));
report.completedAt = new Date().toISOString();
report.ok = report.actions.length >= 14 && !report.failure && !report.consoleErrors.length && !report.networkErrors.length;
await mkdir(outputRoot, { recursive: true });
await writeFile(path.join(outputRoot, 'profile-fixture.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ ok: report.ok, actions: report.actions, failure: report.failure || '',
    consoleErrors: report.consoleErrors, networkErrors: report.networkErrors,
    report: '.codex-tmp/qa-final/profile-fixture.json' }, null, 2));
if (!report.ok) process.exitCode = 1;
