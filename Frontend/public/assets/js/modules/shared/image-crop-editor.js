const EDITABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIDE = 2048;
const CARD_SIZE = {width: 1012, height: 638};
const MIN_EDGE = 24;

function button(label, action, primary = false) {
    const node = document.createElement('button');
    node.type = 'button'; node.className = primary ? 'image-editor-button image-editor-primary' : 'image-editor-button';
    node.textContent = label; node.addEventListener('click', action); return node;
}

function canvasFile(canvas, source) {
    const type = source.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
        if (!blob) return reject(new Error('IMAGE_EXPORT_FAILED'));
        const stem = source.name.replace(/\.[^.]+$/, '') || 'immagine';
        resolve(new File([blob], `${stem}-ritagliata.${type === 'image/png' ? 'png' : 'jpg'}`, {type, lastModified: Date.now()}));
    }, type, type === 'image/jpeg' ? .9 : undefined));
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const image = new Image(), url = URL.createObjectURL(file);
        image.onload = () => {URL.revokeObjectURL(url); resolve(image);};
        image.onerror = () => {URL.revokeObjectURL(url); reject(new Error('IMAGE_READ_FAILED'));}; image.src = url;
    });
}

function scaledCanvas(source) {
    const width = source.naturalWidth || source.width, height = source.naturalHeight || source.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height); return canvas;
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);

export function isValidQuadrilateral(points) {
    if (!Array.isArray(points) || points.length !== 4) return false;
    if (points.some((point, index) => distance(point, points[(index + 1) % 4]) < MIN_EDGE)) return false;
    const turns = points.map((point, index) => cross(point, points[(index + 1) % 4], points[(index + 2) % 4]));
    return turns.every(value => value > 1) || turns.every(value => value < -1);
}

