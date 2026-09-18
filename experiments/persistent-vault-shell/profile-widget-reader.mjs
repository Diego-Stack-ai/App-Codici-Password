const fail = () => {throw new Error('PROFILE_WIDGET_UNAVAILABLE');};
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value);
const text = value => {if (typeof value !== 'string' || value.length > 100000) fail(); return value;};
const plain = value => {
    if (!['string', 'number', 'boolean'].includes(typeof value) || (typeof value === 'number' && !Number.isFinite(value))) fail();
    return text(String(value));
};
const order = item => Number.isFinite(item.order) ? item.order : 0;
const unique = rows => {
    if (!Array.isArray(rows) || rows.length > 10000) fail();
    const ids = new Set();
    for (const row of rows) {if (!row || !identifier(row.id) || ids.has(row.id)) fail(); ids.add(row.id);}
    return rows;
};

// Only the existing users/{uid}/profileWidgets namespace is supported. There is
// no company namespace migration or fallback to the private profile's Widgets.
export function createProfileWidgetReader({context, getUser, repository, tab, validateProfileWidget,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    if (!['personal', 'contacts', 'addresses', 'documents'].includes(tab)) fail();
    const uid = context.user?.uid;
    const check = () => {
        if (!uid || getUser()?.uid !== uid) throw new Error('AUTH_CHANGED');
        if (context.signal.aborted) throw new Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const load = async () => {
        check();
        const rows = unique(await repository[isOnline() ? 'listProfileWidgetsConfirmed' : 'listProfileWidgets'](uid)); check();
        const selected = rows.filter(row => row.tab === tab);
        for (const row of selected) {
            if (row.isArchived || row.companyId != null || (Object.hasOwn(row, 'ownerId') && row.ownerId !== uid) || !validateProfileWidget(row).valid) fail();
            text(row.title); unique(row.fields);
            for (const field of row.fields) {
                text(field.label);
                if (typeof field.encrypted !== 'boolean' || (field.preview !== undefined && typeof field.preview !== 'boolean') ||
                    (field.copyable !== undefined && typeof field.copyable !== 'boolean')) fail();
                if (!field.encrypted && (field.sensitivity === 'secret' || ['sensitive', 'password', 'pin', 'puk', 'secret'].includes(field.type))) fail();
                if (field.encrypted) {if (!text(field.valueEnc)) fail();} else plain(field.value ?? '');
            }
        }
        return selected.sort((a, b) => order(a) - order(b));
    };
    const find = (rows, widgetId, fieldId) => {
        const widget = rows.find(row => row.id === widgetId), field = widget?.fields.find(item => item.id === fieldId);
        if (!field) fail(); return {widget, field};
    };
    return Object.freeze({
        async list() {
            const rows = await load(); check();
            return Object.freeze(rows.map(widget => Object.freeze({id: widget.id, kind: 'embedded', title: widget.title, collapsed: widget.collapsed === true,
                fields: Object.freeze([...widget.fields].sort((a, b) => order(a) - order(b)).map(field => Object.freeze({id: field.id,
                    label: field.label, encrypted: field.encrypted, preview: field.preview !== false, copyable: !field.encrypted && field.copyable === true})))})));
        },
        async read(widgetId, fieldId, {expectedEncrypted, copy = false} = {}) {
            if (!identifier(widgetId) || !identifier(fieldId)) fail();
            const {widget, field} = find(await load(), widgetId, fieldId); check();
            if (expectedEncrypted !== undefined && expectedEncrypted !== field.encrypted) throw new Error('WIDGET_CHANGED');
            if (copy && (field.encrypted || field.copyable !== true)) throw new Error('WIDGET_COPY_FORBIDDEN');
            const fingerprint = JSON.stringify(widget);
            const value = field.encrypted ? await context.read({ownerId: uid, ciphertext: field.valueEnc}) : plain(field.value ?? '');
            check();
            const current = find(await load(), widgetId, fieldId); check();
            if (JSON.stringify(current.widget) !== fingerprint) throw new Error('WIDGET_CHANGED');
            if (typeof value !== 'string' || value.length > 100000 || (field.encrypted && (value === field.valueEnc || value === '--ERRORE--'))) fail();
            return value;
        }
    });
}
