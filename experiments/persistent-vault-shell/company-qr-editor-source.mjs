import {COMPANY_QR_SCALARS, prepareCompanyQrSelection, readCompanyQrSelection} from './company-qr-selection-contract.mjs';

const labels = ['Ragione sociale', 'Partita IVA', 'Codice SDI', 'CCIAA', 'Data iscrizione', 'Nome referente',
    'Cognome referente', 'Ruolo referente', 'Cellulare referente', 'Telefono aziendale', 'PEC',
    'Email amministrazione', 'Email personale', 'Sede legale'];

// No decryption or record values enter this editor. It changes fixed inclusion
// flags only; per-row email/address selections remain outside this provider.
export function createCompanyQrEditorSource({context, getUser, source,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid, companyId = source?.companyId;
    let disposed = false, basis = null;
    const fail = () => {throw Error('QR_EDITOR_UNAVAILABLE');};
    const dispose = () => {disposed = true; basis = null; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); fail();}
        context.assertUnlocked();
        if (source?.domain !== 'company' || source.companyId !== companyId || typeof companyId !== 'string' ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(companyId)) fail();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async confirmed => {
        check(); const record = await source.read(uid, confirmed); check();
        if (!record || (record.ownerId !== undefined && record.ownerId !== uid)) fail();
        return readCompanyQrSelection(record);
    };
    return Object.freeze({dispose,
        async load() {
            basis = null; const snapshot = await read(isOnline()); check(); basis = snapshot;
            return Object.freeze({selection: snapshot.selection,
                choices: Object.freeze(COMPANY_QR_SCALARS.map((key, index) => Object.freeze({key, label: labels[index]})))});
        },
        async prepare(input) {
            check(); if (!basis || !isOnline()) fail();
            const selection = prepareCompanyQrSelection(input), expected = basis;
            const current = await read(true); check();
            if (basis !== expected || JSON.stringify(current.expectedConfig) !== JSON.stringify(expected.expectedConfig)) fail();
            return Object.freeze({companyId, selection, expectedConfig: expected.expectedConfig, expectedRevision: expected.revision});
        }
    });
}
