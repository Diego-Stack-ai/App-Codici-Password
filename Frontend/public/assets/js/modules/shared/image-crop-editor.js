const EDITABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIDE = 2048;

function button(label, action, primary = false) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = primary ? 'image-editor-button image-editor-primary' : 'image-editor-button';
    node.textContent = label;
    node.addEventListener('click', action);
    return node;
}

function canvasFile(canvas, source) {
    const type = source.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = type === 'image/jpeg' ? .9 : undefined;
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
        if (!blob) return reject(new Error('IMAGE_EXPORT_FAILED'));
        const stem = source.name.replace(/\.[^.]+$/, '') || 'immagine';
        resolve(new File([blob], `${stem}-ritagliata.${type === 'image/png' ? 'png' : 'jpg'}`, {type, lastModified: Date.now()}));
    }, type, quality));
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const url = URL.createObjectURL(file);
        image.onload = () => {URL.revokeObjectURL(url); resolve(image);};
        image.onerror = () => {URL.revokeObjectURL(url); reject(new Error('IMAGE_READ_FAILED'));};
        image.src = url;
    });
}

function scaledCanvas(source) {
    const width = source.naturalWidth || source.width;
    const height = source.naturalHeight || source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
}

export function canEditImage(file) {
    return file instanceof Blob && EDITABLE_TYPES.has(file.type);
}

export async function editImageBeforeUpload(file) {
    if (!canEditImage(file)) return file;
    const source = await loadImage(file);
    let working = scaledCanvas(source);
    let selection;
    let dragging = null;

    return new Promise((resolve, reject) => {
        const overlay = document.createElement('div');
        overlay.className = 'image-editor-overlay';
        const dialog = document.createElement('section');
        dialog.className = 'image-editor-dialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        const title = document.createElement('h2');
        title.textContent = 'Prepara immagine';
        const help = document.createElement('p');
        help.className = 'image-editor-help';
        help.textContent = 'Trascina gli angoli per scegliere la parte da salvare. Puoi ruotare e ridimensionare prima della conferma.';
        const preview = document.createElement('canvas');
        preview.className = 'image-editor-preview';
        preview.setAttribute('aria-label', 'Anteprima con area di ritaglio');
        const controls = document.createElement('div');
        controls.className = 'image-editor-controls';
        const close = value => {overlay.remove(); document.body.classList.remove('image-editor-open'); resolve(value);};
        const resetSelection = () => {
            const inset = Math.max(10, Math.round(Math.min(working.width, working.height) * .04));
            selection = {x: inset, y: inset, width: working.width - inset * 2, height: working.height - inset * 2};
        };
        const corners = () => [
            {name: 'nw', x: selection.x, y: selection.y},
            {name: 'ne', x: selection.x + selection.width, y: selection.y},
            {name: 'sw', x: selection.x, y: selection.y + selection.height},
            {name: 'se', x: selection.x + selection.width, y: selection.y + selection.height}
        ];
        const paint = () => {
            preview.width = working.width; preview.height = working.height;
            const context = preview.getContext('2d');
            context.drawImage(working, 0, 0);
            context.fillStyle = 'rgb(0 0 0 / 52%)'; context.fillRect(0, 0, preview.width, preview.height);
            context.drawImage(working, selection.x, selection.y, selection.width, selection.height,
                selection.x, selection.y, selection.width, selection.height);
            context.strokeStyle = '#4da3ff'; context.lineWidth = Math.max(3, preview.width / 450);
            context.strokeRect(selection.x, selection.y, selection.width, selection.height);
            for (const corner of corners()) {
                context.beginPath(); context.fillStyle = '#fff';
                context.arc(corner.x, corner.y, Math.max(10, preview.width / 70), 0, Math.PI * 2); context.fill();
            }
        };
        const point = event => {
            const box = preview.getBoundingClientRect();
            return {x: Math.max(0, Math.min(preview.width, (event.clientX - box.left) * preview.width / box.width)),
                y: Math.max(0, Math.min(preview.height, (event.clientY - box.top) * preview.height / box.height))};
        };
        preview.addEventListener('pointerdown', event => {
            const at = point(event), radius = Math.max(30, preview.width / 18);
            const corner = corners().find(item => Math.hypot(item.x - at.x, item.y - at.y) <= radius);
            if (!corner) return;
            event.preventDefault(); dragging = {name: corner.name}; preview.setPointerCapture(event.pointerId);
        });
        preview.addEventListener('pointermove', event => {
            if (!dragging) return;
            event.preventDefault(); const at = point(event);
            const opposite = {nw: {x: selection.x + selection.width, y: selection.y + selection.height},
                ne: {x: selection.x, y: selection.y + selection.height}, sw: {x: selection.x + selection.width, y: selection.y},
                se: {x: selection.x, y: selection.y}}[dragging.name];
            selection = {x: Math.min(opposite.x, at.x), y: Math.min(opposite.y, at.y),
                width: Math.max(20, Math.abs(opposite.x - at.x)), height: Math.max(20, Math.abs(opposite.y - at.y))};
            paint();
        });
        const stop = () => {dragging = null;};
        preview.addEventListener('pointerup', stop); preview.addEventListener('pointercancel', stop);
        const rotate = () => {
            const canvas = document.createElement('canvas'); canvas.width = working.height; canvas.height = working.width;
            const context = canvas.getContext('2d'); context.translate(canvas.width, 0); context.rotate(Math.PI / 2);
            context.drawImage(working, 0, 0); working = canvas; resetSelection(); paint();
        };
        const confirm = async () => {
            try {
                const cropped = document.createElement('canvas');
                const scale = Math.min(1, MAX_SIDE / Math.max(selection.width, selection.height));
                cropped.width = Math.max(1, Math.round(selection.width * scale));
                cropped.height = Math.max(1, Math.round(selection.height * scale));
                cropped.getContext('2d').drawImage(working, selection.x, selection.y, selection.width, selection.height,
                    0, 0, cropped.width, cropped.height);
                close(await canvasFile(cropped, file));
            } catch (error) {overlay.remove(); document.body.classList.remove('image-editor-open'); reject(error);}
        };
        controls.append(button('Annulla', () => close(null)), button('Ruota 90°', rotate), button('Salva ritaglio', confirm, true));
        dialog.append(title, help, preview, controls); overlay.append(dialog); document.body.append(overlay);
        document.body.classList.add('image-editor-open'); resetSelection(); paint();
    });
}
