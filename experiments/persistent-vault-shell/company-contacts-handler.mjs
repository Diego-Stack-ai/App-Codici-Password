import {COMPANY_CONTACT_EMAIL_SLOTS, COMPANY_CONTACT_PHONE_SLOTS, assertCompanyRecord, companyContactBasis,
    companyContactEmptyRefusal, companyContactExtraDeleteRefusal, companyContactExtraId, companyContactId,
    companyContactQrState, companyContactsRevision, validateCompanyContactsRequest} from './company-contacts-contract.mjs';

// Candidate backend only; the future callable must supply verified Auth and App
// Check context. Never exported by production Functions in this increment.
// Nothing is converted to the private contacts format: the company document is
// patched in place, a fixed slot is only ever emptied (the object and every field
// it carries survive), a repeatable row is only ever addressed through its stable
// persisted id, and `qrConfig`, the legacy `aziendaEmail` fallback, the legacy
// passwords and every unknown field are left exactly where they were.
const protectedOperation = operation => operation.kind === 'email-extra-delete' ||
    (operation.kind === 'email-slot' && operation.fields.email === '') ||
    (operation.kind === 'phone-slot' && operation.value === '');
export function createCompanyContactsHandler({db, hash, timestamp}) {
    const fail = code => {throw Error(code);};
    const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
    return async (data, trusted) => {
        const uid = trusted?.auth?.uid;
        if (!id(uid)) fail('UNAUTHENTICATED');
        if (typeof trusted?.app?.appId !== 'string' || !trusted.app.appId) fail('APP_CHECK_REQUIRED');
        const request = validateCompanyContactsRequest(data), {expectedRevision, operations, operationId} = request;
        const companyId = request.target.companyId;
        const digest = await hash(JSON.stringify({uid, ...request}));
        const companyRef = db.doc(`users/${uid}/aziende/${companyId}`);
        const receiptRef = db.doc(`mutationResults/${uid}/operations/company-contacts-${operationId}`);
        return db.runTransaction(async transaction => {
            const receipt = await transaction.get(receiptRef);
            if (receipt.exists) {
                const value = receipt.data();
                if (value.kind !== 'company-contacts' || value.ownerId !== uid || value.companyId !== companyId ||
                    value.digest !== digest || value.revision !== expectedRevision + 1) fail('OPERATION_CONFLICT');
                return {status: 'confirmed', revision: value.revision};
            }
            const snapshot = await transaction.get(companyRef);
            if (!snapshot.exists) fail('COMPANY_UNAVAILABLE');
            const record = snapshot.data();
            if (record.isArchived || (record.ownerId !== undefined && record.ownerId !== uid) ||
                (record.id !== undefined && record.id !== companyId)) fail('COMPANY_UNAVAILABLE');
            try {
                assertCompanyRecord(record);
            } catch {
                fail('COMPANY_CONTACTS_UNAVAILABLE');
            }
            const revision = companyContactsRevision(record);
            if (revision !== expectedRevision) fail('REVISION_CONFLICT');
            // The whole document was read, so Firestore re-runs this transaction
            // if any writer — the legacy company form, the QR editor — touches it
            // meanwhile: the guards below always judge committed state.
            const qr = companyContactQrState(record);
            if (operations.some(protectedOperation) && qr.state === 'unverified') fail('COMPANY_CONTACTS_QR_UNVERIFIABLE');
            // Working copies. `emails` is copied whole so keys this increment does
            // not know about survive the patch.
            const emails = {...(record.emails ?? {})};
            const slots = {}, phones = {};
            for (const slot of COMPANY_CONTACT_EMAIL_SLOTS) slots[slot] = emails[slot];
            for (const slot of COMPANY_CONTACT_PHONE_SLOTS) phones[slot] = record[slot];
            let extras = Array.isArray(emails.extra) ? [...emails.extra] : [];
            const touchedSlots = new Set(), touchedPhones = new Set();
            let touchedExtras = false;
            for (const operation of operations) {
                if (operation.kind === 'email-slot' || operation.kind === 'phone-slot') {
                    const stored = operation.kind === 'email-slot' ? (slots[operation.id] ?? null) : (phones[operation.id] ?? null);
                    if (await hash(companyContactBasis(stored)) !== operation.basis) fail('COMPANY_CONTACTS_CONFLICT');
                    if (protectedOperation(operation)) {
                        const refusal = companyContactEmptyRefusal(record, {kind: operation.kind, id: operation.id,
                            qrIncluded: qr.slots?.[operation.id] === true});
                        if (refusal) fail(refusal);
                    }
                    if (operation.kind === 'email-slot') {
                        const current = slots[operation.id];
                        slots[operation.id] = {...(current && typeof current === 'object' && !Array.isArray(current) ? current : {}), ...operation.fields};
                        touchedSlots.add(operation.id);
                        continue;
                    }
                    // A telephone slot is a top-level string in the real schema: it
                    // is replaced, never spread into an object.
                    phones[operation.id] = operation.value;
                    touchedPhones.add(operation.id);
                    continue;
                }
                if (operation.kind === 'email-extra-create') {
                    if (!companyContactExtraId(operation.id) || companyContactId(operation.id) === null) fail('COMPANY_CONTACTS_INVALID');
                    if (extras.some(item => item?.id === operation.id)) fail('COMPANY_CONTACTS_EXISTS');
                    // A new row starts unpublished, exactly as the legacy form does.
                    extras.push({id: operation.id, ...operation.fields, qr: operation.fields.qr === true});
                    touchedExtras = true;
                    continue;
                }
                const matches = extras.filter(item => item?.id === operation.id);
                if (matches.length !== 1) fail(matches.length ? 'COMPANY_CONTACTS_AMBIGUOUS' : 'COMPANY_CONTACTS_MISSING');
                const index = extras.indexOf(matches[0]);
                if (await hash(companyContactBasis(matches[0])) !== operation.basis) fail('COMPANY_CONTACTS_CONFLICT');
                if (operation.kind === 'email-extra-update') {
                    extras[index] = {...matches[0], ...operation.fields};
                    touchedExtras = true;
                    continue;
                }
                const refusal = companyContactExtraDeleteRefusal(matches[0], {qrIncluded: qr.extras?.[index] === true});
                if (refusal) fail(refusal);
                extras.splice(index, 1);
                touchedExtras = true;
            }
            if (!touchedSlots.size && !touchedPhones.size && !touchedExtras) fail('COMPANY_CONTACTS_INVALID');
            const patch = {};
            if (touchedSlots.size || touchedExtras) {
                const next = {...emails};
                for (const slot of touchedSlots) next[slot] = slots[slot];
                if (touchedExtras) next.extra = extras;
                patch.emails = next;
            }
            for (const slot of touchedPhones) patch[slot] = phones[slot];
            patch._companyContactsRevision = revision + 1;
            patch._companyContactsSchemaVersion = 1;
            patch._companyContactsUpdatedAt = timestamp();
            transaction.update(companyRef, patch);
            transaction.create(receiptRef, {kind: 'company-contacts', ownerId: uid, companyId, digest,
                revision: revision + 1, createdAt: timestamp()});
            return {status: 'confirmed', revision: revision + 1};
        });
    };
}
