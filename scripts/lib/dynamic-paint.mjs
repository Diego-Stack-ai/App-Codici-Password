// Same reviewed compositing algorithm as visual-map; no app scripts or IO at import.
export function collectDynamicPaint({paint,theme,graphics} = {}) {
  const parse = value => {
    if (!value || value === 'transparent') return null;
    if (!/^(rgba?\(|color\(srgb\s)/.test(value)) return null;
    const n = value.match(/-?\d*\.?\d+(e-?\d+)?/g)?.map(Number);
    if (!n || n.length < 3) return null;
    const srgb = value.startsWith('color(');
    const rgb = (srgb ? n.slice(0, 3).map(v => v * 255) : n.slice(0, 3)).map(v => Math.round(v));
    const alpha = srgb ? (value.includes('/') ? n[3] : 1) : (n.length > 3 ? n[3] : 1);
    return {rgb, alpha};
  };
  const firstStop = image => { const m = image && image !== 'none' && image.match(/(rgba?|color)\([^)]*\)/); return m ? parse(m[0]) : null; };
  const over = (top, bottom) => top.rgb.map((v, i) => v * top.alpha + bottom[i] * (1 - top.alpha));
  // Compositing come il browser (sorgente-sopra), dalla radice al testo: ogni antenato
  // dipinge il proprio sfondo sopra ciò che ha dietro, poi il suo gruppo (sfondo + figli)
  // si mescola al retro con la sua opacità: o·contenuto + (1−o)·retro. Così un contenitore
  // semitrasparente con superficie propria attenua sia lo sfondo sia il testo (rilievo
  // Codex 14/11: nero a opacità 0,52 sul bianco → sfondo 122,4, testo bianco 4,27:1).
  // Colore di una sfumatura lineare nel punto del testo (non più il solo primo colore):
  // angolo CSS, lunghezza della linea |W·sinθ|+|H·cosθ|, tappe con o senza percentuale.
  // Radiali e immagini non sono misurate (decorative): il calcolo usa il colore di fondo.
  const splitTop = text => { const out = []; let depth = 0, start = 0;
    for (let i = 0; i < text.length; i++) { const c = text[i]; if (c === '(') depth++; else if (c === ')') depth--;
      else if (c === ',' && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; } }
    out.push(text.slice(start).trim()); return out; };
  // Restituisce null (nessuna sfumatura), {unmeasured:true} per sintassi non supportate
  // (mai un PASS approssimato) oppure il colore nel punto, come da specifica CSS:
  // - posizioni mancanti distribuite fra le tappe esplicite vicine, posizioni monotone;
  // - direzioni verso un angolo calcolate sulla geometria del box («magic corners»);
  // - interpolazione in spazio premoltiplicato per l'alpha.
  const gradientAt = (image, box, point) => {
    if (!image || image === 'none') return null;
    const m = image.match(/^linear-gradient\((.*)\)$/);
    if (!m) return {unmeasured: true}; // radiali, coniche, ripetute, immagini url()
    const parts = splitTop(m[1]);
    const W = box.width, H = box.height;
    let angle = 180;
    const sides = {'to top': 0, 'to right': 90, 'to bottom': 180, 'to left': 270};
    const corner = parts[0].match(/^to (top|bottom) (left|right)$|^to (left|right) (top|bottom)$/);
    if (/^-?[\d.]+(deg|turn|rad|grad)$/.test(parts[0])) {
      const v = parseFloat(parts[0]), u = parts[0].replace(/^-?[\d.]+/, '');
      angle = u === 'turn' ? v * 360 : u === 'rad' ? v * 180 / Math.PI : u === 'grad' ? v * 0.9 : v; parts.shift();
    } else if (sides[parts[0]] !== undefined) angle = sides[parts.shift()];
    else if (corner) {
      const vertical = corner[1] || corner[4], horizontal = corner[2] || corner[3];
      const sx = horizontal === 'right' ? 1 : -1, sy = vertical === 'bottom' ? 1 : -1;
      // Linea perpendicolare alla diagonale fra i due angoli adiacenti: vettore (sx·H, sy·W).
      angle = Math.atan2(sx * H, -sy * W) * 180 / Math.PI; parts.shift();
    } else if (/^to\b/.test(parts[0])) return {unmeasured: true};
    const stops = [];
    for (const part of parts) {
      const color = part.match(/^((?:rgba?|color)\([^)]*\))(?:\s+(-?[\d.]+)%)?$/);
      if (!color) return {unmeasured: true}; // lunghezze, doppie posizioni, suggerimenti, calc()
      const c = parse(color[1]);
      if (!c) return {unmeasured: true};
      stops.push({color: c, pos: color[2] === undefined ? null : parseFloat(color[2]) / 100});
    }
    if (stops.length < 2) return stops[0]?.color || null;
    if (stops[0].pos === null) stops[0].pos = 0;
    if (stops[stops.length - 1].pos === null) stops[stops.length - 1].pos = 1;
    // Posizioni esplicite monotone rispetto al massimo esplicito precedente, anche attraverso le tappe implicite.
    let maxPos = stops[0].pos;
    for (let i = 1; i < stops.length; i++) if (stops[i].pos !== null) maxPos = stops[i].pos = Math.max(stops[i].pos, maxPos);
    for (let i = 1; i < stops.length - 1; i++) if (stops[i].pos === null) {
      let j = i; while (stops[j].pos === null) j++;
      const from = stops[i - 1].pos, to = stops[j].pos, n = j - i + 1;
      for (let k = i; k < j; k++) stops[k].pos = from + (to - from) * (k - i + 1) / n;
    }
    const rad = angle * Math.PI / 180, length = Math.abs(W * Math.sin(rad)) + Math.abs(H * Math.cos(rad)) || 1;
    const dx = point.x - (box.left + W / 2), dy = point.y - (box.top + H / 2);
    const t = (dx * Math.sin(rad) - dy * Math.cos(rad)) / length + 0.5;
    if (t <= stops[0].pos) return stops[0].color;
    if (t >= stops[stops.length - 1].pos) return stops[stops.length - 1].color;
    let k = 0; while (k < stops.length - 2 && t > stops[k + 1].pos) k++;
    const [a, b] = [stops[k], stops[k + 1]], f = b.pos > a.pos ? (t - a.pos) / (b.pos - a.pos) : 1;
    const alpha = a.color.alpha + (b.color.alpha - a.color.alpha) * f;
    if (alpha <= 0) return {rgb: [0, 0, 0], alpha: 0};
    const rgb = a.color.rgb.map((v, c) => (v * a.color.alpha + (b.color.rgb[c] * b.color.alpha - v * a.color.alpha) * f) / alpha);
    return {rgb, alpha};
  };
  // null = non misurato: almeno uno strato dietro il testo ha una pittura non supportata.
  const composite = (element, ink) => {
    let unmeasured = false;
    const chain = [];
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) chain.unshift(node);
    const r = element.getBoundingClientRect(), point = {x: r.left + r.width / 2, y: r.top + r.height / 2};
    const paint = (i, backdrop) => {
      const node = chain[i], style = getComputedStyle(node);
      const root = node === document.documentElement || node === document.body;
      const box = root ? {left: 0, top: 0, width: Math.max(innerWidth, node.scrollWidth), height: Math.max(innerHeight, node.scrollHeight)} : node.getBoundingClientRect();
      let inner = backdrop;
      const color = parse(style.backgroundColor);
      if (!color && style.backgroundColor && style.backgroundColor !== 'transparent') unmeasured = true;
      if (color && color.alpha > 0) inner = over(color, inner);
      // Più strati: si dipingono dal fondo (ultimo) al primo, come il browser.
      const layers = style.backgroundImage && style.backgroundImage !== 'none' ? splitTop(style.backgroundImage).reverse() : [];
      for (const layer of layers) {
        const image = gradientAt(layer, box, point);
        if (image?.unmeasured) unmeasured = true;
        else if (image && image.alpha > 0) inner = over(image, inner);
      }
      inner = i === chain.length - 1 ? (ink ? over(ink, inner) : inner) : paint(i + 1, inner);
      const o = Number(style.opacity);
      return inner.map((v, c) => v * o + backdrop[c] * (1 - o));
    };
    const result = paint(0, [255, 255, 255]).map(v => Math.round(v * 10) / 10);
    return unmeasured ? null : result;
  };
  const probe = document.createElement('span');
  document.body.append(probe);
  const scale = ['micro', 'xs', 'sm', 'base', 'md', 'lg', 'xl'].map(name => {
    probe.style.fontSize = `var(--fs-${name})`; return Math.round(parseFloat(getComputedStyle(probe).fontSize) * 10) / 10;
  }).filter(Number.isFinite);
  probe.remove();
  const label = element => {
    const cls = typeof element.className === 'string' ? element.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
    return element.tagName.toLowerCase() + (element.id ? `#${element.id}` : '') + (cls ? `.${cls}` : '');
  };
  const records = [];
  // Read roles and composites within one browser task: indices cannot drift across awaits.
  const values = paint ? (() => {
    const nodes=[...document.querySelectorAll(paint.selector)];
    return nodes.map(element=>{
      const style=getComputedStyle(element,paint.pseudo||null);
      const rect=element.getBoundingClientRect();
      let visible=!!rect.width&&!!rect.height;
      for(let node=element;node;node=node.parentElement){const s=getComputedStyle(node);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0)visible=false;}
      const role=graphics==='tre-livelli'&&paint.newRole?paint.newRole:theme==='dark'&&paint.darkRole?paint.darkRole:paint.role;
      const roleNames=role.startsWith('--')?[role]:[...role.matchAll(/var\(\s*(--[\w-]+)/g)].map(match=>match[1]);
      const roleDeclarations=Object.fromEntries(roleNames.map(name=>[name,style.getPropertyValue(name).trim()]));
      const roleResolved=Object.values(roleDeclarations).every(value=>value.length>0);
      let expected=role;
      if(!['content','transform'].includes(paint.property)) {
        const probe=document.createElement('span');
        probe.style[paint.property]=role.startsWith('--')?`var(${role})`:role;
        // Inputs are void elements: an appended child has no computed style.
        (element.matches('input,img,canvas')?element.parentElement:element).append(probe);
        expected=getComputedStyle(probe)[paint.property];probe.remove();
      }
      const own=[...document.body.querySelectorAll('*')].indexOf(element);
      const actual=style[paint.property];
      const extra={fontSize:style.fontSize,fontWeight:style.fontWeight,opacity:style.opacity,
        backgroundColor:style.backgroundColor,color:style.color,backgroundImage:style.backgroundImage,
        boxShadow:style.boxShadow,filter:style.filter,outline:style.outline,
        pseudoBefore:{content:getComputedStyle(element,'::before').content,backgroundColor:getComputedStyle(element,'::before').backgroundColor,transform:getComputedStyle(element,'::before').transform},
        checked:element instanceof HTMLInputElement?element.checked:undefined,disabled:element.disabled===true};
      if (paint.withinSelector) extra.matchesWithin = Boolean(element.closest(paint.withinSelector));
      if (paint.captureAncestry) {
        extra.ancestry = [];
        for (let node = element; node && extra.ancestry.length < 5; node = node.parentElement) {
          const computed = getComputedStyle(node);
          extra.ancestry.push({tag:node.tagName,class:node.className,color:computed.color,bg:computed.backgroundColor,image:computed.backgroundImage,opacity:computed.opacity});
        }
      }
      if(paint.kind==='headerContrast') {
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
        const rgba=css=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=css;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
        const bg=rgba(getComputedStyle(element.closest('#header-placeholder')).backgroundColor),fg=rgba(style.color);
        const over=(c,b)=>b.map((v,i)=>c[i]*(c[3]/255)+v*(1-c[3]/255));
        extra.headerExtremes=[0,255].map(value=>{const backdrop=over(bg,[value,value,value]);return {bg:backdrop,fg:over(fg,backdrop)};});
      }
      return {own,actual,expected,visible,roleDeclarations,roleResolved,...extra};
    });

  })() : undefined;
  if (paint && !paint.minimum && paint.kind !== 'headerContrast') return {records,values,scale,title:document.title};
  let index = 0;
  for (const element of document.body.querySelectorAll('*')) {
    const own = index++;
    if (['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'BR'].includes(element.tagName)) continue;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    // Opacità effettiva = prodotto delle opacità dell'elemento e degli antenati (rilievo Codex 14/11).
    let groupOpacity = 1;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) groupOpacity *= Number(getComputedStyle(node).opacity);
    if (!rect.width || !rect.height || style.visibility !== 'visible' || style.display === 'none' || groupOpacity === 0) continue;
    // Testo solo per lettori di schermo (sr-only, ritagliato a 1 px): non è visibile.
    if ((rect.width <= 1 && rect.height <= 1) || /rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)|inset\(50%\)/.test(style.clip + ' ' + style.clipPath)) continue;
    // The closed native select renders its selected option inside the control.
    // The operating-system options popup is outside this DOM paint measurement.
    const text = [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim()) ||
      (element.tagName === 'SELECT' && [...element.selectedOptions].some(option => option.textContent.trim()));
    const bg = firstStop(style.backgroundImage) || parse(style.backgroundColor);
    const border = parseFloat(style.borderTopWidth) > 0 ? parse(style.borderTopColor) : null;
    if (!text && !(bg && bg.alpha > 0.05) && !(border && border.alpha > 0.05)) continue;
    records.push({index: own, label: label(element), text,
      color: text ? parse(style.color)?.rgb : null, colorAlpha: text ? (parse(style.color)?.alpha ?? 1) : 1, bg: bg && bg.alpha > 0.05 ? bg.rgb : null,
      border: border && border.alpha > 0.05 ? border.rgb : null,
      // Colori effettivi nel punto del testo: sfondo senza testo e testo sopra, entrambi composti.
      effectiveBg: text ? composite(element, null) : null, effectiveFg: text && parse(style.color) ? composite(element, parse(style.color)) : null,
      opacity: groupOpacity, fontSize: Math.round(parseFloat(style.fontSize) * 10) / 10,
      fontWeight: Number(style.fontWeight), fontFamily: style.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      icon: /material-symbols/.test(element.className || '')});
  }
  return {records, values, scale, title: document.title};
}
