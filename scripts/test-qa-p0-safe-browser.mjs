import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {parse as parseCsv} from 'csv-parse/sync';
import {loadQaCredentialBundle} from './lib/qa-credentials.mjs';

const root = path.resolve(import.meta.dirname, '..');
const expectedEmail = 'codex.qa2@appcodici-password.invalid';
const expectedUid = '1lfhs2WoDRNXA9huOK0u0ffjQC13';
const origin = String(process.env.QA_APP_ORIGIN || 'https://appcodici-password.web.app').replace(/\/$/, '');
const allowedOrigin = origin === 'https://appcodici-password.web.app'
    || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
if (!allowedOrigin) throw new Error('QA_APP_ORIGIN_NOT_ALLOWED');

const credentials = await loadQaCredentialBundle(undefined, {expectedEmail});
if (credentials.uid !== expectedUid) throw new Error('QA2_UID_MISMATCH');

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const outputRoot = path.join(root, '.codex-tmp', 'qa-p0-safe', runId);
const screenshotsRoot = path.join(outputRoot, 'screenshots');
const artifactsRoot = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-p0-artifacts-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'codici-password-qa-p0-'));
const portablePassword = `QaP0!${randomBytes(24).toString('base64url')}#SoloTest`;
const allowIncomplete = process.env.QA_P0_ALLOW_INCOMPLETE === '1';
const report = {
    schemaVersion: 1,
    runId,
    origin,
    allowIncomplete,
    identity: {email: expectedEmail, uid: expectedUid},
    startedAt: new Date().toISOString(),
    checks: [],
    downloads: [],
    consoleErrors: [],
    networkErrors: [],
    warnings: [],
    guardrails: [
        'QA2_ONLY', 'NO_REAL_DATA', 'NO_DELETE', 'NO_PASSWORD_CHANGE', 'NO_MFA_CHANGE',
        'NO_MASTER_PASSWORD_CHANGE', 'NO_BIOMETRIC_CHANGE', 'NO_RECOVERY_CODES',
        'NO_SESSION_REVOKE', 'NO_VAULT_RESET', 'NO_RESTORE_APPLY', 'NO_REAL_NOTIFICATION'
    ]
};

let currentCheck = 'bootstrap';
let browser;
let downloadSequence = 0;
const downloadJobs = [];

function safeResource(value) {
    try {
        const url = new URL(value);
        return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
        return 'invalid-url';
    }
}

function safeName(value) {
    return String(value || 'download.bin').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160);
}

function messageOf(error) {
    return String(error?.message || error || 'UNKNOWN').split('\n')[0].slice(0, 350);
}

function record(id, status, detail, evidence = []) {
    report.checks.push({id, status, detail, evidence});
}

async function runCheck(id, operation) {
    currentCheck = id;
    try {
        const result = await operation();
        if (result?.status) record(id, result.status, result.detail || '', result.evidence || []);
        else record(id, 'PASS', result?.detail || 'Controllo completato.', result?.evidence || []);
    } catch (error) {
        const detail = messageOf(error);
        const blocked = /BLOCKED|FILE_PICKER|DOWNLOAD_UNAVAILABLE|FIXTURE_ABSENT|CALLABLE_401|UNSUPPORTED/.test(detail);
        record(id, blocked ? 'BLOCKED' : 'FAIL', detail);
    }
}

async function capture(page, id, {fullPage = true} = {}) {
    const secretVisible = await page.locator('.backup-recovery-key-field:visible, input[type="password"]:visible').count();
    if (secretVisible) throw new Error(`SCREENSHOT_SECRET_GUARD:${id}`);
    const target = path.join(screenshotsRoot, `${id}.png`);
    await page.screenshot({path: target, fullPage});
    return path.relative(root, target);
}

function installDownloadCapture(page) {
    page.on('download', download => {
        const job = (async () => {
            const filename = `${String(++downloadSequence).padStart(2, '0')}-${safeName(download.suggestedFilename())}`;
            const target = path.join(artifactsRoot, filename);
            await download.saveAs(target);
            const info = await stat(target);
            const sha256 = createHash('sha256').update(await readFile(target)).digest('hex');
            const entry = {check: currentCheck, filename, bytes: info.size, sha256, path: target};
            report.downloads.push({check: currentCheck, filename, bytes: info.size, sha256});
            return entry;
        })();
        downloadJobs.push(job);
    });
}

