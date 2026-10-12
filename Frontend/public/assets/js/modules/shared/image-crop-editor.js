const EDITABLE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_SIDE = 4096;
const CARD_SIZE = {width: 1012, height: 638};
const MIN_EDGE = 24;
const CARD_RATIO = CARD_SIZE.width / CARD_SIZE.height;
const STYLE_ID = 'image-crop-editor-styles';

function ensureEditorStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID; link.rel = 'stylesheet';
    link.href = new URL('../../../css/image-crop-editor.css', import.meta.url).href;
    document.head.append(link);
}

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
    const width = Math.max(distance(points[0], points[1]), distance(points[3], points[2]));
    const height = Math.max(distance(points[0], points[3]), distance(points[1], points[2]));
    if (mode === 'card') {
        const longEdge = Math.min(MAX_SIDE, Math.max(width, height * CARD_RATIO));
        return {width: Math.max(1, Math.round(longEdge)), height: Math.max(1, Math.round(longEdge / CARD_RATIO))};
    }
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

export function cardFrame(width, height, margin = .08) {
    const availableWidth = width * (1 - margin * 2), availableHeight = height * (1 - margin * 2);
    const frameWidth = Math.min(availableWidth, availableHeight * CARD_RATIO);
    const frameHeight = frameWidth / CARD_RATIO;
    const left = (width - frameWidth) / 2, top = (height - frameHeight) / 2;
    return [{x: left, y: top}, {x: left + frameWidth, y: top},
        {x: left + frameWidth, y: top + frameHeight}, {x: left, y: top + frameHeight}];
}

export function detectCardBoundaryFromImageData(data, width, height) {
    if (!data || width < 40 || height < 40) return null;
    const sample = Math.max(2, Math.round(Math.min(width, height) * .025));
    const corners = [[0, 0], [width - sample, 0], [0, height - sample], [width - sample, height - sample]];
    let red = 0, green = 0, blue = 0, redSq = 0, greenSq = 0, blueSq = 0, count = 0;
    for (const [startX, startY] of corners) for (let y = startY; y < Math.min(height, startY + sample); y++) {
        for (let x = startX; x < Math.min(width, startX + sample); x++) {
            const offset = (y * width + x) * 4;
            const r = data[offset], g = data[offset + 1], b = data[offset + 2];
            red += r; green += g; blue += b; redSq += r * r; greenSq += g * g; blueSq += b * b; count++;
        }
    }
    red /= count; green /= count; blue /= count;
    const backgroundNoise = Math.sqrt(Math.max(0, redSq / count - red * red) + Math.max(0, greenSq / count - green * green) + Math.max(0, blueSq / count - blue * blue));
    const contrastThreshold = Math.max(26, Math.min(82, 30 + backgroundNoise * 1.35));
    const stride = Math.max(1, Math.floor(Math.max(width, height) / 700));
    const columns = Math.ceil((width - sample * 2) / stride);
    const rows = Math.ceil((height - sample * 2) / stride);
    const mask = new Uint8Array(columns * rows);
    let foreground = 0;
    for (let row = 0, y = sample; row < rows; row++, y += stride) for (let column = 0, x = sample; column < columns; column++, x += stride) {
        const offset = (y * width + x) * 4;
        const delta = Math.hypot(data[offset] - red, data[offset + 1] - green, data[offset + 2] - blue);
        if (delta < contrastThreshold) continue;
        mask[row * columns + column] = 1; foreground++;
    }
    const sampled = columns * rows;
    if (foreground < sampled * .06 || foreground > sampled * .88) return null;
    let largest = [];
    for (let start = 0; start < mask.length; start++) {
        if (mask[start] !== 1) continue;
        const component = [], queue = [start]; mask[start] = 2;
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const index = queue[cursor], row = Math.floor(index / columns), column = index % columns;
            component.push({x: sample + column * stride, y: sample + row * stride});
            for (const neighbor of [index - 1, index + 1, index - columns, index + columns]) {
                if (neighbor < 0 || neighbor >= mask.length || mask[neighbor] !== 1) continue;
                const neighborRow = Math.floor(neighbor / columns), neighborColumn = neighbor % columns;
                if (Math.abs(neighborRow - row) + Math.abs(neighborColumn - column) !== 1) continue;
                mask[neighbor] = 2; queue.push(neighbor);
            }
        }
        if (component.length > largest.length) largest = component;
    }
    if (largest.length < sampled * .05 || largest.length < foreground * .45) return null;
    let topLeft = null, topRight = null, bottomRight = null, bottomLeft = null;
    for (const point of largest) {
        const {x, y} = point, sum = x + y, difference = x - y;
        if (!topLeft || sum < topLeft.score) topLeft = {...point, score: sum};
        if (!bottomRight || sum > bottomRight.score) bottomRight = {...point, score: sum};
        if (!topRight || difference > topRight.score) topRight = {...point, score: difference};
        if (!bottomLeft || difference < bottomLeft.score) bottomLeft = {...point, score: difference};
    }
    const points = [topLeft, topRight, bottomRight, bottomLeft].map(({x, y}) => ({x, y}));
    if (!isValidQuadrilateral(points)) return null;
    const area = Math.abs(points.reduce((total, point, index) => {
        const next = points[(index + 1) % points.length]; return total + point.x * next.y - next.x * point.y;
    }, 0) / 2);
    return area >= width * height * .12 ? points : null;
}