export function outputSize(points, mode = 'free') {
    if (mode === 'card') return {...CARD_SIZE};
    const width = Math.max(distance(points[0], points[1]), distance(points[3], points[2]));
    const height = Math.max(distance(points[0], points[3]), distance(points[1], points[2]));
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

function solveLinear(matrix, values) {
    const size = values.length, rows = matrix.map((row, index) => [...row, values[index]]);
    for (let column = 0; column < size; column++) {
        let pivot = column;
        for (let row = column + 1; row < size; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
        if (Math.abs(rows[pivot][column]) < 1e-10) throw new Error('INVALID_PERSPECTIVE');
        [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
        const divisor = rows[column][column];
        for (let item = column; item <= size; item++) rows[column][item] /= divisor;
        for (let row = 0; row < size; row++) if (row !== column) {
            const factor = rows[row][column];
            for (let item = column; item <= size; item++) rows[row][item] -= factor * rows[column][item];
        }
    }
    return rows.map(row => row[size]);
}

export function perspectiveTransform(from, to) {
    if (from.length !== 4 || to.length !== 4) throw new Error('INVALID_PERSPECTIVE');
    const matrix = [], values = [];
    for (let index = 0; index < 4; index++) {
        const {x, y} = from[index], target = to[index];
        matrix.push([x, y, 1, 0, 0, 0, -target.x * x, -target.x * y]); values.push(target.x);
        matrix.push([0, 0, 0, x, y, 1, -target.y * x, -target.y * y]); values.push(target.y);
    }
    return [...solveLinear(matrix, values), 1];
}

export function transformPoint(transform, point) {
    const divisor = transform[6] * point.x + transform[7] * point.y + transform[8];
    return {x: (transform[0] * point.x + transform[1] * point.y + transform[2]) / divisor,
        y: (transform[3] * point.x + transform[4] * point.y + transform[5]) / divisor};
}

function perspectiveCanvas(source, points, mode) {
    if (!isValidQuadrilateral(points)) throw new Error('INVALID_SELECTION');
    const size = outputSize(points, mode), canvas = document.createElement('canvas');
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    const sourceData = source.getContext('2d', {willReadFrequently: true}).getImageData(0, 0, source.width, source.height);
    const output = context.createImageData(size.width, size.height);
    const destination = [{x: 0, y: 0}, {x: size.width - 1, y: 0}, {x: size.width - 1, y: size.height - 1}, {x: 0, y: size.height - 1}];
    const transform = perspectiveTransform(destination, points);
    for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
        const point = transformPoint(transform, {x, y});
        const sx = Math.max(0, Math.min(source.width - 1, Math.round(point.x)));
        const sy = Math.max(0, Math.min(source.height - 1, Math.round(point.y)));
        const input = (sy * source.width + sx) * 4, target = (y * size.width + x) * 4;
        output.data[target] = sourceData.data[input]; output.data[target + 1] = sourceData.data[input + 1];
        output.data[target + 2] = sourceData.data[input + 2]; output.data[target + 3] = sourceData.data[input + 3];
    }
    context.putImageData(output, 0, 0); return canvas;
}

export function canEditImage(file) {return file instanceof Blob && EDITABLE_TYPES.has(file.type);}

export async function editImageBeforeUpload(file) {
    if (!canEditImage(file)) return file;
    const source = await loadImage(file);
    let working = scaledCanvas(source), selection, dragging = null, mode = 'free';
    return new Promise((resolve, reject) => {
        const overlay = document.createElement('div'); overlay.className = 'image-editor-overlay';
        const dialog = document.createElement('section'); dialog.className = 'image-editor-dialog'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        const title = document.createElement('h2'); title.textContent = 'Prepara immagine';
        const help = document.createElement('p'); help.className = 'image-editor-help';
        const modes = document.createElement('div'); modes.className = 'image-editor-modes'; modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Formato immagine');
        const freeMode = button('Foto libera', () => setMode('free')), cardMode = button('Tessera / carta', () => setMode('card'));
        const preview = document.createElement('canvas'); preview.className = 'image-editor-preview'; preview.setAttribute('aria-label', 'Anteprima con quattro angoli di ritaglio');
        const warning = document.createElement('p'); warning.className = 'image-editor-warning'; warning.setAttribute('aria-live', 'polite');
        const controls = document.createElement('div'); controls.className = 'image-editor-controls';
        const save = button('Salva immagine', saveImage, true);
        const close = value => {overlay.remove(); document.body.classList.remove('image-editor-open'); resolve(value);};
        function resetSelection() {
            const inset = Math.max(12, Math.round(Math.min(working.width, working.height) * .05));
            selection = [{x: inset, y: inset}, {x: working.width - inset, y: inset}, {x: working.width - inset, y: working.height - inset}, {x: inset, y: working.height - inset}];
        }
        function setMode(nextMode) {
            mode = nextMode; freeMode.classList.toggle('image-editor-mode-active', mode === 'free'); cardMode.classList.toggle('image-editor-mode-active', mode === 'card');
            help.textContent = mode === 'card' ? 'Allinea i quattro angoli della tessera: il risultato sarà raddrizzato nel formato standard ID-1.' : 'Sposta liberamente i quattro angoli. La prospettiva verrà raddrizzata al salvataggio.'; paint();
        }
        function paint() {
            preview.width = working.width; preview.height = working.height;
            const context = preview.getContext('2d'); context.drawImage(working, 0, 0); context.save();
            context.fillStyle = 'rgb(0 0 0 / 52%)'; context.fillRect(0, 0, preview.width, preview.height);
            context.beginPath(); context.moveTo(selection[0].x, selection[0].y); selection.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.closePath(); context.clip(); context.drawImage(working, 0, 0); context.restore();
            context.beginPath(); context.moveTo(selection[0].x, selection[0].y); selection.slice(1).forEach(point => context.lineTo(point.x, point.y)); context.closePath(); context.strokeStyle = '#4da3ff'; context.lineWidth = Math.max(3, preview.width / 450); context.stroke();
            for (const point of selection) {context.beginPath(); context.fillStyle = '#fff'; context.arc(point.x, point.y, Math.max(10, preview.width / 70), 0, Math.PI * 2); context.fill();}
            const valid = isValidQuadrilateral(selection); warning.textContent = valid ? '' : 'Gli angoli non possono incrociarsi o sovrapporsi.'; save.disabled = !valid;
        }
        const eventPoint = event => {const box = preview.getBoundingClientRect(); return {x: Math.max(0, Math.min(preview.width, (event.clientX - box.left) * preview.width / box.width)), y: Math.max(0, Math.min(preview.height, (event.clientY - box.top) * preview.height / box.height))};};
        preview.addEventListener('pointerdown', event => {const at = eventPoint(event), radius = Math.max(30, preview.width / 18); const index = selection.findIndex(point => Math.hypot(point.x - at.x, point.y - at.y) <= radius); if (index < 0) return; event.preventDefault(); dragging = index; preview.setPointerCapture(event.pointerId);});
        preview.addEventListener('pointermove', event => {if (dragging === null) return; event.preventDefault(); selection[dragging] = eventPoint(event); paint();});
        const stop = () => {dragging = null;}; preview.addEventListener('pointerup', stop); preview.addEventListener('pointercancel', stop);
        function rotate() {const canvas = document.createElement('canvas'); canvas.width = working.height; canvas.height = working.width; const context = canvas.getContext('2d'); context.translate(canvas.width, 0); context.rotate(Math.PI / 2); context.drawImage(working, 0, 0); working = canvas; resetSelection(); paint();}
        async function saveImage() {try {save.disabled = true; close(await canvasFile(perspectiveCanvas(working, selection, mode), file));} catch (error) {save.disabled = false; warning.textContent = 'Impossibile elaborare questa selezione. Controlla i quattro angoli.'; if (error.message !== 'INVALID_SELECTION') {overlay.remove(); document.body.classList.remove('image-editor-open'); reject(error);}}}
        modes.append(freeMode, cardMode); controls.append(button('Annulla', () => close(null)), button('Ruota 90°', rotate), save);
        dialog.append(title, help, modes, preview, warning, controls); overlay.append(dialog); document.body.append(overlay);
        document.body.classList.add('image-editor-open'); resetSelection(); setMode('free');
    });
}
