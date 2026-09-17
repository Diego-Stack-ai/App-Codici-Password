import {COMPANY_CONTACT_MUTATION_FIELDS, COMPANY_CONTACT_MUTATION_REFUSALS, assertCompanyRecord,
    companyContactBasis, companyContactEmptyRefusal, companyContactExtraDeleteRefusal, companyContactExtraId,
    companyContactQrState, companyContactsRevision, companyContactsView} from './company-contacts-contract.mjs';
import {prepareCompanyContacts} from './prepare-company-contacts.mjs';

// The labels the company schema already displays in production
// (`phoneLabels`/`company-profile-ui.js`) replace the raw slot name when the
// record carries no `tipo` of its own: the better company label wins, and the
// stored one is never overwritten.
const SLOT_LABELS = Object.freeze({pec: 'PEC', amministrazione: 'Email amministrazione', personale: 'Email personale',
    telefonoAzienda: 'Telefono azienda', faxAzienda: 'Fax', referenteCellulare: 'Cellulare referente'});
const FIELD_LABELS = Object.freeze({tipo: 'Etichetta', email: 'Indirizzo email', note: 'Note', password: 'Password',
    number: 'Numero', qr: 'Includi nella tessera digitale'});
const EMAIL_KEYS = Object.freeze(['tipo', 'email', 'note', 'password']);
const COMPANY_EXTRA_PREFIX = 'company-email';
const object = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
// Deletion and emptying are refused for every row while the digital-card
// selection cannot be read canonically.
export function createCompanyContactsEditorSource({context, getUser, source, isEncryptedValue, hash, createId,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    if (typeof createId !== 'function' || typeof isEncryptedValue !== 'function') throw Error(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
    const uid = context.user?.uid, companyId = source?.companyId;
    let disposed = false, loaded = null;
    const fail = code => {throw Error(code);};
    const dispose = () => {disposed = true; loaded = null; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); fail('VIEW_DISPOSED');}
        context.assertUnlocked();
        if (source?.domain !== 'company' || source.companyId !== companyId || typeof companyId !== 'string' ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(companyId)) fail('COMPANY_UNAVAILABLE');
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async confirmed => {
        const record = await source.read(uid, confirmed);
        if (!object(record) || record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid) ||
            (record.id !== undefined && record.id !== companyId)) fail('COMPANY_UNAVAILABLE');
        try {
            assertCompanyRecord(record);
            companyContactsRevision(record);
        } catch {
            fail('COMPANY_UNAVAILABLE');
        }
        return record;
    };
    // Any change to the contacts, to the Account links, to the legacy fallback or
    // to the digital-card selection invalidates the opened editor, because all of
    // them take part in the guards.
    const signature = record => companyContactBasis({
        emails: record.emails ?? null,
        telefonoAzienda: record.telefonoAzienda ?? null,
        faxAzienda: record.faxAzienda ?? null,
        referenteCellulare: record.referenteCellulare ?? null,
        phoneAccountLinks: record.phoneAccountLinks ?? null,
        aziendaEmail: record.aziendaEmail ?? null,
        qrConfig: record.qrConfig ?? null,
        _companyContactsRevision: record._companyContactsRevision ?? 0,
        _companyContactsSchemaVersion: record._companyContactsSchemaVersion ?? null
    });
    // A field is shown in the form it is stored in: only a value the session can
    // decrypt is decrypted, and the original form travels with the row so that an
    // edit never silently changes the classification of the field.
    const textField = async (key, raw, kind) => {
        const spec = COMPANY_CONTACT_MUTATION_FIELDS[kind].find(item => item.key === key);
        const value = raw ?? '';
        if (value !== '' && typeof value !== 'string') fail('COMPANY_VALUE_INVALID');
        const encrypted = value !== '' && isEncryptedValue(value);
        check();
        const plain = encrypted ? await context.read({ownerId: uid, ciphertext: value}) : value;
        check();
        if (typeof plain !== 'string' || plain.length > spec.maxLength || plain === '--ERRORE--' || (encrypted && plain === value)) {
            fail('COMPANY_VALUE_INVALID');
        }
        return {input: {key, label: FIELD_LABELS[key], type: 'text', value: plain, maxLength: spec.maxLength,
            multiline: key === 'note', secret: spec.secret === true}, form: encrypted ? 'cipher' : 'plain', value: plain};
    };
    const emailFields = async (item, kind) => {
        const fields = [], forms = {}, originals = {};
        for (const key of EMAIL_KEYS) {
            const result = await textField(key, item?.[key], kind);
            fields.push(Object.freeze(result.input));
            forms[key] = result.form;
            originals[key] = result.value;
        }
        return {fields, forms, originals};
    };
    return Object.freeze({dispose,
        createId() {
            const value = createId(COMPANY_EXTRA_PREFIX);
            if (!companyContactExtraId(value)) fail(COMPANY_CONTACT_MUTATION_REFUSALS.INVALID);
            return value;
        },
        async load() {
            loaded = null;
            const initial = await read(isOnline()); check();
            const revision = companyContactsRevision(initial), current = signature(initial);
            const qr = companyContactQrState(initial), qrUnverified = qr.state === 'unverified';
            const rows = [], snapshot = new Map();
            for (const row of companyContactsView(initial)) {
                const label = row.label && row.label !== row.id ? row.label : (SLOT_LABELS[row.id] ?? row.label);
                const slotQr = qrUnverified ? null : qr.slots?.[row.id] === true;
                if (row.kind === 'email-slot') {
                    const {fields, forms, originals} = await emailFields(initial.emails?.[row.id], 'email-slot');
                    snapshot.set(`email-slot:${row.id}`, {fields: originals, forms});
                    rows.push(Object.freeze({kind: row.kind, id: row.id, label, fields: Object.freeze(fields), editable: true,
                        removable: false, blocked: null, link: row.link, qr: slotQr, deleteRefusal: null,
                        emptyRefusal: qrUnverified ? 'COMPANY_CONTACTS_QR_UNVERIFIABLE'
                            : companyContactEmptyRefusal(initial, {kind: row.kind, id: row.id, qrIncluded: slotQr === true})}));
                    continue;
                }
                if (row.kind === 'phone-slot') {
                    const stored = initial[row.id];
                    if (stored != null && typeof stored !== 'string' && !object(stored)) fail('COMPANY_VALUE_INVALID');
                    const value = typeof stored === 'string' ? stored : (object(stored) && typeof stored.number === 'string' ? stored.number : '');
                    rows.push(Object.freeze({kind: row.kind, id: row.id, label,
                        fields: Object.freeze([Object.freeze({key: 'number', label: FIELD_LABELS.number, type: 'text', value, maxLength: 120})]),
                        editable: true, removable: false, blocked: null, link: row.link, qr: slotQr, deleteRefusal: null,
                        emptyRefusal: qrUnverified ? 'COMPANY_CONTACTS_QR_UNVERIFIABLE'
                            : companyContactEmptyRefusal(initial, {kind: row.kind, id: row.id, qrIncluded: slotQr === true})}));
                    continue;
                }
                const item = initial.emails?.extra?.[row.sourceIndex] ?? {};
                const {fields, forms, originals} = await emailFields(item, 'email-extra');
                fields.push(Object.freeze({key: 'qr', label: FIELD_LABELS.qr, type: 'boolean', value: item.qr === true, maxLength: 0}));
                forms.qr = 'boolean';
                originals.qr = item.qr === true;
                if (row.id !== null) snapshot.set(`email-extra:${row.id}`, {fields: originals, forms});
                // A row without a stable persisted id stays consultable and is
                // never targeted: its identity would have to be invented, and no
                // position is ever promoted to an identity.
                const deleteRefusal = row.id === null ? row.blocked
                    : (qrUnverified ? 'COMPANY_CONTACTS_QR_UNVERIFIABLE'
                        : companyContactExtraDeleteRefusal(item, {qrIncluded: qr.extras?.[row.sourceIndex] === true}));
                rows.push(Object.freeze({kind: row.kind, id: row.id, label, fields: Object.freeze(fields), editable: row.editable,
                    removable: row.editable && deleteRefusal === null, blocked: row.blocked, link: row.link,
                    qr: qrUnverified ? null : item.qr !== false, deleteRefusal, emptyRefusal: null}));
            }
            const confirmed = await read(isOnline()); check();
            if (signature(confirmed) !== current) fail('COMPANY_CHANGED');
            loaded = {revision, signature: current, snapshot};
            const template = EMAIL_KEYS.map(key => Object.freeze({key, label: FIELD_LABELS[key], type: 'text',
                multiline: key === 'note', secret: key === 'password',
                maxLength: COMPANY_CONTACT_MUTATION_FIELDS['email-extra'].find(item => item.key === key).maxLength}));
            template.push(Object.freeze({key: 'qr', label: FIELD_LABELS.qr, type: 'boolean', value: false, maxLength: 0}));
            return Object.freeze({revision, canSave: isOnline(), qrState: qr.state, rows: Object.freeze(rows),
                templates: Object.freeze({emailExtra: Object.freeze(template)})});
        },
        async prepare(draft, operationId) {
            check();
            if (!loaded || !isOnline()) fail('COMPANY_CONTACTS_SAVE_UNAVAILABLE');
            const current = await read(true); check();
            if (signature(current) !== loaded.signature) fail('COMPANY_CHANGED');
            const request = await prepareCompanyContacts({context, getUser, source, record: current, snapshot: loaded.snapshot,
                draft, operationId, hash});
            check();
            return request;
        }});
}
