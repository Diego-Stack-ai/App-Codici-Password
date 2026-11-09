// Logica comune alle tre prove grafiche. Cambia soltanto il foglio di stile.
// Tutto resta in memoria: ricaricando la pagina tornano i dati inventati iniziali.
import {ACCOUNT, CATEGORIE} from './dati.js';

const account = ACCOUNT.map(voce => ({...voce}));
const stato = {filtro: 'Tutti', ricerca: '', apertoId: null, modifica: false, passwordVisibile: false};
const TEMI = ['auto', 'chiaro', 'scuro'];
const ICONA_TEMA = {auto: 'brightness_auto', chiaro: 'light_mode', scuro: 'dark_mode'};
const NOME_TEMA = {auto: 'automatico', chiaro: 'chiaro', scuro: 'scuro'};

function el(tag, attributi = {}, figli = []) {
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
const icona = (nome, classe = '') => el('span', {classe: `icona ${classe}`.trim(), 'aria-hidden': 'true', testo: nome});
const iniziali = nome => nome.split(/\s+/).slice(0, 2).map(parola => parola[0]).join('').toUpperCase();
const $ = selettore => document.querySelector(selettore);

/* ---------- Tema chiaro / scuro ---------- */
function leggiTema() {
    try { return TEMI.includes(localStorage.getItem('ui-prove-tema')) ? localStorage.getItem('ui-prove-tema') : 'auto'; } catch { return 'auto'; }
}
function applicaTema(tema) {
    const scuro = tema === 'scuro' || (tema === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.tema = scuro ? 'scuro' : 'chiaro';
    for (const bottone of document.querySelectorAll('[data-azione="tema"]')) {
        bottone.querySelector('.icona').textContent = ICONA_TEMA[tema];
        bottone.setAttribute('aria-label', `Tema ${NOME_TEMA[tema]}: tocca per cambiare`);
    }
}
function cambiaTema() {
    const prossimo = TEMI[(TEMI.indexOf(leggiTema()) + 1) % TEMI.length];
    try { localStorage.setItem('ui-prove-tema', prossimo); } catch { /* Solo comodità locale. */ }
    applicaTema(prossimo);
    avviso(`Tema ${NOME_TEMA[prossimo]}`);
}

/* ---------- Avviso breve ---------- */
let timerAvviso;
function avviso(testo) {
    const box = $('#avviso');
    box.textContent = testo;
    box.classList.add('visibile');
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => box.classList.remove('visibile'), 1800);
}
async function copia(valore, etichetta) {
    try { await navigator.clipboard.writeText(valore); } catch { /* In anteprima la copia può essere negata. */ }
    avviso(`${etichetta} copiato`);
}

/* ---------- Elenco ---------- */
function filtrati() {
    const testo = stato.ricerca.trim().toLowerCase();
    return account
        .filter(voce => stato.filtro === 'Tutti' || voce.categoria === stato.filtro)
        .filter(voce => !testo || `${voce.nome} ${voce.utente} ${voce.categoria}`.toLowerCase().includes(testo))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

function avatar(voce, grande = false) {
    return el('span', {classe: `avatar avatar-${voce.colore}${grande ? ' avatar-grande' : ''}`, 'aria-hidden': 'true', testo: iniziali(voce.nome)});
}

function disegnaFiltri() {
    const box = $('#filtri');
    box.replaceChildren(...CATEGORIE.map(categoria => el('button', {
        type: 'button', classe: 'filtro', 'aria-pressed': String(stato.filtro === categoria), testo: categoria,
        onclick: () => { stato.filtro = categoria; disegnaFiltri(); disegnaElenco(); }
    })));
}

function disegnaElenco() {
    const voci = filtrati();
    $('#conteggio').textContent = `${voci.length} account`;
    const gruppi = new Map();
    for (const voce of voci) {
        const lettera = voce.nome[0].toUpperCase();
        if (!gruppi.has(lettera)) gruppi.set(lettera, []);
        gruppi.get(lettera).push(voce);
    }
    const contenuto = [...gruppi].map(([lettera, elementi]) => el('section', {classe: 'gruppo', 'aria-label': `Lettera ${lettera}`}, [
        el('h2', {classe: 'gruppo-titolo', testo: lettera}),
        el('ul', {classe: 'lista'}, elementi.map(voce => el('li', {}, el('button', {
            type: 'button', classe: 'riga', onclick: () => apriDettaglio(voce.id)
        }, [
            avatar(voce),
            el('span', {classe: 'riga-testo'}, [
                el('span', {classe: 'riga-titolo', testo: voce.nome}),
                el('span', {classe: 'riga-sottotitolo', testo: voce.utente})
            ]),
            voce.condiviso ? el('span', {classe: 'etichetta', title: 'Condiviso'}, [icona('group'), el('span', {classe: 'etichetta-testo', testo: 'Condiviso'})]) : null,
            icona('chevron_right', 'riga-freccia')
        ]))))
    ]));
    if (!contenuto.length) {
        contenuto.push(el('div', {classe: 'vuoto', role: 'status'}, [
            icona('search_off', 'vuoto-icona'),
            el('p', {classe: 'vuoto-titolo', testo: 'Nessun account trovato'}),
            el('p', {classe: 'vuoto-testo', testo: 'Prova un’altra parola o togli il filtro.'})
        ]));
    }
    $('#elenco').replaceChildren(...contenuto);
}

/* ---------- Dettaglio ---------- */
function campo(etichetta, chiave, voce, {segreto = false, copiabile = true, multiriga = false} = {}) {
    const valore = voce[chiave];
    if (stato.modifica) {
        const id = `campo-${chiave}`;
        const input = el(multiriga ? 'textarea' : 'input', {id, classe: 'campo-input', name: chiave, rows: multiriga ? '3' : null, autocomplete: 'off', spellcheck: 'false'});
        input.value = valore;
        return el('li', {classe: 'campo campo-modifica'}, [el('label', {classe: 'campo-etichetta', for: id, testo: etichetta}), input]);
    }
    if (!valore) return null;
    const nascosto = segreto && !stato.passwordVisibile;
    const azioni = [];
    if (segreto) azioni.push(el('button', {
        type: 'button', classe: 'btn-icona piccolo', 'aria-label': nascosto ? 'Mostra password' : 'Nascondi password',
        onclick: () => { stato.passwordVisibile = !stato.passwordVisibile; disegnaDettaglio(); }
    }, icona(nascosto ? 'visibility' : 'visibility_off')));
    if (copiabile) azioni.push(el('button', {type: 'button', classe: 'btn-icona piccolo', 'aria-label': `Copia ${etichetta.toLowerCase()}`, onclick: () => copia(valore, etichetta)}, icona('content_copy')));
    return el('li', {classe: 'campo'}, [
        el('span', {classe: 'campo-testo'}, [
            el('span', {classe: 'campo-etichetta', testo: etichetta}),
            el('span', {classe: `campo-valore${segreto ? ' segreto' : ''}${multiriga ? ' multiriga' : ''}`, testo: nascosto ? '•'.repeat(12) : valore})
        ]),
        azioni.length ? el('span', {classe: 'campo-azioni'}, azioni) : null
    ]);
}

function sezione(titolo, campi) {
    const presenti = campi.filter(Boolean);
    if (!presenti.length) return null;
    return el('section', {classe: 'sezione'}, [el('h2', {classe: 'sezione-titolo', testo: titolo}), el('ul', {classe: 'lista lista-campi'}, presenti)]);
}

function disegnaDettaglio() {
    const voce = account.find(item => item.id === stato.apertoId);
    if (!voce) return;
    $('#titolo-dettaglio').textContent = voce.nome;
    const btnModifica = $('#btn-modifica');
    btnModifica.textContent = stato.modifica ? 'Fine' : 'Modifica';
    btnModifica.classList.toggle('primario', stato.modifica);
    const contenuto = [
        el('div', {classe: 'eroe'}, [
            avatar(voce, true),
            el('h1', {classe: 'eroe-titolo', testo: voce.nome}),
            el('p', {classe: 'eroe-sottotitolo'}, [
                el('span', {testo: voce.categoria}),
                voce.condiviso ? el('span', {classe: 'etichetta'}, [icona('group'), el('span', {classe: 'etichetta-testo', testo: 'Condiviso'})]) : null
            ])
        ]),
        stato.modifica ? null : el('div', {classe: 'azioni-rapide'}, [
            el('button', {type: 'button', classe: 'azione-rapida', onclick: () => copia(voce.utente, 'Nome utente')}, [icona('person'), el('span', {testo: 'Copia utente'})]),
            el('button', {type: 'button', classe: 'azione-rapida', onclick: () => copia(voce.password, 'Password')}, [icona('key'), el('span', {testo: 'Copia password'})]),
            el('button', {type: 'button', classe: 'azione-rapida', disabled: !voce.sito, onclick: () => avviso('Nella prova il sito non viene aperto')}, [icona('open_in_new'), el('span', {testo: 'Apri sito'})])
        ]),
        sezione('Accesso', [
            campo('Nome utente', 'utente', voce),
            campo('Password', 'password', voce, {segreto: true}),
            campo('Codice', 'codice', voce)
        ]),
        sezione('Sito web', [campo('Indirizzo', 'sito', voce)]),
        sezione('Note', [campo('Note', 'note', voce, {copiabile: false, multiriga: true})]),
        stato.modifica ? null : el('div', {classe: 'zona-pericolo'}, el('button', {
            type: 'button', classe: 'btn-testo pericolo', onclick: () => avviso('Nella prova l’account non viene archiviato')
        }, [icona('archive'), el('span', {testo: 'Archivia account'})]))
    ];
    $('#corpo-dettaglio').replaceChildren(...contenuto.filter(Boolean));
}

function apriDettaglio(id) {
    Object.assign(stato, {apertoId: id, modifica: false, passwordVisibile: false});
    disegnaDettaglio();
    document.body.dataset.vista = 'dettaglio';
    $('#vista-dettaglio').hidden = false;
    $('#vista-dettaglio .scorrevole').scrollTop = 0;
    $('#vista-dettaglio .btn-indietro').focus({preventScroll: true});
}

function chiudiDettaglio() {
    const id = stato.apertoId;
    Object.assign(stato, {apertoId: null, modifica: false});
    document.body.dataset.vista = 'lista';
    $('#vista-dettaglio').hidden = true;
    disegnaElenco();
    [...document.querySelectorAll('.riga')].find(riga => riga.querySelector('.riga-titolo')?.textContent === account.find(v => v.id === id)?.nome)?.focus({preventScroll: true});
}

function attivaModifica() {
    if (!stato.modifica) { stato.modifica = true; disegnaDettaglio(); $('#corpo-dettaglio .campo-input')?.focus(); return; }
    const voce = account.find(item => item.id === stato.apertoId);
    for (const input of document.querySelectorAll('#corpo-dettaglio .campo-input')) voce[input.name] = input.value.trim();
    stato.modifica = false;
    disegnaDettaglio();
    avviso('Modifiche salvate (solo in questa prova)');
}

/* ---------- Avvio ---------- */
function avvia() {
    applicaTema(leggiTema());
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applicaTema(leggiTema()));
    for (const bottone of document.querySelectorAll('[data-azione="tema"]')) bottone.addEventListener('click', cambiaTema);
    for (const bottone of document.querySelectorAll('[data-azione="finta"]')) bottone.addEventListener('click', () => avviso('Nella prova è attiva solo la sezione Account'));
    $('#ricerca').addEventListener('input', evento => { stato.ricerca = evento.target.value; disegnaElenco(); });
    $('#vista-dettaglio .btn-indietro').addEventListener('click', chiudiDettaglio);
    $('#btn-modifica').addEventListener('click', attivaModifica);
    document.addEventListener('keydown', evento => { if (evento.key === 'Escape' && stato.apertoId && !stato.modifica) chiudiDettaglio(); });
    // Il titolo grande diventa compatto scorrendo (usato da Stile iPhone e Scura sicura).
    const scorrevole = $('#vista-lista .scorrevole');
    scorrevole.addEventListener('scroll', () => document.body.classList.toggle('scorrito', scorrevole.scrollTop > 40), {passive: true});
    document.body.dataset.vista = 'lista';
    disegnaFiltri();
    disegnaElenco();
}

avvia();
