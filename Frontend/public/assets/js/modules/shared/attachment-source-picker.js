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

const SOURCE_OPTIONS = Object.freeze([
    {source: 'card', icon: 'crop_free', label: 'Scansiona tessera/carta', wide: true},
    {source: 'camera', icon: 'photo_camera', label: 'Camera'},
    {source: 'gallery', icon: 'collections', label: 'Galleria'},
    {source: 'document', icon: 'description', label: 'Documento', wide: true}
]);

export function createAttachmentSourceGrid(onSelect) {
    ensureStyles();
    const grid = document.createElement('div');
    grid.className = 'attachment-source-picker-grid';
    for (const option of SOURCE_OPTIONS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.source = option.source;
        if (option.wide) button.className = 'is-wide';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined notranslate';
        icon.textContent = option.icon;
        const label = document.createElement('strong');
        label.textContent = option.label;
        button.append(icon, label);
        button.addEventListener('click', () => onSelect?.(option.source));
        grid.append(button);
    }
    return grid;
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
        const card = document.createElement('section');
        card.className = 'attachment-source-picker-card';
        const heading = document.createElement('h3');
        heading.textContent = 'Seleziona sorgente';
        let finish;
        const grid = createAttachmentSourceGrid(value => finish(value));
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'attachment-source-picker-cancel';
        cancel.textContent = 'Annulla';
        card.append(heading, grid, cancel);
        overlay.append(card);
        finish = value => {
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
            if (event.target === overlay || event.target.closest('.attachment-source-picker-cancel')) finish(null);
        });
        document.addEventListener('keydown', onKeydown);
        document.body.append(overlay);
        document.body.style.overflow = 'hidden';
        overlay.querySelector('[data-source="card"]')?.focus();
    });
}

