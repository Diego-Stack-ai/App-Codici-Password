import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {loadQaCredentialBundle} from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
if (origin !== 'https://appcodici-password.web.app' && !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');
}

const outputRoot = path.join(root, '.codex-tmp', 'qa-final');
const profile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-accounts-'));
const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-account-files-'));
const expectedEmail = 'codex.qa2@appcodici-password.invalid';
const expectedUid = '1lfhs2WoDRNXA9huOK0u0ffjQC13';
const expectedCompanyName = 'QA Azienda Sintetica SRL';
const companyId = String(process.env.CODEX_QA_COMPANY_ID || '').trim();
if (!companyId) throw new Error('QA_COMPANY_ID_REQUIRED');
if (!/^[A-Za-z0-9_-]{8,128}$/.test(companyId)) throw new Error('QA_COMPANY_ID_INVALID');
const credentials = await loadQaCredentialBundle(undefined, {expectedEmail});
if (credentials.uid !== expectedUid) throw new Error('QA2_UID_MISMATCH');
const extendedOnly = process.env.CODEX_QA_EXTENDED_ONLY === '1';
const auditOnly = process.env.CODEX_QA_ACCOUNT_AUDIT_ONLY === '1';
const duplicateCleanup = Object.freeze({
    enabled: process.env.CODEX_QA_ACCOUNT_DUPLICATE_CLEANUP === '1',
    keepId: String(process.env.CODEX_QA_ACCOUNT_KEEP_ID || '').trim(),
    deleteId: String(process.env.CODEX_QA_ACCOUNT_DELETE_ID || '').trim(),
    consent: String(process.env.CODEX_QA_ACCOUNT_CLEANUP_CONFIRM || '').trim()
});
const auditCandidateIds = String(process.env.CODEX_QA_ACCOUNT_AUDIT_IDS || '')
    .split(',').map(value => value.trim()).filter(value => /^[A-Za-z0-9_-]{8,128}$/.test(value));
const allowDestructive = process.env.QA_ALLOW_DESTRUCTIVE === '1';
const attachmentCleanup = Object.freeze({
    accountId: String(process.env.QA_CLEANUP_ACCOUNT_ATTACHMENT_ID || '').trim(),
    consent: String(process.env.QA_CLEANUP_ATTACHMENT_CONFIRM || '').trim()
});
const secret = 'QA-PASSWORD-NON-REALE';
const fixtures = Object.freeze([
    {context: 'private', mode: 'standard', name: 'QA Privato Standard', username: 'qa.standard', code: 'QA-STANDARD-001', password: secret},
    {context: 'private', mode: 'banking', name: 'QA Privato Bancario', username: 'qa.banca', code: 'QA-BANCA-001', password: secret},
    {context: 'private', mode: 'memo', name: 'QA Privato Memorandum', username: '', code: '', password: ''},
    {context: 'company', mode: 'standard', name: 'QA Azienda Account Standard', username: 'qa.azienda', code: 'QA-AZIENDA-001', password: secret},
    {context: 'company', mode: 'banking', name: 'QA Azienda Account Bancario', username: 'qa.azienda.banca', code: 'QA-AZIENDA-BANCA-001', password: secret},
    {context: 'company', mode: 'memo', name: 'QA Azienda Memorandum', username: '', code: '', password: ''}
]);
const report = {schemaVersion: 1, origin, companyId, extendedOnly, auditOnly, startedAt: new Date().toISOString(), fixtureIds: {}, actions: [], warnings: [], consoleErrors: [], networkErrors: []};

function record(action, status, detail = '') {
    report.actions.push({action, status, ...(detail ? {detail} : {})});
}

function safeUrl(value) {
    try { const url = new URL(value); return `${url.protocol}//${url.host}${url.pathname}`; }
    catch { return 'invalid-url'; }
}

async function waitForTranslatedPage(page) {
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, {timeout: 20_000});
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

function listUrl(fixture) {
    const type = fixture.mode === 'memo' ? 'memo' : 'standard';
    return fixture.context === 'private'
        ? `${origin}/account_privati.html?type=${type}`
        : `${origin}/account_azienda.html?id=${encodeURIComponent(companyId)}&type=${type}`;
}

function createUrl(fixture) {
    return fixture.context === 'private'
        ? `${origin}/form_account_privato.html`
        : `${origin}/form_account_azienda.html?aziendaId=${encodeURIComponent(companyId)}`;
}

