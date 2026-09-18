import {mountAccountWidgetView} from './account-widget-view.mjs';
const labels = {iban: 'IBAN', passwordDispositiva: 'Password dispositiva', numeroVerde: 'Numero verde', referenteNome: 'Referente banca',
    referenteTelefono: 'Telefono banca', referenteCellulare: 'Cellulare banca', cardType: 'Tipo carta', type: 'Tipo', titolare: 'Intestatario',
    cardNumber: 'Numero carta', expiry: 'Scadenza', pin: 'PIN', ccv: 'CCV'};

export async function mountBankingView(root, context, {listBanks, widgetReader, copyText}) {
    let disposed = false;
    const cleanups = [], host = document.createElement('section'); host.className = 'banking-shell';
    const check = () => {if (disposed || context.signal.aborted) throw new Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const dispose = () => {
        if (disposed) return; disposed = true;
        context.signal.removeEventListener('abort', dispose);
        for (const cleanup of cleanups) cleanup(); cleanups.length = 0; host.remove();
    };
    const retain = cleanup => {if (disposed) cleanup(); else cleanups.push(cleanup);};
    const mountFields = (target, capability, title, id) => mountAccountWidgetView(target, context, {copyText, allowSecretCopy: true,
        reader: {list: async () => [{id, title, kind: 'embedded', fields: capability.fields.map(field => ({id: field.id,
            label: labels[field.id], encrypted: field.secret, copyable: true}))}], read: (_id, field) => capability.read(field)}});
    try {
        check(); context.signal.addEventListener('abort', dispose, {once: true}); root.append(host);
        const banks = await listBanks(); check();
        if (!banks.length) host.hidden = true;
        for (const bank of banks) {
            check();
            const group = document.createElement('article'); group.className = 'bank-account';
            group.dataset.bankId = bank.bankId ?? ''; group.dataset.bankIndex = String(bank.index);
            const fields = document.createElement('div'), widgets = document.createElement('div'), cards = document.createElement('div');
            fields.dataset.bankPart = 'fields'; widgets.dataset.bankPart = 'widgets'; cards.dataset.bankPart = 'cards';
            group.append(fields, widgets, cards); host.append(group);
            retain(await mountFields(fields, bank, `Conto ${bank.index + 1}`, 'bank-fields')); check();
            if (bank.bankId && widgetReader) {
                retain(await mountAccountWidgetView(widgets, context, {copyText, reader: {
                    list: async () => (await widgetReader.list()).filter(widget => widget.bankId === bank.bankId).map(widget => ({...widget, bankId: null})),
                    read: (...args) => widgetReader.read(...args)
                }})); check();
            }
            for (const card of bank.cards) {
                retain(await mountFields(cards, card, `Carta ${card.index + 1}`, `card-${card.index}`)); check();
            }
        }
        return dispose;
    } catch {
        const interrupted = disposed || context.signal.aborted;
        for (const cleanup of cleanups) cleanup(); cleanups.length = 0;
        host.replaceChildren();
        if (interrupted) dispose();
        else {const message = document.createElement('p'); message.textContent = 'Dati bancari non disponibili. Riapri il dettaglio dopo lo sblocco o la connessione.'; host.append(message);}
        return dispose;
    }
}