function downloadEvidence(entry) {
    return `download:${entry.filename}:${entry.bytes}:sha256=${entry.sha256}`;
}

async function completedDownloads() {
    return Promise.all(downloadJobs);
}

async function waitForDownloadCount(before, additional, timeout = 180_000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
        const completed = await Promise.all(downloadJobs.map(job => job.catch(() => null)));
        if (completed.filter(Boolean).length >= before + additional) return completed.filter(Boolean);
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`BLOCKED_DOWNLOAD_UNAVAILABLE:${additional}`);
}

async function waitTranslated(page) {
    await page.waitForFunction(() => document.documentElement.getAttribute('data-i18n') === 'ready', null, {timeout: 25_000});
}

async function loginAndUnlock(page) {
    await page.goto(`${origin}/login-v115.html`, {waitUntil: 'networkidle', timeout: 45_000});
    await waitTranslated(page);
    const languageDialog = page.locator('#initial-language-dialog');
    if (await languageDialog.isVisible().catch(() => false)) {
        await languageDialog.locator('button[data-code="it"]').click();
        await languageDialog.locator('.first-configuration-primary').click();
        await page.waitForLoadState('networkidle', {timeout: 45_000});
        await waitTranslated(page);
    }
    await page.locator('#email').fill(credentials.email);
    await page.locator('#password').fill(credentials.accountPassword);
    await page.locator('#login-submit-btn').click();
    await page.waitForURL(/\/home_page\.html(?:[?#]|$)/, {timeout: 45_000});
    const master = page.locator('#protocol-input-modal-input');
    await master.waitFor({state: 'visible', timeout: 30_000});
    await master.fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, {timeout: 45_000});
    await assertQa2Identity(page);
}

async function unlockIfNeeded(page) {
    const master = page.locator('#protocol-input-modal-input');
    const requested = await master.waitFor({state: 'visible', timeout: 5_000}).then(() => true).catch(() => false);
    if (!requested) return;
    await master.fill(credentials.masterPassword);
    await page.locator('#modal-confirm-btn').click();
    await page.waitForFunction(() => Boolean(sessionStorage.getItem('vault_session_v1')), null, {timeout: 45_000});
}

async function assertQa2Identity(page) {
    const identity = await page.evaluate(async () => {
        const module = await import('/assets/js/firebase-config.js');
        await module.auth.authStateReady?.();
        return {uid: module.auth.currentUser?.uid || '', email: module.auth.currentUser?.email || ''};
    });
    assert.deepEqual(identity, {uid: expectedUid, email: expectedEmail}, 'QA2_IDENTITY_NOT_PROVEN');
}

async function openSettings(page) {
    await page.goto(`${origin}/impostazioni.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitTranslated(page);
    await unlockIfNeeded(page);
    await assertQa2Identity(page);
    await page.locator('#btn-export-encrypted-backup').waitFor({state: 'visible', timeout: 30_000});
    await page.waitForFunction(() => {
        const value = document.getElementById('user-name-settings')?.textContent?.trim();
        return Boolean(value && value !== 'Caricamento...' && value !== 'Loading...');
    }, null, {timeout: 20_000});
    await page.locator('#btn-export-encrypted-backup').waitFor({state: 'attached', timeout: 10_000});
    await page.waitForFunction(() => !document.getElementById('btn-export-encrypted-backup')?.disabled
        && !document.getElementById('btn-export-portable-archive')?.disabled, null, {timeout: 30_000});
}

async function cancelConfirm(page, buttonId, evidenceId) {
    await page.locator(`#${buttonId}`).click();
    const modal = page.locator('.modal-overlay.active').last();
    await modal.waitFor({state: 'visible', timeout: 10_000});
    const evidence = await capture(page, evidenceId);
    await modal.getByRole('button', {name: /Annulla|Cancel/i}).click();
    await modal.waitFor({state: 'detached', timeout: 10_000});
    await assertQa2Identity(page);
    return evidence;
}

async function settingsAndSupport(page) {
    await openSettings(page);
    const themeDisclosure = page.locator('#theme-settings-disclosure');
    if (!await themeDisclosure.evaluate(element => element.open)) {
        await page.locator('#theme-settings-toggle').click();
    }
    const previousColor = await page.evaluate(() => localStorage.getItem('color_theme') || 'blue');
    const candidate = previousColor === 'petrol' ? 'lavender' : 'petrol';
    await page.locator(`.color-theme-btn[data-color-theme="${candidate}"]`).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('color_theme')), candidate);
    await page.locator(`.color-theme-btn[data-color-theme="${previousColor}"]`).click();
    assert.equal(await page.evaluate(() => localStorage.getItem('color_theme')), previousColor);

    const companyToggle = page.locator('#company-area-toggle');
    const companyBefore = await companyToggle.isChecked();
    await companyToggle.click();
    await page.waitForFunction(() => !document.getElementById('company-area-toggle')?.disabled, null, {timeout: 15_000});
    assert.equal(await companyToggle.isChecked(), !companyBefore);
    await companyToggle.click();
    await page.waitForFunction(() => !document.getElementById('company-area-toggle')?.disabled, null, {timeout: 15_000});
    assert.equal(await companyToggle.isChecked(), companyBefore);

    for (const [buttonId, contentId] of [
        ['btn-toggle-app-info', 'info-app-content'],
        ['btn-toggle-privacy', 'privacy-dropdown-content'],
        ['btn-toggle-terms', 'terms-dropdown-content']
    ]) {
        await page.locator(`#${buttonId}`).click();
        const content = page.locator(`#${contentId}`);
        await content.waitFor({state: 'visible', timeout: 10_000});
        assert.ok((await content.innerText()).trim().length > 20, `${contentId}_EMPTY`);
        await page.locator(`#${buttonId}`).click();
    }
    const evidence = await capture(page, 'settings-reversible-support');
    return {detail: 'Colore e area Azienda ripristinati; sezioni Supporto aperte e richiuse.', evidence: [evidence]};
}

async function securityCancellation(page) {
    await openSettings(page);
    const resetEvidence = await cancelConfirm(page, 'btn-reset-vault', 'security-reset-cancel');
    const revokeEvidence = await cancelConfirm(page, 'btn-revoke-all-sessions', 'security-revoke-cancel');
    assert.ok(await page.evaluate(() => Boolean(sessionStorage.getItem('vault_session_v1'))), 'VAULT_SESSION_LOST_AFTER_CANCEL');
    return {detail: 'Popup reset locale e revoca sessioni annullati; sessione QA2 intatta.', evidence: [resetEvidence, revokeEvidence]};
}

async function sharedCredentialsReadOnly(page) {
    await openSettings(page);
    const failuresBefore = report.networkErrors.length;
    await page.locator('#btn-shared-credentials').click();
    const modal = page.locator('.shared-credentials-modal');
    const opened = await modal.waitFor({state: 'visible', timeout: 20_000}).then(() => true).catch(() => false);
    const newFailures = report.networkErrors.slice(failuresBefore);
    const callable401 = [...newFailures, ...report.networkErrors].some(item => item.status === 401
        && item.resource.includes('registerSharingIdentity'));
    if (!opened && callable401) {
        return {status: 'BLOCKED', detail: 'CALLABLE_401: Credenziali comuni non consultabili nel browser QA.'};
    }
    if (!opened) throw new Error('SHARED_CREDENTIALS_MODAL_NOT_OPEN');
    await modal.locator('.shared-credentials-body').waitFor({state: 'visible', timeout: 10_000});
    const evidence = await capture(page, 'shared-credentials-read-only');
    await modal.locator('.shared-credentials-icon-button').first().click();
    return {detail: 'Elenco Credenziali comuni consultato senza creare, modificare o eliminare.', evidence: [evidence]};
}

async function archiveReadOnly(page) {
    await page.goto(`${origin}/archivio_account.html`, {waitUntil: 'domcontentloaded', timeout: 45_000});
    await waitTranslated(page);
    await unlockIfNeeded(page);
    await assertQa2Identity(page);
    await page.locator('#accounts-container .ui-state, #accounts-container .archive-row-container').first()
        .waitFor({state: 'visible', timeout: 30_000});
    await page.waitForTimeout(1_000);
    const names = await page.locator('.archive-item-name').allTextContents();
    const evidence = await capture(page, 'archive-read-only');
    const restoreFixture = names.find(name => name.trim() === 'QA P0 Archivio Ripristino');
    if (!restoreFixture) {
        return {
            status: 'BLOCKED',
            detail: `FIXTURE_ABSENT: consultazione riuscita (${names.length} elementi); ripristino non eseguito senza fixture dedicata QA2.`,
            evidence: [evidence]
        };
    }
    return {
        status: 'BLOCKED',
        detail: 'Fixture dedicata presente, ma il ripristino via swipe non viene forzato senza opt-in esplicito QA_P0_ENABLE_ARCHIVE_RESTORE=1.',
        evidence: [evidence]
    };
}

async function openReadOnlyReport(page, buttonId, modalSelector, screenshotId) {
    await openSettings(page);
    await page.locator(`#${buttonId}`).click();
    const modal = page.locator(modalSelector);
    const opened = await modal.waitFor({state: 'visible', timeout: 60_000}).then(() => true).catch(() => false);
    if (!opened) {
        const toast = (await page.locator('#toast').textContent().catch(() => ''))?.trim();
        throw new Error(`BLOCKED_READ_ONLY_REPORT_UNAVAILABLE:${buttonId}:${toast || 'no-detail'}`);
    }
    const evidence = await capture(page, screenshotId);
    await modal.getByRole('button', {name: 'Chiudi'}).click();
    return evidence;
}

async function exportEncryptedBackup(page) {
    await openSettings(page);
    const before = (await completedDownloads()).length;
    await page.locator('#btn-export-encrypted-backup').click();
    const modal = page.locator('.modal-overlay.active').last();
    const start = modal.getByRole('button', {name: /Scegli file e crea backup/});
    await start.waitFor({state: 'visible', timeout: 30_000});
    await start.click();
    const keyField = page.locator('.backup-recovery-key-field');
    await keyField.waitFor({state: 'visible', timeout: 180_000});
    let recoveryKey = await keyField.inputValue();
    assert.match(recoveryKey, /^[a-z0-9-]{24,}$/i, 'BACKUP_RECOVERY_KEY_FORMAT');
    const downloads = await waitForDownloadCount(before, 1);
    const backup = downloads.slice(before).find(item => item.filename.endsWith('.cpbackup'));
    if (!backup) throw new Error('BLOCKED_BACKUP_DOWNLOAD_UNAVAILABLE');
    await page.locator('#backup-key-saved').check();
    await page.getByRole('button', {name: 'Ho salvato la chiave'}).click();
    await keyField.waitFor({state: 'detached', timeout: 10_000});

    const chooserPromise = page.waitForEvent('filechooser', {timeout: 15_000});
    await page.locator('#btn-restore-encrypted-backup').click();
    const chooser = await chooserPromise;
    await chooser.setFiles(backup.path);
    const restoreKey = page.locator('.modal-overlay.active input[aria-label="Recovery Key del backup"]');
    await restoreKey.waitFor({state: 'visible', timeout: 15_000});
    await restoreKey.fill(recoveryKey);
    recoveryKey = '';
    const preflightStartedAt = report.networkErrors.length;
    await page.locator('.modal-overlay.active').getByRole('button', {name: 'Conferma'}).click();

    const preview = page.locator('.backup-preview-modal');
    const confirmInput = page.locator('.modal-overlay.active input[aria-label^="Conferma ripristino"]');
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        if (await preview.isVisible().catch(() => false) || await confirmInput.isVisible().catch(() => false)) break;
        const restore401 = report.networkErrors.slice(preflightStartedAt).some(item => item.status === 401
            && item.resource.includes('restoreBackupChunk'));
        if (restore401) {
            const activeModal = page.locator('.modal-overlay.active').last();
            const closeButton = activeModal.getByRole('button', {name: /Annulla|Chiudi/i}).last();
            if (await closeButton.isVisible().catch(() => false)) {
                await closeButton.click();
                await activeModal.waitFor({state: 'detached', timeout: 10_000}).catch(() => {});
            }
            return {
                status: 'BLOCKED',
                detail: 'BLOCKED_CALLABLE_401:restoreBackupChunk'
            };
        }
        await page.waitForTimeout(300);
    }
    if (!await preview.isVisible().catch(() => false) && !await confirmInput.isVisible().catch(() => false)) {
        throw new Error('BLOCKED_RESTORE_PREFLIGHT_TIMEOUT');
    }
    const evidence = await capture(page, 'backup-restore-preflight');
    if (await preview.isVisible().catch(() => false)) {
        await preview.getByRole('button', {name: 'Chiudi anteprima'}).click();
    } else {
        await page.locator('.modal-overlay.active').getByRole('button', {name: 'Annulla'}).click();
    }
    assert.ok(
        await page.evaluate(() => Boolean(sessionStorage.getItem('vault_session_v1'))),
        'VAULT_SESSION_LOST_AFTER_BACKUP_PREFLIGHT'
    );
    return {
        detail: `Backup cifrato creato (${backup.bytes} byte); Recovery Key mai registrata; preflight verificato e annullato prima dell'applicazione.`,
        evidence: [downloadEvidence(backup), evidence]
    };
}

