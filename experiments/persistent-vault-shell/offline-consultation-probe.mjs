import * as repository from '../../Frontend/public/assets/js/modules/data/vault-repository.js';

// Synthetic laboratory matrix. This checks repository/cache/decryption paths,
// not the rendering of every production page or Storage file availability.
export async function probeOfflineConsultation({context, getUser}) {
    if (location.origin !== 'http://127.0.0.1:4188') throw new Error('LOCAL_EMULATOR_ONLY');
    const uid = context?.user?.uid;
    const check = () => { if (!uid || context.signal.aborted || !context.unlocked || getUser()?.uid !== uid) throw new Error('PROBE_SESSION'); };
    check();
    // Seed complete list snapshots online: a prior linked-detail read can leave
    // only one document in the SDK cache, which is not a complete collection.
    const suffix = navigator.onLine ? 'Confirmed' : '';
    const [privateAccounts, companies, companyAccounts, profile, company, widgets, deadlines, attachments] = await Promise.all([
        repository['listPrivateAccounts' + suffix](uid), repository['listCompanies' + suffix](uid), repository['listCompanyAccounts' + suffix](uid, 'company'),
        repository.getUserProfile(uid), repository.getCompany(uid, 'company'), repository.listProfileWidgets(uid),
        repository.listDeadlines(uid), repository.listPrivateAccountAttachments(uid, 'banca')]);
    check();
    if (!privateAccounts.some(record => record.id === 'banca') || !companyAccounts.some(record => record.id === 'banca') ||
        !companies.some(record => record.id === 'company')) throw new Error('PROBE_LIST_MISSING');
    const samples = [
        ['private account', privateAccounts.find(record => record.id === 'zeta').password, 'SEGRETO-FITTIZIO-private-Zeta-A'],
        ['company account', companyAccounts.find(record => record.id === 'zeta').password, 'SEGRETO-FITTIZIO-company-Zeta-A'],
        ['profile identity', profile.nome, 'Nome fittizio'],
        ['email contact', profile.contactEmails[0].address, 'fixture@example.invalid'],
        ['phone contact', profile.contactPhones[0].number, '000000000'],
        ['address', profile.userAddresses[0].address, 'Via fittizia'],
        ['document metadata', profile.documenti[0].num_serie, 'DOC-FITTIZIO'],
        ['company profile', company.ragioneSociale, 'Azienda fittizia'],
        ['bank IBAN', privateAccounts.find(record => record.id === 'banca').banking[0].iban, 'IBAN-FITTIZIO'],
        ['card PIN', privateAccounts.find(record => record.id === 'banca').banking[0].cards[0].pin, '1234'],
        ['card CCV', privateAccounts.find(record => record.id === 'banca').banking[0].cards[0].ccv, '000'],
        ['company bank IBAN', companyAccounts.find(record => record.id === 'banca').banking[0].iban, 'IBAN-FITTIZIO'],
        ['widget data', widgets.find(record => record.id === 'fixture').fields[0].value, 'WIDGET-FITTIZIO'],
        ['deadline data', deadlines.find(record => record.id === 'fixture').note, 'SCADENZA-FITTIZIA'],
        ['attachment metadata', attachments.find(record => record.id === 'fixture').name, 'ALLEGATO-FITTIZIO']
    ];
    for (const [label, ciphertext, expected] of samples) {
        check(); const decoded = await context.read({ownerId: uid, ciphertext}); check();
        if (decoded !== expected) throw new Error(`PROBE_VALUE_${label}`);
    }
    if (!navigator.onLine) {
        let missing = false;
        try { await repository.getRecordByPath(`users/${uid}/contacts/never-cached`); } catch { missing = true; }
        if (!missing) throw new Error('PROBE_MISSING_CACHE_NOT_REPORTED');
    }
    return samples.map(([label]) => label);
}
