import {mountAccountWidgetView} from './account-widget-view.mjs';

// Collapse here is a view preference only. No persisted Widget is edited.
export async function mountProfileWidgetView(root, context, {reader, copyText}) {
    const host = document.createElement('section'); host.className = 'profile-widget-zone';
    const controls = new AbortController(), cards = [];
    let disposed = false;
    const check = () => {if (disposed || context.signal.aborted) throw new Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const dispose = () => {
        if (disposed) return; disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose);
        for (const card of cards) card.close(); cards.length = 0; host.remove();
    };
    try {
        check(); context.signal.addEventListener('abort', dispose, {once: true}); root.append(host);
        const widgets = await reader.list(); check();
        if (!widgets.length) host.hidden = true;
        for (const widget of widgets) {
            check();
            const group = document.createElement('article'), button = document.createElement('button'), body = document.createElement('div');
            group.dataset.profileWidget = widget.id; button.type = 'button'; group.append(button, body); host.append(group);
            let lifetime, cleanup, expanded = false, ticket = 0;
            const clearBody = () => {ticket++; lifetime?.abort(); lifetime = null; cleanup?.(); cleanup = null; body.replaceChildren();};
            const label = () => {button.textContent = `${expanded ? 'Comprimi' : 'Apri'} ${widget.title}`; button.setAttribute('aria-expanded', String(expanded));};
            const setExpanded = async value => {
                check(); clearBody(); expanded = value; label();
                if (!expanded) return;
                const current = ticket, controller = lifetime = new AbortController();
                const scoped = {...context, signal: controller.signal, assertUnlocked: () => {check(); if (controller.signal.aborted) throw new Error('VIEW_DISPOSED');}};
                const mounted = await mountAccountWidgetView(body, scoped, {copyText, reader: {
                    list: async () => {
                        const rows = (await reader.list()).filter(row => row.id === widget.id);
                        if (rows.length !== 1) throw new Error('PROFILE_WIDGET_CHANGED');
                        return rows;
                    }, read: (...args) => reader.read(...args)
                }});
                if (disposed || context.signal.aborted || current !== ticket) mounted(); else cleanup = mounted;
            };
            cards.push({close: () => {clearBody(); button.textContent = ''; group.remove();}});
            button.addEventListener('click', () => {void setExpanded(!expanded).catch(() => {if (!disposed) {clearBody(); button.textContent = 'Widget non disponibile';}});}, {signal: controls.signal});
            label(); await setExpanded(!widget.collapsed); check();
        }
        return dispose;
    } catch {
        if (disposed || context.signal.aborted) {dispose(); return dispose;}
        for (const card of cards) card.close(); cards.length = 0;
        const message = document.createElement('p'); message.textContent = 'Widget del profilo non disponibili. Riapri la sezione dopo lo sblocco o la connessione.';
        host.append(message); return dispose;
    }
}
