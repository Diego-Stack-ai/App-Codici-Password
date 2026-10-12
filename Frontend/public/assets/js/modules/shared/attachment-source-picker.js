const STYLE_ID = 'attachment-source-picker-styles';
let activePicker = null;

export function closeAttachmentSourcePicker() {
    activePicker?.(null);
}

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = new URL('../../../css/attachment-source-picker.css', import.meta.url).href;
    document.head.append(link);
}

export function selectAttachmentSource() {
    ensureStyles();
    closeAttachmentSourcePicker();
    return new Promise(resolve => {
        const previousOverflow = document.body.style.overflow;
        const overlay = document.createElement('div');
        overlay.className = 'attachment-source-picker';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Seleziona sorgente allegato');
        overlay.innerHTML = `<section class="attachment-source-picker-card">
            <h3>Seleziona sorgente</h3>
            <div class="attachment-source-picker-grid">
                <button type="button" data-source="card" class="is-wide"><span class="material-symbols-outlined">crop_free</span><strong>Scansiona tessera/carta</strong></button>
                <button type="button" data-source="camera"><span class="material-symbols-outlined">photo_camera</span><strong>Camera</strong></button>
                <button type="button" data-source="gallery"><span class="material-symbols-outlined">collections</span><strong>Galleria</strong></button>
                <button type="button" data-source="document" class="is-wide"><span class="material-symbols-outlined">description</span><strong>Documento</strong></button>
            </div>
            <button type="button" class="attachment-source-picker-cancel">Annulla</button>
        </section>`;
        const finish = value => {
            if (!overlay.isConnected) return;
            activePicker = null;
            document.removeEventListener('keydown', onKeydown);
            overlay.remove();
            document.body.style.overflow = previousOverflow;
            resolve(value);
        };
        const onKeydown = event => { if (event.key === 'Escape') finish(null); };
        activePicker = finish;
        overlay.addEventListener('click', event => {
            const source = event.target.closest('[data-source]')?.dataset.source;
            if (source) finish(source);
            else if (event.target === overlay || event.target.closest('.attachment-source-picker-cancel')) finish(null);
        });
        document.addEventListener('keydown', onKeydown);
        document.body.append(overlay);
        document.body.style.overflow = 'hidden';
        overlay.querySelector('[data-source="card"]')?.focus();
    });
}