async function findAndOpen(page, fixture) {
    const target = listUrl(fixture);
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
            await page.goto(target, {waitUntil: 'domcontentloaded', timeout: 45_000});
            await waitForTranslatedPage(page);
            await page.waitForFunction(() => {
                const container = document.getElementById('accounts-container');
                return Boolean(container && !container.querySelector('.loading-full-box'));
            }, null, {timeout: 30_000});
            await page.locator('#account-search').fill(fixture.name);
            const matches = page.locator('.account-card').filter({hasText: fixture.name});
            const card = matches.first();
            if (await card.isVisible({timeout: 5_000}).catch(() => false)) {
                const count = await matches.count();
                if (count !== 1) throw new Error(`QA_ACCOUNT_FIXTURE_NOT_UNIQUE:${fixture.name}:${count}`);
                const accountId = await card.getAttribute('data-id');
                if (!accountId) throw new Error(`QA_ACCOUNT_ID_MISSING:${fixture.name}`);
                await card.click();
                await page.waitForURL(/\/dettaglio_account_(?:privato|azienda)\.html\?/, {timeout: 45_000});
                const detailId = new URL(page.url()).searchParams.get('id');
                if (detailId !== accountId) throw new Error(`QA_ACCOUNT_ID_MISMATCH:${fixture.name}`);
                report.fixtureIds[`${fixture.context}-${fixture.mode}`] = accountId;
                return true;
            }
        } catch (error) {
            lastError = error;
            report.warnings.push({area: `${fixture.context}-${fixture.mode}-list`, attempt,
                page: safeUrl(page.url()), detail: String(error?.message || error).slice(0, 240)});
        }
        if (attempt < 3) await page.waitForTimeout(2_000 * attempt);
    }
    await page.screenshot({path: path.join(outputRoot, `${fixture.context}-${fixture.mode}-not-found.png`), fullPage: true});
    if (lastError) record(`${fixture.context}-${fixture.mode}-list-read`, 'retry-exhausted', String(lastError?.message || lastError).slice(0, 160));
    return false;
}

async function openForm(page, fixture) {
    if (await findAndOpen(page, fixture)) {
        await page.locator('#btn-edit-footer').click();
        await page.waitForURL(/\/form_account_(?:privato|azienda)\.html\?/, {timeout: 45_000});
        await waitForTranslatedPage(page);
        record(`${fixture.context}-${fixture.mode}`, 'reused');
        await page.locator('#account-name').waitFor({state: 'visible', timeout: 30_000});
        await page.locator(fixture.context === 'private' ? '#btn-save-footer' : '#save-btn-footer').waitFor({state: 'visible', timeout: 30_000});
        return false;
    } else {
        await page.goto(createUrl(fixture), {waitUntil: 'domcontentloaded', timeout: 45_000});
        await waitForTranslatedPage(page);
        record(`${fixture.context}-${fixture.mode}`, 'created');
    }
    await page.locator('#account-name').waitFor({state: 'visible', timeout: 30_000});
    await page.locator(fixture.context === 'private' ? '#btn-save-footer' : '#save-btn-footer').waitFor({state: 'visible', timeout: 30_000});
    return true;
}

async function fillBank(page) {
    const banking = page.locator('#flag-banking');
    if (!await banking.isChecked()) await banking.evaluate(element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', {bubbles: true}));
    });
    const bank = page.locator('.bank-account-card').first();
    await bank.waitFor({state: 'visible', timeout: 20_000});
    const values = {
        'IBAN': 'IT00Q0000000000000000000000',
        'Pass. Dispositiva': 'QA-DISPOSITIVA-NON-REALE',
        'Numero verde': '0000000200',
        'Referente banca': 'Referente QA',
        'Tel. Banca': '0000000201',
        'Cell. Banca': '0000000202'
    };
    for (const [label, value] of Object.entries(values)) {
        const row = bank.locator('.glass-field-container').filter({has: page.locator('label', {hasText: label})}).first();
        await row.locator('input').fill(value);
    }
}

async function populate(page, fixture) {
    const isNew = await openForm(page, fixture);
    await page.locator('#account-name').fill(fixture.name);
    await page.locator('#account-username').fill(fixture.username);
    await page.locator('#account-code').fill(fixture.code);
    await page.locator('#account-password').fill(fixture.password);
    await page.locator('#account-url').fill('https://example.invalid/qa-account');
    await page.locator('#account-note').fill(`QA-SINTETICO · ${fixture.name} · nessun dato reale.`);
    await page.locator('#ref-name').fill('Referente Sintetico');
    await page.locator('#ref-phone').fill('0000000300');
    await page.locator('#ref-mobile').fill('0000000301');
    if (fixture.context === 'company') {
        await page.locator('#account-numero-iscrizione').fill('QA-ISCR-0001');
        await page.locator('#account-codice-societa').fill('QA-SOC-0001');
    }
    if (fixture.mode === 'memo' && !await page.locator('#flag-memo').isChecked()) {
        await page.locator('#flag-memo').evaluate(element => {
            element.checked = true;
            element.dispatchEvent(new Event('change', {bubbles: true}));
        });
    }
    if (fixture.mode === 'banking') await fillBank(page);
    await page.screenshot({path: path.join(outputRoot, `${fixture.context}-${fixture.mode}-form.png`), fullPage: true});
    if (!isNew) {
        record(`${fixture.context}-${fixture.mode}-save`, 'not-needed-existing-fixture');
        return;
    }
    const save = page.locator(fixture.context === 'private' ? '#btn-save-footer' : '#save-btn-footer');
    await save.click();
    await page.waitForURL(url => !url.pathname.endsWith(fixture.context === 'private' ? '/form_account_privato.html' : '/form_account_azienda.html'), {timeout: 60_000});
    record(`${fixture.context}-${fixture.mode}-save`, 'passed');
}