async function exportPortableAndValidate(page, context) {
    await openSettings(page);
    const before = (await completedDownloads()).length;
    const portableButton = page.locator('#btn-export-portable-archive');
    await page.waitForFunction(() => !document.getElementById('btn-export-portable-archive')?.disabled, null, {timeout: 30_000});
    await portableButton.click();
    const modal = page.locator('.portable-archive-modal');
    await modal.waitFor({state: 'visible', timeout: 30_000});
    const passwords = modal.locator('input[type="password"]');
    await passwords.nth(0).fill(portablePassword);
    await passwords.nth(1).fill(portablePassword);
    await modal.locator('#portable-risk-ack').check();
    assert.ok(await modal.locator('#portable-include-attachments').isChecked());
    const start = modal.locator('.btn-primary');
    await start.click();
    const masterPrompt = page.locator('#protocol-input-modal-input');
    if (await masterPrompt.waitFor({state: 'visible', timeout: 15_000}).then(() => true).catch(() => false)) {
        await masterPrompt.fill(credentials.masterPassword);
        await page.locator('#modal-confirm-btn').click();
        await masterPrompt.waitFor({state: 'detached', timeout: 30_000});
    }
    const downloads = await waitForDownloadCount(before, 3, 120_000);
    const created = downloads.slice(before);
    const archive = created.find(item => item.filename.endsWith('.cpportable'));
    const viewer = created.find(item => /visualizzatore\.html$/i.test(item.filename));
    const readme = created.find(item => /LEGGIMI\.txt$/i.test(item.filename));
    if (!archive || !viewer || !readme) throw new Error('BLOCKED_PORTABLE_DOWNLOAD_UNAVAILABLE');

    const viewerPage = await context.newPage();
    installDownloadCapture(viewerPage);
    await viewerPage.goto(pathToFileURL(viewer.path).href, {waitUntil: 'domcontentloaded', timeout: 30_000});
    await viewerPage.locator('#archive').setInputFiles(archive.path);
    await viewerPage.locator('#password').fill(portablePassword);
    await viewerPage.locator('#open').click();
    await viewerPage.locator('#content').waitFor({state: 'visible', timeout: 180_000});
    const summary = (await viewerPage.locator('#summary').innerText()).trim();
    assert.match(summary, /integrità AEAD verificata/i);
    const companyAccounts = viewerPage.locator('#sections .nav-button').filter({hasText: 'Account aziendali'}).first();
    if (await companyAccounts.count()) {
        await companyAccounts.click();
        const companyFilter = viewerPage.locator('#company-filter');
        await companyFilter.waitFor({state: 'visible', timeout: 10_000});
        const options = companyFilter.locator('option');
        if (await options.count() > 1) {
            await companyFilter.selectOption({index: 1});
            assert.ok(await viewerPage.locator('#records .nav-button').count(),
                'Il filtro Azienda dell’Archivio portabile deve conservare almeno una scheda visibile');
            await companyFilter.selectOption('');
        }
    }
    const evidence = await capture(viewerPage, 'portable-offline-open');

    await viewerPage.locator('details.technical').first().evaluate(element => { element.open = true; });
    const expected = ['.json', '.csv', '.ods', '.xlsx'];
    const exportEvidence = [];
    for (const extension of expected) {
        const button = viewerPage.locator(`#exports button[aria-label$="${extension}"]`).first();
        if (!await button.isVisible().catch(() => false)) throw new Error(`PORTABLE_EXPORT_BUTTON_MISSING:${extension}`);
        const exportBefore = (await completedDownloads()).length;
        await button.click();
        const dialog = viewerPage.locator('#security-dialog');
        await dialog.waitFor({state: 'visible', timeout: 10_000});
        await dialog.locator('#security-confirm').click();
        const exported = (await waitForDownloadCount(exportBefore, 1, 60_000)).slice(exportBefore)[0];
        await validateTechnicalExport(exported, extension);
        exportEvidence.push(downloadEvidence(exported));
        await rm(exported.path, {force: true});
    }
    await viewerPage.locator('#lock').click();
    await viewerPage.locator('#unlock').waitFor({state: 'visible', timeout: 10_000});
    await viewerPage.close();
    return {
        detail: `Archivio portatile aperto offline con allegati inclusi; ${summary}. JSON/CSV/ODS/XLSX verificati automaticamente.`,
        evidence: [downloadEvidence(archive), downloadEvidence(viewer), downloadEvidence(readme), evidence, ...exportEvidence]
    };
}

