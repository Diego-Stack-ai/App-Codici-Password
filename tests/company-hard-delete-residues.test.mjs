import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';

// M7-T27 — Hard-delete di Azienda e di Account aziendale: comportamento attuale.
//
// Due percorsi **diversi**, e questo banco prova ciò che l'Emulator non copre
// bene: le asserzioni di sorgente del delete diretto e la semantica della pulizia
// dei riferimenti del purge aziendale, con la verifica del **rischio di
// ripulire riferimenti di altri Account**.
//
// Le prove su emulatori reali stanno in
// `tests/company-hard-delete-residues.emulator.test.mjs`.
const root = new URL('../Frontend/public/', import.meta.url);
const read = async path => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/g, '\n');
const functionsRequire = createRequire(new URL('../functions/package.json', import.meta.url));
const {planProfileReferenceCleanup, validatePurgeCommand} = functionsRequire('./archive-purge-service.js');

const companyListService = await read('assets/js/modules/azienda/company-list-service.js');
const maSave = await read('assets/js/modules/azienda/ma_save.js');
const archiveService = await read('assets/js/modules/settings/archive-account-service.js');

test('T-27: l’hard-delete dell’Azienda dal client è un solo deleteDoc, senza ricorsione né Storage', () => {
    const fn = companyListService.slice(companyListService.indexOf('export async function deleteCompany'));
    assert.match(fn, /await deleteDoc\(doc\(db, 'users', uid, 'aziende', companyId\)\);/,
        'il delete è quello del documento Azienda');
    for (const needle of ['recursiveDelete', 'deleteObject', 'collection(', 'batch', 'runTransaction']) {
        assert.equal(fn.includes(needle), false, `deleteCompany non deve usare ${needle}`);
    }
    // Il percorso della form fa la stessa cosa, dopo conferma, e poi reindirizza.
    assert.match(maSave, /if \(!await showConfirmModal\([\s\S]{0,120}\) return;/,
        'la form chiede conferma prima di eliminare');
    assert.match(maSave, /await deleteDoc\(doc\(db, "users", state\.currentUid, "aziende", state\.currentAziendaId\)\);/);
    assert.match(maSave, /setTimeout\(\(\) => window\.location\.href = 'lista_aziende\.html', 1000\);/,
        'dopo il delete la form reindirizza: nessuna pulizia aggiuntiva');
    // Nessun modulo del client **invoca** una cancellazione ricorsiva: la parola
    // compare solo in un commento che rimanda al protocollo del backend.
    assert.equal(/recursiveDelete\s*\(/.test(archiveService), false);
    assert.match(archiveService, /separate purge preparation\/recursiveDelete protocol/,
        'la menzione è un commento sul protocollo del backend');
});

test('T-27: l’hard-delete dell’Account aziendale è il purge backend, non un delete del client', () => {
    assert.match(archiveService, /httpsCallable\(functions, 'purgeArchivedAccount'\)/,
        'il client invoca la callable del purge');
    const deletion = archiveService.slice(archiveService.indexOf('export async function executeArchiveDeletion'),
        archiveService.indexOf('export async function deleteArchivedAccount'));
    for (const needle of ['deleteDoc', 'deleteObject', 'recursiveDelete']) {
        assert.equal(deletion.includes(needle), false,
            `il client non elimina direttamente documenti o byte di un Account (${needle})`);
    }
    // L'archiviazione resta un update sul documento, non una cancellazione.
    assert.match(archiveService, /isArchived: true/);
});

// ── Semantica della pulizia dei riferimenti (funzione reale del backend) ────

const companyCommand = validatePurgeCommand({context: 'company', companyId: 'company-a', accountId: 'account-1',
    operationId: 'operation-1', expectedRevision: 1, confirmation: 'DELETE_FOREVER'});
const privateCommand = validatePurgeCommand({context: 'private', accountId: 'account-1',
    operationId: 'operation-2', expectedRevision: 1, confirmation: 'DELETE_FOREVER'});
const contact = (accountId, companyId) => ({linkedAccountId: accountId, linkedAccountCompanyId: companyId,
    email: 'synthetic@example.invalid'});

test('T-27: il purge aziendale ripulisce solo la coppia Account+Azienda, non altri Account', () => {
    // Documento Azienda: si ripuliscono solo i contatti che puntano a QUESTA coppia.
    const company = {emails: {pec: contact('account-1', 'company-a'), amministrazione: contact('account-1', 'company-b'),
        personale: contact('account-2', 'company-a')},
    phoneAccountLinks: {telefonoAzienda: contact('account-1', 'company-a'), faxAzienda: contact('account-9', 'company-a')}};
    const patch = planProfileReferenceCleanup(company, companyCommand, {company: true});
    assert.equal(patch.emails.pec.linkedAccountId, '', 'la coppia esatta viene ripulita');
    assert.equal(patch.emails.pec.linkedAccountCompanyId, '');
    assert.equal(patch.emails.amministrazione.linkedAccountId, 'account-1',
        'lo stesso Account in un’ALTRA Azienda non viene toccato');
    assert.equal(patch.emails.personale.linkedAccountId, 'account-2',
        'un altro Account della stessa Azienda non viene toccato');
    assert.equal(patch.phoneAccountLinks.telefonoAzienda.linkedAccountId, '');
    assert.equal(patch.phoneAccountLinks.faxAzienda.linkedAccountId, 'account-9');
    assert.equal(patch.emails.pec.email, 'synthetic@example.invalid', 'gli altri campi del contatto restano');
});

test('T-27: nel Profilo il purge aziendale non tocca i collegamenti privati omonimi', () => {
    const profile = {contactEmails: [contact('account-1', 'company-a'), contact('account-1', ''),
        contact('account-1', 'company-b'), contact('account-2', 'company-a')],
    userAddresses: [{utilities: [contact('account-1', 'company-a')]}]};
    const patch = planProfileReferenceCleanup(profile, companyCommand, {company: false});
    const cleaned = patch.contactEmails.map(item => item.linkedAccountId === '');
    assert.deepEqual(cleaned, [true, false, false, false],
        'solo il collegamento alla coppia esatta viene azzerato');
    assert.equal(patch.userAddresses[0].utilities[0].linkedAccountId, '');
    assert.equal(profile.contactEmails[1].linkedAccountCompanyId, '', 'il collegamento privato omonimo resta');
});

test('T-27: il purge privato ripulisce il collegamento privato, non quello aziendale', () => {
    const profile = {contactEmails: [contact('account-1', ''), contact('account-1', 'company-a')]};
    const patch = planProfileReferenceCleanup(profile, privateCommand, {company: false});
    assert.deepEqual(patch.contactEmails.map(item => item.linkedAccountId), ['', 'account-1'],
        'solo il collegamento privato (azienda vuota) viene azzerato');
});