async function verifyDetail(page, fixture) {
    assert.equal(await findAndOpen(page, fixture), true, `${fixture.name} non trovato dopo il salvataggio`);
    await page.locator('#hero-title').filter({hasText: fixture.name}).waitFor({state: 'visible', timeout: 30_000});
    const password = page.locator('#detail-password');
    if (fixture.mode === 'memo') {
        assert.equal(await password.inputValue(), '');
        assert.equal(new URL(listUrl(fixture)).searchParams.get('type'), 'memo');
    } else {
        assert.equal(await password.inputValue(), secret, 'La password decifrata attesa non corrisponde alla fixture QA');
        const textSecurity = await password.evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-text-security'));
        assert.equal(textSecurity, 'disc', 'La password deve risultare visivamente mascherata');
        assert.ok(await page.locator('#toggle-password').count(), 'Il dettaglio deve offrire il controllo di visibilità');
    }
    if (fixture.mode === 'banking') {
        await page.locator('#section-banking').waitFor({state: 'visible', timeout: 20_000});
        await page.locator('#banking-toggle').click();
        await page.locator('#banking-content').getByText('IT00Q0000000000000000000000', {exact: true}).waitFor({state: 'visible', timeout: 10_000});
    }
    await page.screenshot({path: path.join(outputRoot, `${fixture.context}-${fixture.mode}-detail.png`), fullPage: true});
    record(`${fixture.context}-${fixture.mode}-detail`, 'passed');
}

