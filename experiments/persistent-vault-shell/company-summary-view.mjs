import {COMPANY_SUMMARY_GROUPS} from './company-summary-reader.mjs';

// File sharing is invoked synchronously from its own click, after generation,
// preserving the browser user gesture. No automatic message is ever sent.
export function mountCompanySummaryView(root, context, {read, generate, download, share, canShare}) {
    const host = document.createElement('section'), choices = document.createElement('fieldset'), preview = document.createElement('div');
    const status = document.createElement('p'), prepare = document.createElement('button'), save = document.createElement('button'), send = document.createElement('button');
    const controls = new AbortController(), inputs = [];
    let disposed = false, busy = false, bytes = null;
    prepare.type = save.type = send.type = 'button'; prepare.textContent = 'Prepara PDF'; save.textContent = 'Scarica PDF'; send.textContent = 'Condividi PDF';
    save.disabled = send.disabled = true; status.setAttribute('role', 'status'); preview.dataset.companyPdfPreview = 'true';
    const check = () => {if (disposed || context.signal.aborted) throw Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const clear = () => {bytes?.fill(0); bytes = null; for (const tag of ['h3', 'dt', 'dd']) for (const node of preview.querySelectorAll(tag)) node.textContent = ''; preview.replaceChildren(); save.disabled = send.disabled = true;};
    const dispose = () => {if (disposed) return; disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose); clear(); status.textContent = ''; host.remove();};
    const names = ['Dati azienda', 'Dati fiscali', 'Referente', 'Email e telefoni', 'Sedi e indirizzi'];
    for (const [index, key] of COMPANY_SUMMARY_GROUPS.entries()) {
        const label = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span');
        input.type = 'checkbox'; input.checked = true; input.dataset.pdfGroup = key; text.textContent = names[index]; label.append(input, text); choices.append(label); inputs.push({key, input});
        input.addEventListener('change', () => {clear(); status.textContent = 'Selezione cambiata: prepara nuovamente il PDF.';}, {signal: controls.signal});
    }
    prepare.addEventListener('click', () => {void (async () => {
        if (busy) return; busy = true; choices.disabled = prepare.disabled = true; clear(); status.textContent = 'Preparazione PDF…';
        let generated;
        try {
            check(); const model = await read(Object.fromEntries(inputs.map(({key, input}) => [key, input.checked]))); check();
            generated = await generate(model, check); check();
            if (!(generated instanceof Uint8Array) || !generated.length || generated.length > 10000000) throw Error('INVALID_PDF');
            bytes = generated; generated = null;
            for (const section of model.sections) {
                const heading = document.createElement('h3'), list = document.createElement('dl'); heading.textContent = section.title;
                for (const row of section.rows) {const label = document.createElement('dt'), value = document.createElement('dd'); label.textContent = row.label; value.textContent = row.value; list.append(label, value);}
                preview.append(heading, list);
            }
            save.disabled = false; send.disabled = !canShare(bytes);
            status.textContent = send.disabled ? 'PDF pronto. Scaricalo per inviarlo con WhatsApp o email.' : 'PDF pronto. Puoi scaricarlo o scegliere come condividerlo.';
        } catch {generated?.fill?.(0); if (!disposed) {clear(); status.textContent = 'PDF non disponibile. Verifica la selezione e lo sblocco.';}}
        finally {busy = false; if (!disposed) choices.disabled = prepare.disabled = false;}
    })();}, {signal: controls.signal});
    const act = action => {
        try {
            check(); if (!bytes) return;
            // Invoke now, not after an await: native share needs this gesture.
            Promise.resolve(action(bytes)).catch(error => {if (!disposed && !context.signal.aborted) status.textContent = error?.name === 'AbortError' ? 'Condivisione annullata.' : 'Operazione non disponibile. Puoi scaricare il PDF.';});
        } catch {if (!disposed) status.textContent = 'Operazione non disponibile.';}
    };
    save.addEventListener('click', () => act(download), {signal: controls.signal});
    send.addEventListener('click', () => act(share), {signal: controls.signal});
    host.append(choices, prepare, save, send, preview, status); context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) dispose(); else root.append(host);
    return dispose;
}
