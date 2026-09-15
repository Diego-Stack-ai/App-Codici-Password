// Read-only saved selection. QR generation and download are separate explicit
// actions; no photograph bytes or contact data are fetched by the renderer.
export function mountDigitalCardView(root, context, {generate, loadQr, renderQr, makePayload, download, mountEditor}) {
    const host = document.createElement('section'), preview = document.createElement('div'), status = document.createElement('p');
    const create = document.createElement('button'), save = document.createElement('button');
    const notice = document.createElement('p');
    notice.textContent = 'Il QR contiene i dati selezionati in chiaro. Usa la selezione già salvata nel profilo. La foto, se inclusa, richiede Internet al destinatario.';
    create.type = save.type = 'button'; create.textContent = 'Genera QR dalla selezione salvata'; save.textContent = 'Scarica contatto';
    preview.dataset.digitalCardPreview = 'true'; status.setAttribute('role', 'status');
    const edit = document.createElement('button'), editorRoot = document.createElement('div');
    edit.type = 'button'; edit.textContent = 'Modifica selezione';
    const controls = new AbortController(); let disposed = false, busy = false, editorCleanup = null;
    const check = () => {if (disposed || context.signal.aborted) throw new Error('VIEW_DISPOSED'); context.assertUnlocked();};
    const clear = () => {
        for (const canvas of preview.querySelectorAll('canvas')) {canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); canvas.width = canvas.height = 0;}
        for (const img of preview.querySelectorAll('img')) img.removeAttribute('src');
        preview.removeAttribute('title'); preview.replaceChildren();
    };
    const dispose = () => {if (disposed) return; disposed = true; controls.abort(); context.signal.removeEventListener('abort', dispose); editorCleanup?.(); editorCleanup = null; clear(); status.textContent = ''; host.remove();};
    const run = async action => {
        if (busy) return; busy = true; create.disabled = save.disabled = edit.disabled = true;
        try {check(); clear(); status.textContent = ''; await action(); check();}
        catch {if (!disposed && !context.signal.aborted) {clear(); status.textContent = 'Tessera non disponibile. Verifica lo sblocco, la connessione e la selezione salvata.';}}
        finally {busy = false; if (!disposed) create.disabled = save.disabled = edit.disabled = false;}
    };
    create.addEventListener('click', () => {void run(async () => {
        await loadQr(); check();
        const card = await generate(); check();
        renderQr(preview, makePayload(card)); check();
        if (!preview.querySelectorAll('canvas,img').length) throw new Error('QR_RENDER_FAILED');
        status.textContent = 'QR pronto. La foto non viene mostrata separatamente in questa anteprima.';
    });}, {signal: controls.signal});
    save.addEventListener('click', () => {void run(async () => {
        const card = await generate(); check(); await download(card, check); check(); status.textContent = 'Contatto scaricato.';
    });}, {signal: controls.signal});
    host.append(notice, create, save, preview, status);
    if (mountEditor) {
        edit.addEventListener('click', () => {void run(async () => {
            editorCleanup?.(); editorCleanup = null;
            const cleanup = await mountEditor(editorRoot);
            if (disposed || context.signal.aborted) {cleanup(); return;}
            editorCleanup = cleanup;
        });}, {signal: controls.signal});
        host.append(edit, editorRoot);
    }
    context.signal.addEventListener('abort', dispose, {once: true});
    if (context.signal.aborted) dispose(); else root.append(host);
    return dispose;
}