export function detectCardBoundary(canvas) {
    const context = canvas.getContext('2d', {willReadFrequently: true});
    return detectCardBoundaryFromImageData(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
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

export async function editImageBeforeUpload(file, {initialMode = 'free'} = {}) {
    ensureEditorStyles();
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
        const stage = document.createElement('div'); stage.className = 'image-editor-stage';
        const preview = document.createElement('canvas'); preview.className = 'image-editor-preview'; preview.setAttribute('aria-label', 'Anteprima con quattro angoli di ritaglio');
        const magnifier = document.createElement('canvas'); magnifier.className = 'image-editor-magnifier'; magnifier.width = 240; magnifier.height = 240; magnifier.setAttribute('aria-hidden', 'true');
        const warning = document.createElement('p'); warning.className = 'image-editor-warning'; warning.setAttribute('aria-live', 'polite');
        const controls = document.createElement('div'); controls.className = 'image-editor-controls';
        const save = button('Salva ritaglio', saveImage, true);
        const keepOriginal = button('Allega originale', () => close(file));
        const close = value => {overlay.remove(); document.body.classList.remove('image-editor-open'); resolve(value);};
        function resetSelection() {
            const inset = Math.max(12, Math.round(Math.min(working.width, working.height) * .05));
            selection = [{x: inset, y: inset}, {x: working.width - inset, y: inset}, {x: working.width - inset, y: working.height - inset}, {x: inset, y: working.height - inset}];
        }
        function setMode(nextMode) {
            mode = nextMode; freeMode.classList.toggle('image-editor-mode-active', mode === 'free'); cardMode.classList.toggle('image-editor-mode-active', mode === 'card');
            const detected = mode === 'card' ? detectCardBoundary(working) : null;
            if (mode === 'card') selection = detected || cardFrame(working.width, working.height);
            help.textContent = mode === 'card' ? 'I bordi della tessera vengono cercati automaticamente. Correggi gli angoli se necessario: il risultato sarà ID-1.' : 'Sposta liberamente i quattro angoli. La prospettiva verrà raddrizzata al salvataggio.'; paint();
            if (mode === 'card') warning.textContent = detected
                ? 'Bordi rilevati automaticamente. Controlla i quattro angoli.'
                : 'Bordi non riconosciuti: usa il riquadro ID-1 e correggi gli angoli.';
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
        function showMagnifier(point, event) {
            magnifier.classList.add('image-editor-magnifier-visible');
            magnifier.classList.toggle('image-editor-magnifier-left', event.clientX > window.innerWidth / 2);
            const context = magnifier.getContext('2d'), sourceSize = Math.max(50, Math.min(working.width, working.height) / 5);
            context.clearRect(0, 0, magnifier.width, magnifier.height);
            context.drawImage(working, point.x - sourceSize / 2, point.y - sourceSize / 2, sourceSize, sourceSize, 0, 0, magnifier.width, magnifier.height);
            context.strokeStyle = '#4da3ff'; context.lineWidth = 4;
            context.beginPath(); context.moveTo(120, 72); context.lineTo(120, 168); context.moveTo(72, 120); context.lineTo(168, 120); context.stroke();
            context.beginPath(); context.arc(120, 120, 14, 0, Math.PI * 2); context.stroke();
        }
        preview.addEventListener('pointerdown', event => {const at = eventPoint(event), radius = Math.max(30, preview.width / 18); const index = selection.findIndex(point => Math.hypot(point.x - at.x, point.y - at.y) <= radius); if (index < 0) return; event.preventDefault(); dragging = index; preview.setPointerCapture(event.pointerId); showMagnifier(selection[index], event);});
        preview.addEventListener('pointermove', event => {if (dragging === null) return; event.preventDefault(); selection[dragging] = eventPoint(event); paint(); showMagnifier(selection[dragging], event);});
        const stop = () => {dragging = null; magnifier.classList.remove('image-editor-magnifier-visible');}; preview.addEventListener('pointerup', stop); preview.addEventListener('pointercancel', stop);
        function rotate() {const canvas = document.createElement('canvas'); canvas.width = working.height; canvas.height = working.width; const context = canvas.getContext('2d'); context.translate(canvas.width, 0); context.rotate(Math.PI / 2); context.drawImage(working, 0, 0); working = canvas; resetSelection(); paint();}
        async function saveImage() {try {save.disabled = true; close(await canvasFile(perspectiveCanvas(working, selection, mode), file));} catch (error) {save.disabled = false; warning.textContent = 'Impossibile elaborare questa selezione. Controlla i quattro angoli.'; if (error.message !== 'INVALID_SELECTION') {overlay.remove(); document.body.classList.remove('image-editor-open'); reject(error);}}}
        modes.append(freeMode, cardMode); controls.append(button('Annulla', () => close(null)), keepOriginal, button('Ruota 90°', rotate), save);
        stage.append(preview, magnifier); dialog.append(title, help, modes, stage, warning, controls); overlay.append(dialog); document.body.append(overlay);
        document.body.classList.add('image-editor-open'); resetSelection(); setMode(initialMode === 'card' ? 'card' : 'free');
    });
}
