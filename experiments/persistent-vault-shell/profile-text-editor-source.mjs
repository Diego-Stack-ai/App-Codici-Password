import {PROFILE_TEXT_FIELDS, profileTextTarget, profileTextRevision, profileTextBasis, profileTextObject} from './profile-text-contract.mjs';
import {prepareProfileText} from './prepare-profile-text.mjs';
const labels = {nome: 'Nome', cognome: 'Cognome', birth_place: 'Luogo di nascita', birth_date: 'Data di nascita', note: 'Note',
    ragioneSociale: 'Ragione sociale', formaGiuridica: 'Forma giuridica', partitaIva: 'Partita IVA', codiceSDI: 'Codice SDI',
    numeroCCIAA: 'CCIAA', dataIscrizione: 'Data iscrizione', referenteNome: 'Nome referente', referenteCognome: 'Cognome referente', referenteTitolo: 'Ruolo referente'};

export function createProfileTextEditorSource({context, getUser, repository, source, isEncryptedValue, hash,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid, target = profileTextTarget(source ? {domain: 'company', companyId: source.companyId} : {domain: 'private'});
    let disposed = false, basis = null;
    const dispose = () => {disposed = true; basis = null; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');}
        context.assertUnlocked();
        if (source && (source.domain !== 'company' || source.companyId !== target.companyId)) throw Error('PROFILE_TARGET_CHANGED');
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    const read = async confirmed => {
        check(); const record = await (source ? source.read(uid, confirmed) : repository[confirmed ? 'getUserProfileConfirmed' : 'getUserProfile'](uid)); check();
        const revision = profileTextRevision(record);
        if (record.ownerId !== undefined && record.ownerId !== uid) throw Error('OWNER_MISMATCH');
        const projection = {ownerId: uid, _profileTextRevision: revision, _profileTextSchemaVersion: 1};
        for (const field of PROFILE_TEXT_FIELDS[target.domain]) {
            profileTextBasis(record, field);
            if (Object.hasOwn(record, field)) projection[field] = record[field];
        }
        return Object.freeze(projection);
    };
    return Object.freeze({dispose,
        async load() {
            basis = null; const initial = await read(isOnline()), fields = [];
            for (const key of PROFILE_TEXT_FIELDS[target.domain]) {
                const raw = initial[key] ?? '', encrypted = isEncryptedValue(raw);
                check(); const value = encrypted ? await context.read({ownerId: uid, ciphertext: raw}) : raw; check();
                const maxLength = key === 'note' ? 20000 : 1000;
                if (typeof value !== 'string' || value.length > maxLength || value === '--ERRORE--' || (encrypted && value === raw)) throw Error('PROFILE_VALUE_INVALID');
                fields.push(Object.freeze({key, label: labels[key], value, maxLength, multiline: key === 'note'}));
            }
            const current = await read(isOnline()); check();
            if (JSON.stringify(current) !== JSON.stringify(initial)) throw Error('PROFILE_CHANGED');
            basis = initial;
            return Object.freeze({fields: Object.freeze(fields), canSave: isOnline()});
        },
        async prepare(changes, operationId) {
            check(); if (!basis || !isOnline() || !profileTextObject(changes)) throw Error('PROFILE_SAVE_UNAVAILABLE');
            const copied = {...changes}, expected = basis, current = await read(true); check();
            if (basis !== expected || JSON.stringify(current) !== JSON.stringify(expected)) throw Error('PROFILE_CHANGED');
            return prepareProfileText({context, getUser, source: current, target, changes: copied, operationId, hash});
        }
    });
}