function zipEntryNames(data) {
    const eocdSignature = 0x06054b50;
    const centralSignature = 0x02014b50;
    const lowerBound = Math.max(0, data.length - 65_557);
    let eocd = -1;
    for (let offset = data.length - 22; offset >= lowerBound; offset -= 1) {
        if (data.readUInt32LE(offset) === eocdSignature) {
            eocd = offset;
            break;
        }
    }
    assert.ok(eocd >= 0, 'ZIP_EOCD_MISSING');
    const centralSize = data.readUInt32LE(eocd + 12);
    const centralOffset = data.readUInt32LE(eocd + 16);
    assert.ok(centralOffset + centralSize <= data.length, 'ZIP_CENTRAL_DIRECTORY_INVALID');
    const names = [];
    let offset = centralOffset;
    while (offset < centralOffset + centralSize) {
        assert.equal(data.readUInt32LE(offset), centralSignature, 'ZIP_CENTRAL_ENTRY_INVALID');
        const nameLength = data.readUInt16LE(offset + 28);
        const extraLength = data.readUInt16LE(offset + 30);
        const commentLength = data.readUInt16LE(offset + 32);
        const name = data.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
        assert.ok(name && !name.startsWith('/') && !name.split('/').includes('..'), 'ZIP_ENTRY_PATH_UNSAFE');
        names.push(name);
        offset += 46 + nameLength + extraLength + commentLength;
    }
    assert.equal(offset, centralOffset + centralSize, 'ZIP_CENTRAL_DIRECTORY_TRUNCATED');
    return names;
}

