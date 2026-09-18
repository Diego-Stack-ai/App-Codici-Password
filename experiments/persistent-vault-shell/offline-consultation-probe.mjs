import * as repository from '../../Frontend/public/assets/js/modules/data/vault-repository.js';

// Synthetic laboratory matrix. This checks repository/cache/decryption paths,
// not the rendering of every production page or Storage file availability.
export async function probeOfflineConsultation({context, getUser, includeAttachmentMetadata = true}) {
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
        repository.listDeadlines(uid), includeAttachmentMetadata ? repository.listPrivateAccountAttachments(uid, 'banca') : []]);
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
        ['second bank IBAN', privateAccounts.find(record => record.id === 'banca').banking[1].iban, 'IBAN-SECONDO'],
        ['second card PIN', privateAccounts.find(record => record.id === 'banca').banking[1].cards[0].pin, '5678'],
        ['second card CCV', privateAccounts.find(record => record.id === 'banca').banking[1].cards[0].ccv, '111'],
        ['company bank IBAN', companyAccounts.find(record => record.id === 'banca').banking[0].iban, 'IBAN-FITTIZIO'],
        ['company second bank IBAN', companyAccounts.find(record => record.id === 'banca').banking[1].iban, 'IBAN-SECONDO'],
        ['company second card PIN', companyAccounts.find(record => record.id === 'banca').banking[1].cards[0].pin, '5678'],
        ['widget data', widgets.find(record => record.id === 'fixture').fields[0].valueEnc, 'WIDGET-FITTIZIO'],
        ['deadline data', deadlines.find(record => record.id === 'fixture').note, 'SCADENZA-FITTIZIA'],
        ...(includeAttachmentMetadata ? [['attachment metadata', attachments.find(record => record.id === 'fixture').name, 'ALLEGATO-FITTIZIO']] : [])
    ];
    for (const [label, ciphertext, expected] of samples) {
        check(); const decoded = await context.read({ownerId: uid, ciphertext}); check();
        if (decoded !== expected) throw new Error(`PROBE_VALUE_${label}`);
    }
    if (!navigator.onLine) {
        let missing = false;
        try { await repository.getRecordByPath(`users/${uid}/contacts/never-cached`); } catch { missing = true; }
        if (!missing) throw new Error('PROBE_MISSING_CACHE_NOT_REPORTED');
        // A banking document that was never loaded must be refused, never shown
        // as an empty or valid bank/card record. Byte availability on Storage is
        // out of scope here.
        for (const [scope, path] of [['private', `users/${uid}/accounts/banca-mai-preparata`],
            ['company', `users/${uid}/aziende/company/accounts/banca-mai-preparata`]]) {
            let refused = false;
            try { refused = (await repository.getRecordByPath(path)) == null; } catch { refused = true; }
            if (!refused) throw new Error(`PROBE_UNPREPARED_BANKING_${scope}`);
        }
    }
    return samples.map(([label]) => label);
}
