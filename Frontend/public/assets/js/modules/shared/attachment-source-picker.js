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

function createUploadElement(tagName, className, textContent = '') {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
}

export function attachmentUploadErrorMessage(error) {
    const code = String(error?.code || error?.message || '');
    if (code.includes('retry-limit-exceeded') || code.includes('network')) {
        return 'Caricamento interrotto dalla connessione. Riprova mantenendo aperta questa pagina.';
    }
    if (code.includes('unauthorized')) {
        return 'Il caricamento non è autorizzato. Aggiorna la pagina e riprova.';
    }
    if (code.includes('ATTACHMENT_UPLOAD_ABORTED') || code.includes('canceled')) {
        return 'Caricamento interrotto prima del completamento. Riprova mantenendo aperta questa pagina.';
    }
    return 'Il video non è stato caricato. Riprova mantenendo aperta questa pagina fino al 100%.';
}

export async function beginLargeAttachmentUploadFeedback(file) {
    document.getElementById('large-attachment-upload-status')?.remove();
    const status = createUploadElement('div', 'attachment-upload-status');
    status.id = 'large-attachment-upload-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    const title = createUploadElement('strong', 'attachment-upload-title', `Caricamento di ${file.name}`);
    const message = createUploadElement('span', 'attachment-upload-message', 'Preparazione del video… Non chiudere questa pagina.');
    const progress = createUploadElement('progress', 'attachment-upload-progress');
    progress.max = 100;
    progress.value = 0;
    status.append(title, message, progress);
    const attachmentList = document.getElementById('attachments-list');
    attachmentList?.parentNode?.insertBefore(status, attachmentList);

    const preventNavigation = event => {
        event.preventDefault();
        event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventNavigation);
    let wakeLock = null;
    try {
        wakeLock = await navigator.wakeLock?.request?.('screen');
    } catch {
        wakeLock = null;
    }

    let finished = false;
    return {
        update(percent) {
            const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
            progress.value = safePercent;
            message.textContent = `Video in caricamento: ${safePercent}%. Non chiudere questa pagina.`;
        },
        success() {
            finished = true;
            progress.value = 100;
            status.classList.add('is-success');
            message.textContent = 'Video caricato correttamente.';
            setTimeout(() => status.remove(), 2500);
        },
        fail(error) {
            finished = true;
            status.classList.add('is-error');
            progress.remove();
            message.textContent = attachmentUploadErrorMessage(error);
        },
        async release() {
            window.removeEventListener('beforeunload', preventNavigation);
            await (wakeLock?.release?.())?.catch(() => {});
            if (!finished) status.remove();
        }
    };
}