async function validateTechnicalExport(entry, extension) {
    assert.ok(entry.bytes > 32, `EXPORT_TOO_SMALL:${extension}`);
    const data = await readFile(entry.path);
    if (extension === '.json') {
        const parsed = JSON.parse(data.toString('utf8'));
        assert.ok(parsed && typeof parsed === 'object', 'JSON_EXPORT_INVALID');
    } else if (extension === '.csv') {
        const rows = parseCsv(data.toString('utf8'), {bom: true, relax_column_count: false, skip_empty_lines: true});
        assert.ok(rows.length >= 2 && rows[0].length >= 2, 'CSV_EXPORT_INVALID');
        const width = rows[0].length;
        assert.ok(rows.every(row => row.length === width), 'CSV_EXPORT_COLUMN_MISMATCH');
        for (const cell of rows.flat()) {
            assert.doesNotMatch(String(cell), /^[=+@\t\r]/, 'CSV_FORMULA_NOT_NEUTRALIZED');
        }
    } else {
        const names = zipEntryNames(data);
        if (extension === '.ods') {
            for (const required of ['mimetype', 'content.xml', 'META-INF/manifest.xml']) {
                assert.ok(names.includes(required), `ODS_ENTRY_MISSING:${required}`);
            }
        } else {
            for (const required of ['[Content_Types].xml', 'xl/workbook.xml']) {
                assert.ok(names.includes(required), `XLSX_ENTRY_MISSING:${required}`);
            }
            assert.ok(names.some(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)), 'XLSX_WORKSHEET_MISSING');
        }
    }
}