async function verifySharedValidation(page, context) {
    const fixture = {context, mode: 'shared-negative', name: `QA ${context === 'private' ? 'Privato' : 'Azienda'} Condiviso Non Salvato`, username: 'qa.share', code: 'QA-SHARE-001', password: secret};
    await page.goto(createUrl(fixture), {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.locator('#account-name').fill(fixture.name);
    await page.locator('#account-username').fill(fixture.username);
    await page.locator('#account-code').fill(fixture.code);
    await page.locator('#account-password').fill(fixture.password);
    await page.waitForFunction(() => typeof document.getElementById('flag-shared')?.onchange === 'function', null, {timeout: 30_000});
    await page.locator('#flag-shared').evaluate(element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await page.locator('#shared-management').waitFor({state: 'visible', timeout: 10_000});
    const inviteEmail = page.locator('#invite-email');
    await inviteEmail.fill('destinatario.qa@appcodici-password.invalid');
    assert.equal(await inviteEmail.inputValue(), 'destinatario.qa@appcodici-password.invalid');
    record(`${context}-shared-invite-field`, 'synthetic-invalid-address-accepted-not-sent');
    await inviteEmail.fill('');
    const save = page.locator(context === 'private' ? '#btn-save-footer' : '#save-btn-footer');
    await save.click();
    const toast = page.getByText('Scegli o aggiungi almeno un contatto per condividere.', {exact: false});
    await toast.waitFor({state: 'visible', timeout: 10_000});
    assert.ok(page.url().includes('form_account_'));
    await page.screenshot({path: path.join(outputRoot, `${context}-shared-recipient-required.png`), fullPage: true});
    record(`${context}-shared-without-recipient`, 'blocked-as-designed');

    await page.locator('#account-username').fill('');
    await page.locator('#account-code').fill('');
    await page.locator('#account-password').fill('');
    await page.waitForFunction(() => typeof document.getElementById('flag-memo-shared')?.onchange === 'function', null, {timeout: 30_000});
    await page.locator('#flag-memo-shared').evaluate(element => {
        element.checked = true;
        element.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await page.locator('#shared-management').waitFor({state: 'visible', timeout: 10_000});
    await save.click();
    await toast.waitFor({state: 'visible', timeout: 10_000});
    await page.screenshot({path: path.join(outputRoot, `${context}-memo-shared-recipient-required.png`), fullPage: true});
    record(`${context}-memo-shared-without-recipient`, 'blocked-as-designed');
}

async function attachSmallFile(page, fixture, attachmentPath) {
    assert.equal(await findAndOpen(page, fixture), true);
    const name = path.basename(attachmentPath);
    await page.waitForFunction(() => {
        const container = document.getElementById('attachments-list');
        return Boolean(container && (container.querySelector('.attachment-item') || /Nessun allegato/i.test(container.textContent || '')));
    }, null, {timeout: 30_000});
    const existingCount = await page.getByText(name, {exact: true}).count();
    if (existingCount > 1) throw new Error(`QA_ACCOUNT_ATTACHMENT_NOT_UNIQUE:${name}:${existingCount}`);
    if (existingCount === 0) {
        await page.locator('#btn-add-attachment').waitFor({state: 'visible', timeout: 20_000});
        await page.waitForFunction(() => typeof document.getElementById('btn-add-attachment')?.onclick === 'function', null, {timeout: 30_000});
        await page.locator('#btn-add-attachment').click();
        await page.locator('.attachment-source-picker').waitFor({state: 'visible', timeout: 10_000});
        await page.locator('.attachment-source-picker [data-source="document"]').click();
        await page.locator('#input-file').setInputFiles(attachmentPath);
        await page.locator('#confirm-ok-btn').click();
        const attachment = page.getByText(name, {exact: true});
        await attachment.waitFor({state: 'visible', timeout: 45_000});
        assert.equal(await attachment.count(), 1, `QA_ACCOUNT_ATTACHMENT_NOT_UNIQUE:${name}`);
    }
    await page.screenshot({path: path.join(outputRoot, 'private-standard-attachment.png'), fullPage: true});
    record('private-standard-small-attachment', 'passed');
}

async function cleanupAuthorizedAttachmentDuplicate(page) {
    const {accountId, consent} = attachmentCleanup;
    if (!accountId && !consent) return;
    if (!allowDestructive || consent !== 'DELETE_SYNTHETIC_DUPLICATE'
        || accountId !== 'xcsq4OKYDvNXb7iP8mU3') {
        throw new Error('QA_ATTACHMENT_CLEANUP_DESTRUCTIVE_AUTH_REQUIRED');
    }
    const fixture = fixtures.find(item => item.context === 'private' && item.mode === 'standard');
    const attachmentName = 'qa-account-allegato-sintetico.txt';
    await page.goto(`${origin}/dettaglio_account_privato.html?id=${encodeURIComponent(accountId)}`, {
        waitUntil: 'domcontentloaded', timeout: 45_000
    });
    await waitForTranslatedPage(page);
    assert.equal(new URL(page.url()).searchParams.get('id'), accountId, 'QA_ATTACHMENT_CLEANUP_ACCOUNT_ID_MISMATCH');
    await page.locator('#hero-title').filter({hasText: fixture.name}).waitFor({state: 'visible', timeout: 30_000});
    await page.waitForFunction(() => document.querySelectorAll('#attachments-list .attachment-item').length > 0,
        null, {timeout: 30_000});
    const matches = page.locator('#attachments-list .attachment-item').filter({hasText: attachmentName});
    assert.equal(await matches.count(), 2, 'QA_ATTACHMENT_CLEANUP_IDENTITY_NOT_UNIQUE');
    await matches.nth(1).locator('.btn-delete-attachment').click();
    const modal = page.locator('#protocol-confirm-modal');
    await modal.waitFor({state: 'visible', timeout: 15_000});
    assert.ok((await modal.textContent()).includes(attachmentName), 'QA_ATTACHMENT_CLEANUP_CONFIRMATION_MISMATCH');
    await page.screenshot({path: path.join(outputRoot, 'private-standard-attachment-cleanup-confirmation.png'), fullPage: true});
    await modal.locator('#confirm-ok-btn').click();
    await page.waitForFunction(name => [...document.querySelectorAll('#attachments-list .attachment-item')]
        .filter(element => element.textContent?.includes(name)).length === 1, attachmentName, {timeout: 45_000});
    assert.equal(await page.locator('#attachments-list .attachment-item').filter({hasText: attachmentName}).count(), 1);
    record('private-standard-attachment-duplicate-cleanup', 'passed-explicit-authority', accountId);
}

async function tryAccountWidget(page, fixture) {
    const title = 'QA Widget Account Sintetico';
    await openForm(page, fixture);
    await page.locator('#account-widgets-section').waitFor({state: 'visible', timeout: 30_000});
    if (await page.locator('.account-widget-block').filter({hasText: title}).count()) {
        record('private-standard-widget', 'reused');
        return true;
    }
    await page.locator('#btn-add-account-widget').click();
    const catalog = page.locator('.account-widget-editor-modal').filter({hasText: 'Profili Widget Account'}).last();
    await catalog.waitFor({state: 'visible', timeout: 20_000});
    await catalog.getByRole('button', {name: 'Crea nuovo profilo Widget Account'}).click();
    const editor = page.locator('.account-widget-editor-modal').filter({hasText: 'Nuovo widget'}).last();
    await editor.waitFor({state: 'visible', timeout: 20_000});
    await editor.locator('input[placeholder="Titolo del widget"]').fill(title);
    await editor.getByRole('button', {name: 'Aggiungi campo'}).click();
    const field = editor.locator('.account-widget-editor-field').last();
    await field.locator('input[placeholder="Nome del campo"]').fill('Segreto QA');
    await field.locator('input[placeholder="Valore"]').fill('QA-WIDGET-NON-REALE');
    await field.getByRole('checkbox', {name: 'Dato sensibile cifrato'}).check();
    await editor.getByRole('button', {name: 'Salva'}).click();
    const card = page.locator('.account-widget-block').filter({hasText: title});
    const saved = await card.waitFor({state: 'visible', timeout: 30_000}).then(() => true).catch(() => false);
    if (!saved) {
        const detail = (await page.locator('#toast').textContent().catch(() => ''))?.trim() || 'Widget non creato';
        report.warnings.push({area: 'account-widget', detail: detail.slice(0, 240)});
        record('private-standard-widget', 'blocked');
        return false;
    }
    await page.screenshot({path: path.join(outputRoot, 'private-standard-widget.png'), fullPage: true});
    record('private-standard-widget', 'passed');
    return true;
}

async function tryAttachExistingAccountWidget(page, fixture) {
    const title = 'QA Widget Account Sintetico';
    await openForm(page, fixture);
    await page.locator('#account-widgets-section').waitFor({state: 'visible', timeout: 30_000});
    const existing = page.locator('.account-widget-block').filter({hasText: title});
    if (await existing.count()) {
        record(`${fixture.context}-${fixture.mode}-existing-widget-template`, 'reused');
        return;
    }
    const select = page.locator('#account-widget-template-select');
    await select.waitFor({state: 'visible', timeout: 30_000});
    const option = select.locator('option').filter({hasText: title}).first();
    await option.waitFor({state: 'attached', timeout: 30_000});
    const value = await option.getAttribute('value');
    assert.ok(value, 'Il profilo Widget QA deve essere disponibile nel menu dei Widget esistenti');
    await select.selectOption(value);
    const attach = page.locator('#btn-attach-account-widget');
    assert.equal(await attach.isEnabled(), true, 'Il pulsante Aggiungi deve attivarsi dopo la selezione del profilo Widget');
    await attach.click();
    await existing.waitFor({state: 'visible', timeout: 30_000});
    await page.screenshot({path: path.join(outputRoot, `${fixture.context}-${fixture.mode}-existing-widget-template.png`), fullPage: true});
    record(`${fixture.context}-${fixture.mode}-existing-widget-template`, 'attached-and-persisted');
}

async function trySharedCredential(page, fixture) {
    const title = 'QA Credenziale Comune Sintetica';
    await page.goto(`${origin}/impostazioni.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.locator('#btn-shared-credentials').click();
    const settings = page.locator('.shared-credentials-modal').filter({hasText: 'Credenziali comuni'}).last();
    const settingsVisible = await settings.waitFor({state: 'visible', timeout: 30_000})
        .then(() => true).catch(() => false);
    if (!settingsVisible) {
        const appCheckBlocked = report.networkErrors.some(entry =>
            (entry.status === 403 && entry.resource.includes('exchangeRecaptchaV3Token'))
            || (entry.status === 401 && entry.resource.includes('registerSharingIdentity')));
        if (!appCheckBlocked) throw new Error('QA_SHARED_CREDENTIALS_MODAL_NOT_VISIBLE');
        await page.screenshot({path: path.join(outputRoot, 'shared-credential-app-check-blocked.png'), fullPage: true});
        report.warnings.push({
            area: 'shared-credential',
            detail: 'Bloccata da App Check/registrazione identità (403/401); nessun bypass applicato.'
        });
        record('shared-credential', 'blocked-app-check-no-bypass');
        return;
    }
    let card = settings.locator('.shared-credentials-card').filter({hasText: title});
    if (!await card.count()) {
        await settings.getByRole('button', {name: 'Nuova credenziale'}).click();
        const editor = page.locator('.shared-credentials-modal').filter({hasText: 'Questi dati restano separati'}).last();
        await editor.waitFor({state: 'visible', timeout: 20_000});
        await editor.locator('input[placeholder="Titolo"]').fill(title).catch(async () => {
            await editor.locator('input.shared-credentials-input').first().fill(title);
        });
        await editor.locator('textarea').fill('Fixture QA2 non reale.');
        const field = editor.locator('.shared-credential-field').first();
        await field.locator('input[placeholder="Nome del campo"]').fill('Token QA');
        await field.locator('input[placeholder="Valore"]').fill('QA-CREDENZIALE-NON-REALE');
        await editor.getByRole('button', {name: 'Salva'}).click();
        card = settings.locator('.shared-credentials-card').filter({hasText: title});
        const saved = await card.waitFor({state: 'visible', timeout: 30_000}).then(() => true).catch(() => false);
        if (!saved) {
            const detail = (await page.locator('#toast').textContent().catch(() => ''))?.trim() || 'Credenziale comune non creata';
            report.warnings.push({area: 'shared-credential', detail: detail.slice(0, 240)});
            record('shared-credential', 'blocked');
            return;
        }
        record('shared-credential-create', 'passed');
    } else record('shared-credential-create', 'reused');

    await card.getByRole('button', {name: 'Gestisci collegamenti'}).click();
    const links = page.locator('.shared-credentials-modal').filter({hasText: 'Collega lo stesso dato centrale'}).last();
    await links.waitFor({state: 'visible', timeout: 20_000});
    await links.locator('.shared-credential-account-search').fill(fixture.name);
    const account = links.locator('.shared-credential-account').filter({hasText: fixture.name}).first();
    await account.waitFor({state: 'visible', timeout: 20_000});
    if (!await account.getByText('Collegato', {exact: true}).count()) {
        await account.click();
        const linked = await links.locator('.shared-credential-account').filter({hasText: fixture.name})
            .getByText('Collegato', {exact: true}).waitFor({state: 'visible', timeout: 30_000}).then(() => true).catch(() => false);
        if (!linked) {
            const detail = (await page.locator('#toast').textContent().catch(() => ''))?.trim() || 'Collegamento non creato';
            report.warnings.push({area: 'shared-credential-link', detail: detail.slice(0, 240)});
            record('shared-credential-link', 'blocked');
            return;
        }
        record('shared-credential-link', 'passed');
    } else record('shared-credential-link', 'reused');
    await page.screenshot({path: path.join(outputRoot, 'shared-credential-linked.png'), fullPage: true});
}

async function swipeRight(page, row) {
    const box = await row.boundingBox();
    if (!box) throw new Error('QA_SWIPE_TARGET_MISSING');
    const y = box.y + Math.min(box.height / 2, 80);
    await page.mouse.move(box.x + Math.min(40, box.width / 6), y);
    await page.mouse.down();
    await page.mouse.move(box.x + (box.width * 0.72), y, {steps: 12});
    await page.mouse.up();
}

async function swipeLeft(page, row) {
    const box = await row.boundingBox();
    if (!box) throw new Error('QA_SWIPE_TARGET_MISSING');
    const y = box.y + Math.min(box.height / 2, 80);
    await page.mouse.move(box.x + box.width - Math.min(40, box.width / 6), y);
    await page.mouse.down();
    await page.mouse.move(box.x + (box.width * 0.28), y, {steps: 12});
    await page.mouse.up();
}

async function tryArchiveRestore(page, fixture) {
    const accountId = report.fixtureIds[`${fixture.context}-${fixture.mode}`];
    if (!accountId || fixture.context !== 'private') throw new Error('QA_ARCHIVE_FIXTURE_NOT_IDENTIFIED');
    await page.goto(listUrl(fixture), {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.waitForFunction(() => !document.querySelector('#accounts-container .loading-full-box'), null, {timeout: 30_000});
    await page.locator('#account-search').fill(fixture.name);
    const card = page.locator(`.account-card[data-id="${accountId}"]`).filter({hasText: fixture.name});
    await card.waitFor({state: 'visible', timeout: 20_000});
    await swipeRight(page, card);
    const archived = await card.waitFor({state: 'detached', timeout: 30_000}).then(() => true).catch(() => false);
    if (!archived) {
        report.warnings.push({area: 'archive-restore', detail: 'Archiviazione non completata; nessuno stato da ripristinare.'});
        record('private-standard-archive-restore', 'blocked-before-archive');
        return;
    }
    record('private-standard-archive', 'passed');
    await page.goto(`${origin}/archivio_account.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.waitForFunction(() => !document.querySelector('#accounts-container .loading-full-box'), null, {timeout: 30_000});
    await page.locator('#archive-search').fill(fixture.name);
    const row = page.locator('.archive-row-container').filter({hasText: fixture.name}).filter({has: page.locator(`.archive-item-name:text-is("${fixture.name}")`)}).first();
    await row.waitFor({state: 'visible', timeout: 30_000});
    const key = await row.getAttribute('data-key');
    if (!key?.includes(accountId)) throw new Error('QA_ARCHIVE_ID_MISMATCH');
    await swipeRight(page, row);
    const restored = await row.waitFor({state: 'detached', timeout: 30_000}).then(() => true).catch(() => false);
    if (!restored) throw new Error(`QA_ARCHIVE_RESTORE_FAILED:${accountId}`);
    assert.equal(await findAndOpen(page, fixture), true, 'Account QA non trovato dopo il ripristino');
    await page.screenshot({path: path.join(outputRoot, 'private-standard-after-restore.png'), fullPage: true});
    record('private-standard-restore', 'passed');
}

async function auditPrivateStandardState(page) {
    const fixture = fixtures[0];
    await page.goto(listUrl(fixture), {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.waitForFunction(() => !document.querySelector('#accounts-container .loading-full-box'), null, {timeout: 30_000});
    await page.waitForTimeout(5_000);
    await page.locator('#account-search').fill(fixture.name);
    await page.waitForTimeout(1_000);
    const activeRendered = await page.locator('.account-card').evaluateAll(cards => cards.map(card => ({
        id: card.getAttribute('data-id'),
        name: card.querySelector('.account-card-title')?.textContent?.trim() || ''
    })));
    const active = await page.locator('.account-card').evaluateAll((cards, expectedName) => cards
        .filter(card => card.querySelector('.account-card-title')?.textContent?.trim() === expectedName)
        .map(card => ({id: card.getAttribute('data-id'), name: expectedName})), fixture.name);

    await page.goto(`${origin}/archivio_account.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.waitForFunction(() => !document.querySelector('#accounts-container .loading-full-box'), null, {timeout: 30_000});
    await page.waitForTimeout(5_000);
    await page.locator('#archive-search').fill(fixture.name);
    await page.waitForTimeout(1_000);
    const archivedRendered = await page.locator('.archive-row-container').evaluateAll(rows => rows.map(row => ({
        key: row.getAttribute('data-key'),
        name: row.querySelector('.archive-item-name')?.textContent?.trim() || ''
    })));
    const archived = await page.locator('.archive-row-container').evaluateAll((rows, expectedName) => rows
        .filter(row => row.querySelector('.archive-item-name')?.textContent?.trim() === expectedName)
        .map(row => ({key: row.getAttribute('data-key'), name: expectedName})), fixture.name);

    const direct = [];
    for (const accountId of new Set([...auditCandidateIds, ...archived.map(item => JSON.parse(item.key || '[]')[1]).filter(Boolean)])) {
        await page.goto(`${origin}/dettaglio_account_privato.html?id=${encodeURIComponent(accountId)}`, {
            waitUntil: 'domcontentloaded', timeout: 45_000
        });
        await waitForTranslatedPage(page);
        await page.waitForTimeout(5_000);
        direct.push({
            id: accountId,
            page: safeUrl(page.url()),
            name: await page.locator('#detail-nomeAccount').inputValue().catch(() => ''),
            errorVisible: await page.locator('.error-message, .empty-state, #toast').filter({hasText: /errore|non trovato|mancante/i})
                .first().isVisible().catch(() => false)
        });
    }
    report.accountAudit = {fixture: fixture.name, active, archived, activeRendered, archivedRendered, direct};
    record('private-standard-state-audit', 'passed', `active=${active.length};archived=${archived.length}`);
}

async function exactArchivedRow(page, accountId, expectedName) {
    const rows = page.locator('.archive-row-container').filter({hasText: expectedName});
    for (let index = 0; index < await rows.count(); index += 1) {
        const row = rows.nth(index);
        const key = await row.getAttribute('data-key');
        const name = (await row.locator('.archive-item-name').textContent().catch(() => ''))?.trim();
        if (name === expectedName && key === JSON.stringify(['privato', accountId])) return row;
    }
    throw new Error(`QA_ARCHIVED_ACCOUNT_NOT_FOUND:${accountId}`);
}

async function cleanupPrivateStandardDuplicate(page) {
    if (!duplicateCleanup.enabled) return;
    if (duplicateCleanup.consent !== 'DELETE_QA2_SYNTHETIC_DUPLICATE') throw new Error('QA_DUPLICATE_CLEANUP_CONFIRMATION_REQUIRED');
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(duplicateCleanup.keepId)
        || !/^[A-Za-z0-9_-]{8,128}$/.test(duplicateCleanup.deleteId)
        || duplicateCleanup.keepId === duplicateCleanup.deleteId) throw new Error('QA_DUPLICATE_CLEANUP_IDS_INVALID');
    const audit = report.accountAudit;
    const activeIds = new Set((audit?.active || []).map(item => item.id));
    const archivedIds = new Set((audit?.archived || []).map(item => JSON.parse(item.key || '[]')[1]));
    const bothArchived = activeIds.size === 0 && archivedIds.size === 2
        && archivedIds.has(duplicateCleanup.keepId) && archivedIds.has(duplicateCleanup.deleteId);
    const keepAlreadyActive = activeIds.size === 1 && activeIds.has(duplicateCleanup.keepId)
        && archivedIds.size === 1 && archivedIds.has(duplicateCleanup.deleteId);
    if (!bothArchived && !keepAlreadyActive) throw new Error('QA_DUPLICATE_CLEANUP_STATE_MISMATCH');

    const fixture = fixtures[0];
    await page.goto(`${origin}/archivio_account.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitForTranslatedPage(page);
    await page.waitForFunction(() => !document.querySelector('#accounts-container .loading-full-box'), null, {timeout: 30_000});
    await page.waitForTimeout(5_000);
    await page.locator('#archive-search').fill(fixture.name);
    await page.waitForTimeout(1_000);
    if (bothArchived) {
        const keepRow = await exactArchivedRow(page, duplicateCleanup.keepId, fixture.name);
        await swipeRight(page, keepRow);
        const restored = await keepRow.waitFor({state: 'detached', timeout: 30_000}).then(() => true).catch(() => false);
        if (!restored) throw new Error(`QA_DUPLICATE_RESTORE_FAILED:${duplicateCleanup.keepId}`);
        record('private-standard-duplicate-keep-restored', 'passed', duplicateCleanup.keepId);

        await page.reload({waitUntil: 'domcontentloaded', timeout: 45_000});
        await waitForTranslatedPage(page);
        await page.waitForFunction(() => !document.querySelector('#accounts-container .loading-full-box'), null, {timeout: 30_000});
        await page.waitForTimeout(5_000);
        await page.locator('#archive-search').fill(fixture.name);
        await page.waitForTimeout(1_000);
    } else {
        record('private-standard-duplicate-keep-already-active', 'passed', duplicateCleanup.keepId);
    }
    const deleteRow = await exactArchivedRow(page, duplicateCleanup.deleteId, fixture.name);
    await swipeLeft(page, deleteRow);
    const confirmation = page.locator('.modal-overlay.active');
    await confirmation.waitFor({state: 'visible', timeout: 20_000});
    await confirmation.locator('input.modal-input-glass').fill('SI');
    await confirmation.locator('button.btn-primary').click();
    const removedFromView = await deleteRow.waitFor({state: 'detached', timeout: 30_000}).then(() => true).catch(() => false);
    record('private-standard-duplicate-delete', removedFromView ? 'verification-pending' : 'blocked', duplicateCleanup.deleteId);
}

await mkdir(outputRoot, {recursive: true});
const attachmentPath = path.join(fixtureDir, 'qa-account-allegato-sintetico.txt');
await writeFile(attachmentPath, 'QA-SINTETICO\nAllegato Account non reale.\n', 'utf8');
let browser;
let activePage;
try {
    browser = await chromium.launchPersistentContext(profile, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1', args: ['--no-first-run', '--no-default-browser-check'],
        viewport: {width: 1280, height: 900}, acceptDownloads: false
    });
    const page = browser.pages()[0] || await browser.newPage();
    activePage = page;
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({text: message.text().slice(0, 300), source: safeUrl(message.location()?.url || '')}); });
    page.on('pageerror', error => report.consoleErrors.push({text: String(error?.message || error).slice(0, 300), source: safeUrl(page.url())}));
    page.on('response', response => { if (response.status() >= 400) report.networkErrors.push({status: response.status(), resource: safeUrl(response.url())}); });

    await loginAndUnlock(page);
    await verifyQa2CompanyOwnership(page);
    if (auditOnly) {
        await auditPrivateStandardState(page);
        if (duplicateCleanup.enabled) {
            await cleanupPrivateStandardDuplicate(page);
            await auditPrivateStandardState(page);
            const deleteAction = report.actions.find(action => action.action === 'private-standard-duplicate-delete');
            const stillArchived = (report.accountAudit?.archived || []).some(item => {
                try { return JSON.parse(item.key || '[]')[1] === duplicateCleanup.deleteId; }
                catch { return false; }
            });
            if (deleteAction) deleteAction.status = stillArchived ? 'blocked-app-check' : 'passed';
        }
        record('qa-accounts-audit-only', 'passed');
    } else {
        await cleanupAuthorizedAttachmentDuplicate(page);
        if (!extendedOnly) {
            for (const fixture of fixtures) {
                await populate(page, fixture);
                await verifyDetail(page, fixture);
            }
            await attachSmallFile(page, fixtures[0], attachmentPath);
            await verifySharedValidation(page, 'private');
            await verifySharedValidation(page, 'company');
        } else {
            assert.equal(await findAndOpen(page, fixtures[0]), true, 'Fixture QA2 richiesta dal lotto esteso non trovata');
            record('private-standard-extended-prerequisite', 'passed');
        }
        if (await tryAccountWidget(page, fixtures[0])) {
            await tryAttachExistingAccountWidget(page, fixtures[2]);
        } else {
            record('private-memo-existing-widget-template', 'blocked-missing-template');
        }
        await trySharedCredential(page, fixtures[0]);
        await tryArchiveRestore(page, fixtures[0]);
    }
} catch (error) {
    report.warnings.push({area: 'runner', page: safeUrl(activePage?.url?.() || ''),
        detail: String(error?.message || error).slice(0, 300)});
    record('qa-accounts-runner', 'failed', String(error?.message || error).slice(0, 160));
    throw error;
} finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(outputRoot, 'qa-accounts-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await browser?.close().catch(() => {});
    for (const candidate of [profile, fixtureDir]) {
        const target = path.resolve(candidate);
        if (path.dirname(target) === path.resolve(os.tmpdir()) && path.basename(target).startsWith('codici-password-qa-')) {
            await rm(target, {recursive: true, force: true});
        }
    }
}

console.log(JSON.stringify(report, null, 2));
