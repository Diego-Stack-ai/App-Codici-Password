import {parseAccountDestination} from './account-route.mjs';

const fail = () => { throw new Error('WIDGET_UNAVAILABLE'); };
const identifier = value => typeof value === 'string' && value.trim() && !/[\\/%\u0000-\u001f\u007f]/u.test(value) && value !== '.' && value !== '..';
const text = value => { if (typeof value !== 'string') fail(); return value; };
const plainValue = value => {
    if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) fail();
    return String(value);
};
function unique(records) {
    if (!Array.isArray(records)) fail();
    const ids = new Set();
    for (const record of records) {
        if (!record || !identifier(record.id) || ids.has(record.id)) fail();
        ids.add(record.id);
    }
    return records;
}

// Read capability only. No key/ciphertext is returned to a renderer, and every
// value request resolves the current Account and link again after decryption.
export function createAccountWidgetReader({context, getUser, repository, selection, isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    if (!selection || !['private', 'company'].includes(selection.domain) || !identifier(selection.id) ||
        (selection.domain === 'company' && !identifier(selection.companyId))) fail();
    if (selection.domain === 'private' && selection.companyId !== undefined) fail();
    const target = parseAccountDestination(`dettaglio_account_${selection.domain === 'private' ? 'privato' : 'azienda'}.html?id=${encodeURIComponent(selection.id)}` +
        (selection.domain === 'company' ? `&aziendaId=${encodeURIComponent(selection.companyId)}` : ''), {uid, companyId: selection.companyId});
    const check = () => {
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        context.assertUnlocked();
    };
    const owned = record => {
        if (!record || record.isArchived || (Object.hasOwn(record, 'ownerId') && record.ownerId !== uid)) fail();
        return record;
    };
    async function load() {
        check();
        const suffix = isOnline() ? 'Confirmed' : '';
        const account = await (target.domain === 'private'
            ? repository['getPrivateAccount' + suffix](uid, target.id)
            : repository['getCompanyAccount' + suffix](uid, target.companyId, target.id));
        check(); owned(account);
        const all = await repository['listAccountWidgets' + suffix](uid);
        check();
        const widgets = unique(all).filter(widget => widget.context === target.domain && widget.accountId === target.id &&
            (target.domain === 'company' ? widget.companyId === target.companyId : !widget.companyId));
        widgets.forEach(owned);
        const shared = widgets.some(widget => widget.kind === 'shared-reference')
            ? unique(await repository['listSharedVaultData' + suffix](uid)) : [];
        check();
        return widgets.map(widget => {
            if (!['embedded', 'shared-reference'].includes(widget.kind)) fail();
            if (widget.bankId != null && !identifier(widget.bankId)) fail();
            if (widget.bankId != null) {
                // Bank-linked Widgets require a real, unique canonical parent.
                // Legacy accounts without stable IDs cannot acquire a synthetic
                // parent ID merely by being consulted.
                const banks = Array.isArray(account.banking) ? account.banking :
                    account.banking && typeof account.banking === 'object' ? [account.banking] : [];
                if (banks.filter(bank => bank?.bankId === widget.bankId).length !== 1) throw new Error('WIDGET_BANK_UNAVAILABLE');
            }
            if (widget.kind === 'shared-reference' && !identifier(widget.sharedDataId)) fail();
            const record = widget.kind === 'embedded' ? widget : owned(shared.find(item => item.id === widget.sharedDataId));
            unique(record.fields);
            for (const field of record.fields) {
                text(field.label);
                if (typeof field.encrypted !== 'boolean') fail();
                if (field.encrypted) { if (!text(field.valueEnc)) fail(); }
                else plainValue(field.value ?? '');
            }
            return {widget, record};
        });
    }
    const find = (rows, widgetId, fieldId) => {
        const row = rows.find(item => item.widget.id === widgetId);
        const field = row?.record.fields.find(item => item.id === fieldId);
        if (!row || !field) fail();
        return {row, field};
    };
    return Object.freeze({
        async list() {
            const rows = await load(); check();
            return Object.freeze(rows.map(({widget, record}) => Object.freeze({
                id: widget.id, kind: widget.kind, title: text(record.title ?? ''),
                bankId: widget.bankId ?? null,
                fields: Object.freeze(record.fields.map(field => Object.freeze({id: field.id, label: field.label,
                    encrypted: field.encrypted, copyable: !field.encrypted && field.copyable !== false})))
            })));
        },
        async read(widgetId, fieldId, {expectedEncrypted, copy = false} = {}) {
            if (!identifier(widgetId) || !identifier(fieldId)) fail();
            const {row, field} = find(await load(), widgetId, fieldId); check();
            if (expectedEncrypted !== undefined && field.encrypted !== expectedEncrypted) throw new Error('WIDGET_CHANGED');
            if (copy && (field.encrypted || field.copyable === false)) throw new Error('WIDGET_COPY_FORBIDDEN');
            const fingerprint = JSON.stringify([row.widget, row.record]);
            const value = field.encrypted ? await context.read({ownerId: uid, ciphertext: field.valueEnc}) : plainValue(field.value ?? '');
            check();
            const current = find(await load(), widgetId, fieldId); check();
            if (JSON.stringify([current.row.widget, current.row.record]) !== fingerprint) throw new Error('WIDGET_CHANGED');
            if (typeof value !== 'string' || (field.encrypted && (value === field.valueEnc || value === '--ERRORE--'))) fail();
            return value;
        }
    });
}