async function diagnostics(page) {
    await openSettings(page);
    const toggle = page.locator('#performance-diagnostics-toggle');
    const enabledBefore = await toggle.isChecked();
    if (!enabledBefore) await toggle.click();
    await page.locator('#btn-run-app-diagnostics').click();
    await page.waitForFunction(() => Boolean(document.getElementById('app-diagnostics-summary')?.dataset.report), null, {timeout: 60_000});
    const evidence = await capture(page, 'diagnostics-report');
    await page.locator('#btn-copy-performance-diagnostics').click();
    if (!enabledBefore) await toggle.click();
    assert.equal(await toggle.isChecked(), enabledBefore, 'DIAGNOSTICS_TOGGLE_NOT_RESTORED');
    return {detail: 'Diagnostica eseguita, report copiato e stato interruttore ripristinato.', evidence: [evidence]};
}

async function logoutFinal(page) {
    await openSettings(page);
    await page.locator('#logout-btn-settings').click();
    const modal = page.locator('.modal-overlay.active').last();
    await modal.waitFor({state: 'visible', timeout: 10_000});
    await modal.getByRole('button', {name: /^Esci$/}).click();
    await page.waitForURL(/\/login-v115\.html(?:[?#]|$)/, {timeout: 30_000});
    assert.equal(await page.evaluate(() => Boolean(sessionStorage.getItem('vault_session_v1'))), false);
    return {detail: 'Logout QA2 completato come ultimo passo; sessione Vault rimossa.'};
}

try {
    await mkdir(screenshotsRoot, {recursive: true});
    await mkdir(artifactsRoot, {recursive: true});
    browser = await chromium.launchPersistentContext(profile, {
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.QA_HEADFUL !== '1',
        args: ['--no-first-run', '--no-default-browser-check', '--allow-file-access-from-files'],
        viewport: {width: 1440, height: 1000},
        acceptDownloads: true
    });
    await browser.addInitScript(() => {
        for (const name of ['showSaveFilePicker', 'showDirectoryPicker']) {
            try { Object.defineProperty(window, name, {value: undefined, configurable: true}); } catch {}
        }
    });
    const page = browser.pages()[0] || await browser.newPage();
    installDownloadCapture(page);
    page.on('console', message => {
        if (message.type() !== 'error') return;
        report.consoleErrors.push({check: currentCheck, text: message.text().slice(0, 300), resource: safeResource(message.location()?.url || '')});
    });
    page.on('pageerror', error => report.consoleErrors.push({check: currentCheck, text: messageOf(error), resource: 'page'}));
    page.on('response', response => {
        if (response.status() < 400) return;
        report.networkErrors.push({check: currentCheck, status: response.status(), resource: safeResource(response.url())});
    });

    await runCheck('qa2-login-unlock', async () => {
        await loginAndUnlock(page);
        return {detail: 'Login, sblocco Vault e identità Firebase QA2 verificati.'};
    });
    const bootstrapOk = report.checks.some(check => check.id === 'qa2-login-unlock' && check.status === 'PASS');
    if (bootstrapOk) {
        await runCheck('settings-reversible-support', () => settingsAndSupport(page));
        await runCheck('security-confirmations-cancel', () => securityCancellation(page));
        await runCheck('shared-credentials-read-only', () => sharedCredentialsReadOnly(page));
        await runCheck('archive-read-only-restore-fixture', () => archiveReadOnly(page));
        await runCheck('encrypted-backup-restore-preflight', () => exportEncryptedBackup(page));
        await runCheck('portable-offline-exports', () => exportPortableAndValidate(page, browser));
        await runCheck('credential-health-read-only', async () => ({
            detail: 'Salute credenziali consultata in sola lettura.',
            evidence: [await openReadOnlyReport(page, 'btn-credential-health', '.credential-health-modal', 'credential-health-read-only')]
        }));
        await runCheck('account-field-usage-read-only', async () => ({
            detail: 'Utilizzo campi Account consultato in sola lettura.',
            evidence: [await openReadOnlyReport(page, 'btn-account-field-usage', '.account-field-usage-modal', 'account-field-usage-read-only')]
        }));
        await runCheck('diagnostics-copy-report', () => diagnostics(page));
        await runCheck('logout-final', () => logoutFinal(page));
    } else {
        for (const id of [
            'settings-reversible-support', 'security-confirmations-cancel', 'shared-credentials-read-only',
            'archive-read-only-restore-fixture', 'encrypted-backup-restore-preflight', 'portable-offline-exports',
            'credential-health-read-only', 'account-field-usage-read-only', 'diagnostics-copy-report', 'logout-final'
        ]) record(id, 'SKIP', 'QA2_BOOTSTRAP_FAILED');
    }
} finally {
    await Promise.all(downloadJobs.map(job => job.catch(() => null)));
    await browser?.close().catch(() => {});
    const safeProfile = path.resolve(profile);
    if (path.dirname(safeProfile) === path.resolve(os.tmpdir()) && path.basename(safeProfile).startsWith('codici-password-qa-p0-')) {
        await rm(safeProfile, {recursive: true, force: true});
    }
    const safeArtifacts = path.resolve(artifactsRoot);
    if (path.dirname(safeArtifacts) === path.resolve(os.tmpdir())
        && path.basename(safeArtifacts).startsWith('codici-password-qa-p0-artifacts-')) {
        await rm(safeArtifacts, {recursive: true, force: true});
    }
}

const appCheckPath = 'content-firebaseappcheck.googleapis.com/v1/projects/appcodici-password/apps/';
const sharingIdentityPath = 'europe-west1-appcodici-password.cloudfunctions.net/registerSharingIdentity';
const restoreBackupPath = 'europe-west1-appcodici-password.cloudfunctions.net/restoreBackupChunk';
const expectedConsole = report.consoleErrors.filter(item => item.resource.includes(appCheckPath)
    || item.resource.includes(sharingIdentityPath)
    || item.resource.includes(restoreBackupPath));
const expectedNetwork = report.networkErrors.filter(item => (item.status === 403 && item.resource.includes(appCheckPath))
    || (item.status === 401 && item.resource.includes(sharingIdentityPath))
    || (item.status === 401 && item.resource.includes(restoreBackupPath)));
if (expectedConsole.some(item => item.resource.includes(appCheckPath))
    || expectedNetwork.some(item => item.resource.includes(appCheckPath))) {
    report.warnings.push('APP_CHECK_RECAPTCHA_HEADLESS_REJECTED');
}
if (expectedConsole.some(item => item.resource.includes(sharingIdentityPath))
    || expectedNetwork.some(item => item.resource.includes(sharingIdentityPath))) {
    report.warnings.push('SHARING_IDENTITY_APP_CHECK_BLOCKED');
}
if (expectedConsole.some(item => item.resource.includes(restoreBackupPath))
    || expectedNetwork.some(item => item.resource.includes(restoreBackupPath))) {
    report.warnings.push('RESTORE_PREFLIGHT_APP_CHECK_BLOCKED');
}
report.consoleErrors = report.consoleErrors.filter(item => !expectedConsole.includes(item));
report.networkErrors = report.networkErrors.filter(item => !expectedNetwork.includes(item));
report.completedAt = new Date().toISOString();
report.summary = Object.fromEntries(['PASS', 'BLOCKED', 'FAIL', 'SKIP'].map(status => [
    status, report.checks.filter(check => check.status === status).length
]));
report.runCompleted = report.summary.FAIL === 0;
report.gatePassed = report.runCompleted && report.summary.BLOCKED === 0 && report.summary.SKIP === 0;
report.executionAccepted = report.runCompleted && (report.gatePassed || allowIncomplete);
await writeFile(path.join(outputRoot, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const publicReport = {
    ok: report.executionAccepted,
    runCompleted: report.runCompleted,
    gatePassed: report.gatePassed,
    executionAccepted: report.executionAccepted,
    allowIncomplete,
    summary: report.summary,
    report: path.relative(root, path.join(outputRoot, 'report.json')),
    screenshots: report.checks.flatMap(check => check.evidence || []).filter(item => item.endsWith('.png')).length,
    guarded: report.guardrails.length
};
console.log(JSON.stringify(publicReport, null, 2));
if (!report.executionAccepted) process.exitCode = 1;
