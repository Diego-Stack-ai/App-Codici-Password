// Produces only the saved, explicitly included contact projection. No upload,
// publication, image download, setting mutation or key reaches the caller.
export function createPrivateDigitalCardReader({context, getUser, repository, isEncryptedValue, buildVCard,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const fail = () => {throw new Error('DIGITAL_CARD_UNAVAILABLE');};
    const owned = value => {
        if (!value || typeof value !== 'object' || Array.isArray(value) || value.isArchived ||
            (Object.hasOwn(value, 'ownerId') && value.ownerId !== uid)) fail();
        return value;
    };
    const list = value => {
        if (!Array.isArray(value ?? []) || (value?.length ?? 0) > 10000) fail();
        return (value ?? []).map(owned);
    };
    const load = async () => {
        check(); const suffix = isOnline() ? 'Confirmed' : '';
        const profile = owned(await repository['getUserProfile' + suffix](uid)); check();
        const config = owned(await repository['getUserSetting' + suffix](uid, 'qrCodeInclusions')); check();
        const widgets = list(await repository['listProfileWidgets' + suffix](uid)); check();
        return {profile, config, widgets};
    };
    const decode = async value => {
        check(); if (value == null || value === '') return '';
        if (typeof value !== 'string' || value.length > 100000) fail();
        const result = isEncryptedValue(value) ? await context.read({ownerId: uid, ciphertext: value}) : value;
        check(); if (typeof result !== 'string' || result.length > 100000 || result === '--ERRORE--' || (isEncryptedValue(value) && result === value)) fail();
        return result;
    };
    const project = async (source, fields) => {
        const projected = {};
        for (const field of fields) projected[field] = await decode(source[field]);
        return projected;
    };
    return async () => {
        const initial = await load(), fingerprint = JSON.stringify(initial);
        const {profile, config, widgets} = initial, inclusions = {}, data = {}, options = {};
        for (const field of ['nome', 'cognome', 'cf', 'nascita', 'photo']) {
            if (config[field] !== undefined && typeof config[field] !== 'boolean') fail();
            inclusions[field] = config[field] === true;
        }
        if (inclusions.nome) data.nome = await decode(profile.nome);
        if (inclusions.nome || inclusions.cognome) data.cognome = await decode(profile.cognome);
        if (inclusions.nascita) Object.assign(data, await project(profile, ['birth_date', 'birth_place']));
        if (inclusions.photo) {
            data.photoURL = await decode(profile.photoURL);
            if (data.photoURL) {
                const url = new URL(data.photoURL);
                if (url.protocol !== 'https:' || url.username || url.password || /[\r\n]/.test(data.photoURL)) fail();
            }
        }
        if (inclusions.cf) {
            for (const document of list(profile.documenti)) {
                const type = await decode(document.type);
                if (!type.toLowerCase().includes('fiscale')) continue;
                data.documenti = [{type, ...await project(document, ['cf_value', 'num_serie', 'id_number', 'cf'])}]; break;
            }
        }
        for (const [type, collection, fields] of [['phones', 'contactPhones', ['number']], ['emails', 'contactEmails', ['address']],
            ['addresses', 'userAddresses', ['address', 'civic', 'city', 'cap']]]) {
            const refs = config[type] ?? [];
            if (!Array.isArray(refs) || refs.length > 10000 || new Set(refs).size !== refs.length) fail();
            const records = refs.length ? list(profile[collection]) : [];
            options[collection] = []; inclusions[type] = [];
            for (const ref of refs) {
                let record;
                if (Number.isSafeInteger(ref) && ref >= 0) record = records[ref];
                else if (typeof ref === 'string' && ref) {
                    const matches = records.filter(item => item.id === ref); if (matches.length !== 1) fail(); record = matches[0];
                } else fail();
                if (!record) fail();
                inclusions[type].push(options[collection].length); options[collection].push(await project(record, fields));
            }
        }
        options.customFields = [];
        const types = new Set(['text', 'textarea', 'number', 'date', 'phone', 'email', 'address', 'url', 'select', 'boolean', 'identifier', 'expiry']);
        for (const widget of widgets) for (const field of list(widget.fields)) {
            if (field.includeInQr !== true || field.encrypted !== false || field.sensitivity === 'secret' || field.valueEnc || !types.has(field.type)) continue;
            // Custom public fields must already be plaintext; never decode a
            // hidden ciphertext because an inclusion flag was tampered with.
            if (!['string', 'number', 'boolean'].includes(typeof field.value) || (typeof field.value === 'number' && !Number.isFinite(field.value))) fail();
            const value = String(field.value);
            if (value.length > 100000 || isEncryptedValue(value)) fail();
            for (const label of [field.label, field.qrLabel]) if (label != null && (typeof label !== 'string' || label.length > 100000)) fail();
            options.customFields.push({type: field.type, value, label: field.label || '', qrLabel: field.qrLabel || '',
                qrOrder: Number.isFinite(field.qrOrder) ? field.qrOrder : 0, includeInQr: true, encrypted: false});
        }
        check(); const vcard = buildVCard(data, inclusions, options);
        if (typeof vcard !== 'string' || new TextEncoder().encode(vcard).length > 65536) fail();
        const current = await load(); check();
        if (JSON.stringify(current) !== fingerprint) throw new Error('DIGITAL_CARD_CHANGED');
        return vcard;
    };
}
