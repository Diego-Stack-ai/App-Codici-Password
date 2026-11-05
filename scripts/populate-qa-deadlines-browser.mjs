import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {loadQaCredentialBundle} from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
if (origin !== 'https://appcodici-password.web.app'
    && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}

const expectedEmail = 'codex.qa2@appcodici-password.invalid';
const expectedUid = '1lfhs2WoDRNXA9huOK0u0ffjQC13';
const expectedCompanyName = 'QA Azienda Sintetica SRL';
const companyId = String(process.env.CODEX_QA_COMPANY_ID || '').trim();
if (!companyId) throw new Error('QA_COMPANY_ID_REQUIRED');
if (!/^[A-Za-z0-9_-]{8,128}$/.test(companyId)) throw new Error('QA_COMPANY_ID_INVALID');
const allowDestructive = process.env.QA_ALLOW_DESTRUCTIVE === '1';
const deleteTempTrash = process.env.QA_DELETE_TEMP_TRASH === '1';
const allowIncomplete = process.env.QA_ALLOW_INCOMPLETE === '1';
const skipPrivateArchive = process.env.QA_SKIP_PRIVATE_ARCHIVE === '1';
const authorizedDuplicateCleanup = Object.freeze({
    removeId: String(process.env.QA_CLEANUP_DEADLINE_ID || '').trim(),
    keepId: String(process.env.QA_CLEANUP_KEEP_DEADLINE_ID || '').trim(),
    consent: String(process.env.QA_CLEANUP_CONFIRM || '').trim()
});
const credentials = await loadQaCredentialBundle(undefined, {expectedEmail});
if (credentials.uid !== expectedUid) throw new Error('QA2_UID_MISMATCH');
const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const browserProfile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-deadlines-'));
const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-deadline-files-'));
const attachmentName = 'qa-scadenza-allegato-sintetico.txt';
const attachmentPath = path.join(fixtureDir, attachmentName);

const ruleFixtures = Object.freeze([
    {domain: 'vehicles', name: 'QA Revisione veicolo'},
    {domain: 'home', name: 'QA Manutenzione casa'},
    {domain: 'health', name: 'QA Visita salute'},
    {domain: 'sport', name: 'QA Licenza sportiva'},
    {domain: 'contracts', name: 'QA Contratto privato'},
    {domain: 'user-company', name: 'QA Comodato aziendale'},
    {domain: 'company', name: 'QA Licenza aziendale'}
]);
const contactFixtures = Object.freeze([
    {key: 'private', first: 'QA Destinatario', last: 'Privato', email: 'scadenze.privato.qa@example.invalid', company: false, active: true},
    {key: 'company', first: 'QA Destinatario', last: 'Azienda', email: 'scadenze.azienda.qa@example.invalid', company: true, active: true},
    {key: 'suspended', first: 'QA Destinatario', last: 'Sospeso', email: 'scadenze.sospeso.qa@example.invalid', company: false, active: false}
]);

function isoOffset(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const deadlineFixtures = Object.freeze([
    {key: 'private-future', owner: 'QA Scadenza Privata', rule: 'QA Contratto privato', domain: 'contracts', dueDate: isoOffset(400), contactKey: 'private', attachment: true},
    {key: 'company-future', owner: 'QA Scadenza Aziendale', rule: 'QA Licenza aziendale', domain: 'company', dueDate: isoOffset(500), contactKey: 'company', company: true},
    {key: 'external-company', owner: 'QA Scadenza Azienda Esterna', rule: 'QA Licenza aziendale', domain: 'company', dueDate: isoOffset(550), companyExternal: true, companyName: 'QA Azienda Esterna Sintetica'},
    {key: 'today', owner: 'QA Scadenza Odierna', rule: 'QA Contratto privato', domain: 'contracts', dueDate: isoOffset(0), expectedFilter: 'all'},
    {key: 'urgent', owner: 'QA Scadenza Urgente', rule: 'QA Contratto privato', domain: 'contracts', dueDate: isoOffset(-1), expectedFilter: 'urgent'},
    {key: 'temp-trash', owner: 'QA Scadenza TEMP CESTINO', rule: 'QA Contratto privato', domain: 'contracts', dueDate: isoOffset(700), temporary: true}
]);

const report = {
    schemaVersion: 1,
    origin,
    companyId,
    allowDestructive,
    allowIncomplete,
    startedAt: new Date().toISOString(),
    fixtureIds: {},
    actions: [],
    warnings: [],
    consoleErrors: [],
    networkErrors: []
};

function record(action, status, detail = '') {
    report.actions.push({action, status, ...(detail ? {detail} : {})});
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return 'invalid-url';
    }
}

