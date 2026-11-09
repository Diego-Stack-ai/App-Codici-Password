// Piccoli aiuti condivisi dalle prove: creazione sicura del DOM (solo textContent) e avvisi brevi.
export function el(tag, attributi = {}, figli = []) {
    const nodo = document.createElement(tag);
    for (const [chiave, valore] of Object.entries(attributi)) {
        if (valore === false || valore == null) continue;
        if (chiave === 'testo') nodo.textContent = valore;
        else if (chiave === 'classe') nodo.className = valore;
        else if (chiave.startsWith('on')) nodo.addEventListener(chiave.slice(2), valore);
        else nodo.setAttribute(chiave, valore === true ? '' : valore);
    }
    for (const figlio of [].concat(figli)) if (figlio) nodo.append(figlio);
    return nodo;
}

export const icona = (nome, classe = '') => el('span', {classe: `icona ${classe}`.trim(), 'aria-hidden': 'true', testo: nome});

let timerAvviso;
export function avviso(testo) {
    const box = document.getElementById('avviso');
    box.textContent = testo;
    box.classList.add('visibile');
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => box.classList.remove('visibile'), 2000);
}

export async function copia(valore, etichetta) {
    try { await navigator.clipboard.writeText(valore); } catch { /* In anteprima la copia può essere negata. */ }
    avviso(`${etichetta} copiato`);
}

const TEMI = ['auto', 'chiaro', 'scuro'];
const ICONA_TEMA = {auto: 'brightness_auto', chiaro: 'light_mode', scuro: 'dark_mode'};
const NOME_TEMA = {auto: 'automatico', chiaro: 'chiaro', scuro: 'scuro'};
function leggiTema() {
    try { const tema = localStorage.getItem('ui-prove-tema'); return TEMI.includes(tema) ? tema : 'auto'; } catch { return 'auto'; }
}
function applicaTema(tema) {
    const scuro = tema === 'scuro' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.tema = scuro ? 'scuro' : 'chiaro';
    for (const bottone of document.querySelectorAll('[data-azione="tema"]')) {
        bottone.querySelector('.icona').textContent = ICONA_TEMA[tema];
        bottone.setAttribute('aria-label', `Tema ${NOME_TEMA[tema]}: tocca per cambiare`);
    }
}
export function attivaTema() {
    applicaTema(leggiTema());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applicaTema(leggiTema()));
    for (const bottone of document.querySelectorAll('[data-azione="tema"]')) bottone.addEventListener('click', () => {
        const prossimo = TEMI[(TEMI.indexOf(leggiTema()) + 1) % TEMI.length];
        try { localStorage.setItem('ui-prove-tema', prossimo); } catch { /* Solo comodità locale. */ }
        applicaTema(prossimo);
        avviso(`Tema ${NOME_TEMA[prossimo]}`);
    });
}