async function waitForTranslatedPage(page) {
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, {timeout: 25_000});
}

async function loginAndUnlock(page) {
    await page.goto(`${origin}/login-v115.html`, {waitUntil: 'networkidle', timeout: 45_000});
    await waitForTranslatedPage(page);
    const languageDialog = page.locator('#initial-language-dialog');
    if (await languageDialog.isVisible().catch(() => false)) {
        await languageDialog.locator('button[data-code="it"]').click();
        await languageDialog.locator('.first-configuration-primary').click();
        await page.waitForLoadState('networkidle', {timeout: 45_000});
        await waitForTranslatedPage(page);
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.accountPassword);
    await page.locator('#login-submit-btn').click();
    await page.waitForURL(/\/home_page\.html(?:[?#]|$)/, {timeout: 45_000});
    if (!await page.evaluate(() => Boolean(sessionStorage.getItem('vault_session_v1')))) {
        await page.locator('#protocol-input-modal-input').fill(credentials.masterPassword);
        await page.locator('#modal-confirm-btn').click();
    }
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, {timeout: 45_000});
    record('qa-login-and-vault', 'passed');
}

async function verifyQa2CompanyOwnership(page) {
    await page.goto(`${origin}/dati_azienda.html?id=${encodeURIComponent(companyId)}`, {
        waitUntil: 'domcontentloaded', timeout: 45_000
    });
    await waitForTranslatedPage(page);
    assert.equal(new URL(page.url()).searchParams.get('id'), companyId, 'QA_COMPANY_CONTEXT_ID_MISMATCH');
    await page.locator('#ragione-sociale').filter({hasText: expectedCompanyName})
        .waitFor({state: 'visible', timeout: 30_000});
    record('qa2-company-ownership', 'passed', companyId);
}

async function assertDeadlineNotificationsOff(page) {
    await page.goto(`${origin}/impostazioni.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    const toggle = page.locator('#deadline-push-toggle');
    await toggle.waitFor({state: 'attached', timeout: 30_000});
    await page.waitForTimeout(1_500);
    if (await toggle.isChecked()) {
        await page.screenshot({path: path.join(outputRoot, 'deadline-notifications-active-stop.png'), fullPage: true});
        throw new Error('QA_DEADLINE_NOTIFICATIONS_ACTIVE');
    }
    record('deadline-notification-interlock', 'passed-off');
}

async function fillInputModal(page, value) {
    const modal = page.locator('#protocol-input-modal');
    await modal.waitFor({state: 'visible', timeout: 15_000});
    await modal.locator('#protocol-input-modal-input').fill(String(value));
    await modal.locator('#modal-confirm-btn').click();
    // Le tre richieste della nuova regola riusano subito lo stesso id. Attendere
    // "detached" può quindi agganciarsi al modal successivo invece che a quello
    // appena confermato. La Promise UI risolve dopo la propria transizione (300 ms).
    await page.waitForTimeout(450);
}

async function ensurePersonalDocumentConfiguration(page) {
    await page.goto(`${origin}/configurazione_documenti.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    const types = page.locator('#container-types');
    if (!await types.isVisible()) {
        await page.locator('.collapsible-header[data-target="container-types"]').click();
    }
    await types.waitFor({state: 'visible', timeout: 25_000});
    await page.waitForFunction(() => document.getElementById('container-types')?.textContent?.trim().length > 0, null, {timeout: 25_000});
    assert.ok((await types.textContent()).includes('Carta Identità'), 'La configurazione Carta Identità deve essere disponibile');
    await page.screenshot({path: path.join(outputRoot, 'deadline-rule-personal-carta-identita.png'), fullPage: true});
    record('rule-personal-carta-identita', 'passed');
}

async function ensureRule(page, fixture) {
    await page.goto(`${origin}/regole_scadenze.html?domain=${encodeURIComponent(fixture.domain)}`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    const tab = page.locator(`[data-deadline-domain="${fixture.domain}"]`);
    await tab.waitFor({state: 'visible', timeout: 25_000});
    await tab.click();
    const summary = page.locator(`[data-deadline-domain-summary="${fixture.domain}"]`);
    await summary.waitFor({state: 'visible', timeout: 25_000});
    await page.waitForFunction(domain => document.querySelector(`[data-deadline-domain-summary="${domain}"]`)?.getAttribute('aria-busy') === 'false', fixture.domain, {timeout: 30_000});
    if (!await summary.getByText(fixture.name, {exact: true}).count()) {
        await page.locator(`[data-deadline-add-rule="${fixture.domain}"]`).click();
        await fillInputModal(page, fixture.name);
        await fillInputModal(page, '14');
        await fillInputModal(page, '7');
        await summary.getByText(fixture.name, {exact: true}).waitFor({state: 'visible', timeout: 30_000});
        record(`rule-${fixture.domain}`, 'created');
    } else {
        record(`rule-${fixture.domain}`, 'reused');
    }
    const card = summary.locator('.deadline-domain-config-card').filter({hasText: fixture.name}).first();
    assert.ok((await card.textContent()).includes('14'), `${fixture.name}: preavviso non visibile`);
    assert.ok((await card.textContent()).includes('7'), `${fixture.name}: frequenza non visibile`);
    await page.screenshot({path: path.join(outputRoot, `deadline-rule-${fixture.domain}.png`), fullPage: true});
}

async function contactCard(page, email) {
    return page.locator('.recipient-card').filter({hasText: email}).first();
}

async function ensureContact(page, fixture) {
    assert.ok(fixture.email.endsWith('.invalid'), `Destinatario QA non sicuro: ${fixture.email}`);
    await page.goto(`${origin}/gestione_destinatari.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.locator('#recipient-list').waitFor({state: 'visible', timeout: 25_000});
    await page.waitForFunction(() => document.getElementById('recipient-count')?.textContent !== '', null, {timeout: 25_000});
    let card = await contactCard(page, fixture.email);
    if (!await card.count()) {
        await page.locator('#recipient-first-name').fill(fixture.first);
        await page.locator('#recipient-last-name').fill(fixture.last);
        await page.locator('#recipient-email').fill(fixture.email);
        if (fixture.company) {
            const association = page.locator(`#recipient-company-options input[data-association-key="company:${companyId}"]`);
            await association.waitFor({state: 'attached', timeout: 25_000});
            await association.check();
        }
        await page.locator('#recipient-save').click();
        card = await contactCard(page, fixture.email);
        await card.waitFor({state: 'visible', timeout: 25_000});
        record(`contact-${fixture.key}`, 'created');
    } else {
        record(`contact-${fixture.key}`, 'reused');
    }
    if (fixture.company) {
        assert.ok((await card.textContent()).includes('Aziende:'), 'Il destinatario aziendale non mostra una associazione');
    }
    const isInactive = await card.evaluate(element => element.classList.contains('is-inactive'));
    if (fixture.active === isInactive) {
        await card.locator(`button[title="${fixture.active ? 'Riattiva' : 'Disattiva'}"]`).click();
        await page.waitForTimeout(800);
        card = await contactCard(page, fixture.email);
    }
    assert.equal(await card.evaluate(element => element.classList.contains('is-inactive')), !fixture.active);
    await page.screenshot({path: path.join(outputRoot, `deadline-contact-${fixture.key}.png`), fullPage: true});
}

async function waitForDeadlineList(page) {
    await waitForTranslatedPage(page);
    await page.locator('#scadenze-list').waitFor({state: 'visible', timeout: 25_000});
    await page.waitForFunction(() => Boolean(document.querySelector('#scadenze-list .deadline-card, #scadenze-list .archive-empty-state')),
        null, {timeout: 30_000});
}

async function locateDeadlineCard(page, fixture, filter = 'all') {
    await page.goto(`${origin}/scadenze.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForDeadlineList(page);
    const filterChip = page.locator(`.filter-chip[data-filter="${filter}"]`);
    await filterChip.click();
    await page.waitForFunction(value => document.querySelector(`.filter-chip[data-filter="${value}"]`)?.classList.contains('active'),
        filter, {timeout: 10_000});
    await page.locator('#deadline-search').fill(fixture.owner);
    const matches = page.locator('.deadline-card-owned').filter({hasText: fixture.owner});
    const visible = await matches.first().waitFor({state: 'visible', timeout: 15_000})
        .then(() => true).catch(() => false);
    if (!visible) return null;
    const count = await matches.count();
    const ids = await matches.evaluateAll(elements => elements.map(element => element.dataset.id).filter(Boolean));
    if (count > 1) {
        const detail = `${fixture.key}: ${ids.join(',')}`;
        if (!report.warnings.some(item => item.area === 'duplicate-deadline' && item.detail === detail)) {
            report.warnings.push({area: 'duplicate-deadline', detail});
            record(`${fixture.key}-duplicate-detected`, 'preserved-no-delete-without-authority', detail);
        }
        throw new Error(`QA_DEADLINE_FIXTURE_NOT_UNIQUE:${detail}`);
    }
    const selectedId = ids[0];
    if (!selectedId) throw new Error(`QA_DEADLINE_ID_MISSING:${fixture.key}`);
    return page.locator(`.deadline-card-owned[data-id="${selectedId}"]`).filter({hasText: fixture.owner}).first();
}

async function findDeadline(page, fixture) {
    let card = await locateDeadlineCard(page, fixture, 'all');
    if (!card) {
        card = await locateDeadlineCard(page, fixture, 'completed');
        if (card) {
            await swipe(page, card, 'right');
            await card.waitFor({state: 'detached', timeout: 30_000});
            record(`${fixture.key}-preexisting-archive`, 'restored');
            card = await locateDeadlineCard(page, fixture, 'all');
        }
    }
    if (!card) return null;
    const id = await card.getAttribute('data-id');
    if (!id) throw new Error(`QA_DEADLINE_ID_MISSING:${fixture.key}`);
    report.fixtureIds[fixture.key] = id;
    return {card, id};
}

function expectedDateBadge(iso) {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('it-IT', {day: '2-digit', month: 'short', year: '2-digit'}).toUpperCase();
}

async function openDeadlineForm(page, fixture) {
    const found = await findDeadline(page, fixture);
    if (!found) {
        await page.goto(`${origin}/aggiungi_scadenza.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
        await waitForTranslatedPage(page);
        record(fixture.key, 'created');
        return {isNew: true};
    }
    const dateBadge = (await found.card.locator('.deadline-date-badge').textContent())?.trim();
    if (dateBadge === expectedDateBadge(fixture.dueDate)) {
        await found.card.click();
        await page.waitForURL(/\/dettaglio_scadenza\.html\?id=/, {timeout: 45_000});
        record(fixture.key, 'reused');
        return {isNew: false, unchanged: true, id: found.id};
    }
    await found.card.click();
    await page.waitForURL(/\/dettaglio_scadenza\.html\?id=/, {timeout: 45_000});
    await page.locator('.btn-fab-scadenza').waitFor({state: 'visible', timeout: 25_000});
    await page.locator('.btn-fab-scadenza').click();
    await page.waitForURL(/\/aggiungi_scadenza\.html\?id=/, {timeout: 45_000});
    await waitForTranslatedPage(page);
    record(fixture.key, 'updated-date');
    return {isNew: false, unchanged: false, id: found.id};
}

async function selectRule(page, fixture) {
    await page.locator(`[data-deadline-domain="${fixture.domain}"]`).click();
    const rule = page.locator('#deadline-rule-select');
    await rule.waitFor({state: 'visible', timeout: 25_000});
    await rule.selectOption({label: fixture.rule});
    const parameter = page.locator('#deadline-parameter-select');
    await parameter.waitFor({state: 'visible', timeout: 25_000});
    await parameter.selectOption({index: 1});
    if (fixture.company || fixture.companyExternal) {
        const company = page.locator('#deadline-company-context-select');
        await company.waitFor({state: 'visible', timeout: 25_000});
        if (fixture.companyExternal) {
            await company.selectOption('external');
            const externalName = page.locator('#deadline-external-company-name');
            await externalName.waitFor({state: 'visible', timeout: 10_000});
            await externalName.fill(fixture.companyName);
        } else {
            await company.selectOption(companyId);
        }
    }
}

async function selectDateThroughUi(page, isoDate) {
    const [targetYear, targetMonth, targetDay] = isoDate.split('-').map(Number);
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
        'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    const trigger = page.locator('#dueDate');
    await trigger.click();
    const modal = page.locator('#datepicker-modal-v5');
    if (!await modal.isVisible().catch(() => false)) {
        assert.ok(await trigger.evaluate(element => element.classList.contains('input-datepicker-trigger')),
            'QA_DATEPICKER_NOT_INITIALIZED');
        await trigger.dispatchEvent('click');
    }
    await modal.waitFor({state: 'visible', timeout: 15_000});
    let guard = 0;
    while (guard++ < 40) {
        const title = (await modal.locator('.dp-title-btn').textContent()).trim();
        const currentYear = Number(title.slice(-4));
        const currentMonth = months.findIndex(month => title.startsWith(month)) + 1;
        if (!currentYear || !currentMonth) throw new Error(`QA_DATEPICKER_TITLE_INVALID:${title}`);
        const delta = (targetYear - currentYear) * 12 + (targetMonth - currentMonth);
        if (delta === 0) break;
        await modal.locator(`button[title="${delta > 11 ? 'Anno successivo' : delta < -11 ? 'Anno precedente'
            : delta > 0 ? 'Mese successivo' : 'Mese precedente'}"]`).click();
    }
    if (guard >= 40) throw new Error(`QA_DATEPICKER_NAVIGATION_GUARD:${isoDate}`);
    await modal.locator('.dp-day:not(.empty)').filter({hasText: new RegExp(`^${targetDay}$`)}).click();
    await modal.locator('.dp-btn-fill').click();
    await modal.waitFor({state: 'detached', timeout: 15_000});
    assert.equal(await page.locator('#dueDate').evaluate(element => element.dataset.isoValue), isoDate);
}

async function selectPausedRecipient(page, fixture) {
    if (!fixture.contactKey) return;
    const contact = contactFixtures.find(item => item.key === fixture.contactKey);
    assert.ok(contact?.email.endsWith('.invalid'));
    const select = page.locator('#deadline-contact-select');
    const option = select.locator('option').filter({hasText: contact.email}).first();
    await option.waitFor({state: 'attached', timeout: 25_000});
    await select.selectOption(await option.getAttribute('value'));
    const card = page.locator('.deadline-recipient-card').filter({hasText: contact.email}).first();
    await card.waitFor({state: 'visible', timeout: 25_000});
    const emails = await page.locator('.deadline-recipient-email').allTextContents();
    if (emails.some(email => !String(email).trim().toLowerCase().endsWith('.invalid'))) {
        throw new Error(`QA_UNSAFE_RECIPIENT_PRESENT:${emails.join(',')}`);
    }
    for (const channel of ['email', 'push', 'manage']) {
        const toggle = card.locator(`input[data-channel="${channel}"]`);
        if (await toggle.count() && await toggle.isChecked()) await toggle.uncheck();
    }
    for (const toggle of await card.locator('input[data-channel]').all()) {
        assert.equal(await toggle.isChecked(), false, `Canale destinatario ancora attivo: ${contact.email}`);
    }
    assert.ok(await card.evaluate(element => element.classList.contains('is-paused')),
        `Il destinatario ${contact.email} deve risultare sospeso`);
}

async function attachFixture(page) {
    if (await page.locator('#attachments-list').getByText(attachmentName, {exact: true}).count()) return;
    await page.locator('#btn-trigger-upload').click();
    await page.locator('#source-selector-modal').waitFor({state: 'visible', timeout: 15_000});
    await page.locator('#source-selector-modal [data-source="file"]').click();
    await page.locator('#input-file').setInputFiles(attachmentPath);
    await page.locator('#attachments-list').getByText(attachmentName, {exact: true}).waitFor({state: 'visible', timeout: 20_000});
}

async function populateDeadline(page, fixture) {
    const form = await openDeadlineForm(page, fixture);
    if (form.unchanged) {
        await verifyDeadlineDetail(page, fixture, form.id);
        return;
    }
    await page.locator('#nome_cognome').waitFor({state: 'visible', timeout: 25_000});
    if (form.isNew) await selectRule(page, fixture);
    await page.locator('#nome_cognome').fill(fixture.owner);
    await selectDateThroughUi(page, fixture.dueDate);
    await page.locator('#deadline_url').fill(`https://example.invalid/qa-scadenza/${fixture.key}`);
    await page.locator('#notes').fill(`QA-SINTETICO · ${fixture.owner} · nessun dato reale.`);
    await selectPausedRecipient(page, fixture);
    if (fixture.attachment) await attachFixture(page);
    const recipientEmails = await page.locator('.deadline-recipient-email').allTextContents();
    if (recipientEmails.some(email => !String(email).trim().toLowerCase().endsWith('.invalid'))) {
        throw new Error(`QA_UNSAFE_RECIPIENT_BEFORE_SAVE:${recipientEmails.join(',')}`);
    }
    const activeChannels = await page.locator('.deadline-recipient-card input[data-channel]:checked').count();
    if (activeChannels) throw new Error(`QA_RECIPIENT_CHANNEL_ACTIVE:${fixture.key}:${activeChannels}`);
    await page.screenshot({path: path.join(outputRoot, `deadline-${fixture.key}-form.png`), fullPage: true});
    await page.locator('#save-btn').click();
    await page.waitForURL(/\/dettaglio_scadenza\.html\?id=/, {timeout: 75_000});
    const id = new URL(page.url()).searchParams.get('id');
    if (!id) throw new Error(`QA_DEADLINE_SAVE_ID_MISSING:${fixture.key}`);
    report.fixtureIds[fixture.key] = id;
    await verifyDeadlineDetail(page, fixture, id);
}

async function verifyDeadlineDetail(page, fixture, id) {
    await page.locator('#detail-intestatario').waitFor({state: 'visible', timeout: 25_000});
    await page.waitForFunction(({owner, rule}) => {
        const ownerText = document.getElementById('detail-intestatario')?.textContent?.trim();
        const ruleText = document.getElementById('detail-category')?.textContent?.trim();
        return ownerText === owner && ruleText === rule;
    }, {owner: fixture.owner, rule: fixture.rule}, {timeout: 30_000});
    assert.equal((await page.locator('#detail-intestatario').textContent()).trim(), fixture.owner);
    assert.equal((await page.locator('#detail-category').textContent()).trim(), fixture.rule);
    if (fixture.attachment) {
        await page.locator('#section-attachments').waitFor({state: 'visible', timeout: 25_000});
        assert.equal(await page.locator('#display-attachments').getByText(attachmentName, {exact: true}).count(), 1,
            'L’allegato QA deve apparire una sola volta');
    }
    report.fixtureIds[fixture.key] = id;
    await page.screenshot({path: path.join(outputRoot, `deadline-${fixture.key}-detail.png`), fullPage: true});
    record(`${fixture.key}-detail`, 'passed');
    if (fixture.companyExternal) {
        await page.locator('.btn-fab-scadenza').click();
        await page.waitForURL(/\/aggiungi_scadenza\.html\?id=/, {timeout: 45_000});
        await waitForTranslatedPage(page);
        await page.locator('#deadline-company-context-select').waitFor({state: 'visible', timeout: 25_000});
        assert.equal(await page.locator('#deadline-company-context-select').inputValue(), 'external');
        assert.equal(await page.locator('#deadline-external-company-name').inputValue(), fixture.companyName);
        record(`${fixture.key}-external-company-readback`, 'passed', fixture.companyName);
    }
}

async function verifyListFilter(page, fixture, filter) {
    const card = await locateDeadlineCard(page, fixture, filter);
    assert.ok(card, `${fixture.key} non trovata nel filtro ${filter}`);
    assert.equal(await card.getAttribute('data-id'), report.fixtureIds[fixture.key]);
    await page.screenshot({path: path.join(outputRoot, `deadline-${fixture.key}-filter-${filter}.png`), fullPage: true});
    record(`${fixture.key}-filter-${filter}`, 'passed');
}

async function swipe(page, row, direction) {
    const box = await row.boundingBox();
    if (!box) throw new Error('QA_SWIPE_TARGET_MISSING');
    const y = box.y + Math.min(box.height / 2, 80);
    const from = direction === 'right' ? box.x + Math.min(40, box.width / 6) : box.x + box.width - Math.min(40, box.width / 6);
    const to = direction === 'right' ? box.x + box.width * 0.72 : box.x + box.width * 0.28;
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, {steps: 12});
    await page.mouse.up();
}

async function verifyArchiveRestore(page, fixture) {
    let found = await findDeadline(page, fixture);
    assert.ok(found && found.id === report.fixtureIds[fixture.key]);
    await swipe(page, found.card, 'right');
    await found.card.waitFor({state: 'detached', timeout: 30_000});
    record(`${fixture.key}-archive`, 'passed');
    const archived = await locateDeadlineCard(page, fixture, 'completed');
    assert.ok(archived, 'La scadenza archiviata non è consultabile nel filtro Archiviate');
    assert.equal(await archived.getAttribute('data-id'), report.fixtureIds[fixture.key]);
    await archived.click();
    await page.waitForURL(/\/dettaglio_scadenza\.html\?id=/, {timeout: 45_000});
    await verifyDeadlineDetail(page, fixture, report.fixtureIds[fixture.key]);
    const archivedAgain = await locateDeadlineCard(page, fixture, 'completed');
    await swipe(page, archivedAgain, 'right');
    await archivedAgain.waitFor({state: 'detached', timeout: 30_000});
    found = await findDeadline(page, fixture);
    assert.ok(found && found.id === report.fixtureIds[fixture.key]);
    await page.screenshot({path: path.join(outputRoot, `deadline-${fixture.key}-after-restore.png`), fullPage: true});
    record(`${fixture.key}-restore`, 'passed');
}

async function exerciseTempTrash(page) {
    const fixture = deadlineFixtures.find(item => item.key === 'temp-trash');
    const found = await findDeadline(page, fixture);
    assert.ok(found && found.id === report.fixtureIds[fixture.key]);
    const cardId = await found.card.getAttribute('data-id');
    const cardText = await found.card.textContent();
    if (!cardId || cardId !== report.fixtureIds['temp-trash']) throw new Error('QA_DESTRUCTIVE_TARGET_NOT_IDENTIFIED');
    if (!cardText?.toLocaleLowerCase('it-IT').includes(fixture.owner.toLocaleLowerCase('it-IT'))) {
        throw new Error('QA_DESTRUCTIVE_TARGET_TEXT_MISMATCH');
    }
    await swipe(page, found.card, 'left');
    const modal = page.locator('#protocol-confirm-modal');
    await modal.waitFor({state: 'visible', timeout: 15_000});
    await page.screenshot({path: path.join(outputRoot, 'deadline-temp-trash-confirmation.png'), fullPage: true});
    if (!allowDestructive || !deleteTempTrash) {
        await modal.locator('#confirm-cancel-btn').click();
        record('temp-trash-permanent-delete', 'confirmation-only-safe-default');
        return;
    }
    await modal.locator('#confirm-ok-btn').click();
    await found.card.waitFor({state: 'detached', timeout: 45_000});
    record('temp-trash-permanent-delete', 'passed-explicit-opt-in', cardId);
}

async function cleanupAuthorizedPrivateFutureDuplicate(page) {
    const {removeId, keepId, consent} = authorizedDuplicateCleanup;
    if (!removeId && !keepId) return;
    if (!allowDestructive || consent !== 'DELETE_SYNTHETIC_DUPLICATE') {
        throw new Error('QA_DUPLICATE_CLEANUP_DESTRUCTIVE_AUTH_REQUIRED');
    }
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(removeId) || !/^[A-Za-z0-9_-]{8,128}$/.test(keepId)
        || removeId === keepId) throw new Error('QA_DUPLICATE_CLEANUP_IDS_INVALID');
    const fixture = deadlineFixtures.find(item => item.key === 'private-future');
    await page.goto(`${origin}/scadenze.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForDeadlineList(page);
    const idsForFilter = async filter => {
        await page.locator(`.filter-chip[data-filter="${filter}"]`).click();
        await page.locator('#deadline-search').fill(fixture.owner);
        await page.waitForTimeout(750);
        return page.locator('.deadline-card-owned').filter({hasText: fixture.owner})
            .evaluateAll(elements => elements.map(element => element.dataset.id).filter(Boolean));
    };
    const activeIds = await idsForFilter('all');
    const archivedIds = await idsForFilter('completed');
    const ids = [...new Set([...activeIds, ...archivedIds])];
    if (ids.length === 1 && ids[0] === keepId) {
        report.fixtureIds['private-future'] = keepId;
        record('private-future-duplicate-cleanup', 'already-single-canonical-record',
            `remaining=${keepId};authorized-pair=${removeId},${keepId}`);
        return;
    }
    if (ids.length === 1 && ids[0] === removeId) {
        throw new Error(`QA_DUPLICATE_CLEANUP_KEEPER_MISSING:${removeId}`);
    }
    if (ids.length !== 2 || !ids.includes(removeId) || !ids.includes(keepId)) {
        throw new Error(`QA_DUPLICATE_CLEANUP_IDENTITY_NOT_UNIQUE:${ids.join(',')}`);
    }
    await page.locator('.filter-chip[data-filter="all"]').click();
    const target = page.locator(`.deadline-card-owned[data-id="${removeId}"]`).filter({hasText: fixture.owner});
    assert.equal(await target.count(), 1, 'La copia da rimuovere deve essere univoca');
    assert.ok(archivedIds.includes(keepId), 'La copia canonica archiviata da conservare deve essere univoca');
    assert.ok((await target.textContent()).includes(fixture.rule), 'La copia da rimuovere non corrisponde alla regola attesa');
    await swipe(page, target, 'left');
    const modal = page.locator('#protocol-confirm-modal');
    await modal.waitFor({state: 'visible', timeout: 15_000});
    await page.screenshot({path: path.join(outputRoot, 'deadline-private-future-duplicate-cleanup-confirmation.png'), fullPage: true});
    await modal.locator('#confirm-ok-btn').click();
    await page.waitForTimeout(1_500);
    await page.goto(`${origin}/scadenze.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForDeadlineList(page);
    const remainingActiveIds = await idsForFilter('all');
    const remainingArchivedIds = await idsForFilter('completed');
    assert.ok(!remainingActiveIds.includes(removeId) && !remainingArchivedIds.includes(removeId),
        'La copia QA autorizzata risulta ancora presente dopo la conferma');
    assert.equal(remainingArchivedIds.filter(id => id === keepId).length, 1,
        'Il record canonico non risulta univoco dopo la bonifica');
    report.fixtureIds['private-future'] = keepId;
    record('private-future-duplicate-cleanup', 'passed-explicit-authority', `removed=${removeId};kept=${keepId}`);
}

await mkdir(outputRoot, {recursive: true});
await writeFile(attachmentPath, 'QA-SINTETICO\nAllegato Scadenza non reale.\n', 'utf8');
let browser;
let activePage;
try {
    browser = await chromium.launchPersistentContext(browserProfile, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check'],
        viewport: {width: 1440, height: 1000},
        acceptDownloads: false
    });
    const page = browser.pages()[0] || await browser.newPage();
    activePage = page;
    page.on('console', message => {
        if (message.type() === 'error') report.consoleErrors.push({text: message.text().slice(0, 400), source: safeUrl(message.location()?.url || '')});
    });
    page.on('pageerror', error => report.consoleErrors.push({
        text: String(error?.message || error).slice(0, 400),
        source: safeUrl(page.url()),
        stack: String(error?.stack || '').slice(0, 1200)
    }));
    page.on('response', response => {
        if (response.status() >= 400) report.networkErrors.push({status: response.status(), resource: safeUrl(response.url())});
    });

    await loginAndUnlock(page);
    await verifyQa2CompanyOwnership(page);
    await assertDeadlineNotificationsOff(page);
    await ensurePersonalDocumentConfiguration(page);
    for (const fixture of ruleFixtures) await ensureRule(page, fixture);
    for (const fixture of contactFixtures) await ensureContact(page, fixture);
    await cleanupAuthorizedPrivateFutureDuplicate(page);
    const exercisedFixtures = deadlineFixtures.filter(fixture => !(skipPrivateArchive && fixture.key === 'private-future'));
    for (const fixture of exercisedFixtures) await populateDeadline(page, fixture);
    await verifyListFilter(page, deadlineFixtures.find(item => item.key === 'today'), 'all');
    await verifyListFilter(page, deadlineFixtures.find(item => item.key === 'urgent'), 'urgent');
    if (skipPrivateArchive) record('private-future-archive-restore', 'deferred-duplicate-awaiting-user-consent');
    else await verifyArchiveRestore(page, deadlineFixtures.find(item => item.key === 'private-future'));
    await exerciseTempTrash(page);

    const idsBefore = {...report.fixtureIds};
    for (const fixture of exercisedFixtures.filter(item => !item.temporary || !(allowDestructive && deleteTempTrash))) {
        const found = await findDeadline(page, fixture);
        assert.ok(found, `Fixture assente al controllo idempotenza: ${fixture.key}`);
        assert.equal(found.id, idsBefore[fixture.key], `ID cambiato al controllo idempotenza: ${fixture.key}`);
    }
    record('deadline-idempotency', 'passed-same-ids');
} catch (error) {
    report.failure = String(error?.message || error).slice(0, 800);
    record('qa-deadlines-runner', 'failed', report.failure);
    await activePage?.screenshot({path: path.join(outputRoot, 'qa-deadlines-failure.png'), fullPage: true}).catch(() => {});
} finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(outputRoot, 'qa-deadlines-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await browser?.close().catch(() => {});
    for (const candidate of [browserProfile, fixtureDir]) {
        const resolved = path.resolve(candidate);
        if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('codici-password-qa-deadline')) {
            await rm(resolved, {recursive: true, force: true});
        }
    }
}

const appCheckUrl = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
const sharingUrl = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
report.consoleErrors = report.consoleErrors.filter(error => !error.source.includes(appCheckUrl));
report.consoleErrors = report.consoleErrors.filter(error => !(error.text.includes('status of 401')
    && error.source.includes(sharingUrl)));
report.consoleErrors = report.consoleErrors.filter(error => !(error.text.includes("Framing 'https://www.google.com/'")
    && error.text.includes('report-only Content Security Policy') && error.text.includes("frame-ancestors 'self'")));
report.networkErrors = report.networkErrors.filter(error => !((error.status === 403 && error.resource.includes(appCheckUrl))
    || (error.status === 401 && error.resource.includes(sharingUrl))));
report.runCompleted = !report.failure && !report.consoleErrors.length && !report.networkErrors.length
    && report.actions.some(action => action.action === 'deadline-idempotency' && action.status === 'passed-same-ids');
const deferred = report.actions.some(action => action.status.startsWith('deferred-'));
report.gatePassed = report.runCompleted && !deferred;
report.executionAccepted = report.runCompleted && (report.gatePassed || allowIncomplete);
report.ok = report.executionAccepted;
await writeFile(path.join(outputRoot, 'qa-deadlines-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
    ok: report.ok,
    runCompleted: report.runCompleted,
    gatePassed: report.gatePassed,
    executionAccepted: report.executionAccepted,
    allowIncomplete,
    actions: report.actions,
    fixtureIds: report.fixtureIds,
    failure: report.failure || '',
    consoleErrors: report.consoleErrors,
    networkErrors: report.networkErrors,
    report: '.codex-tmp/qa-final/qa-deadlines-report.json'
}, null, 2));
if (!report.ok) process.exitCode = 1;
