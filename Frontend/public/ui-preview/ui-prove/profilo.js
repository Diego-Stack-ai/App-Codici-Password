// Quarta prova: Profilo (Contatti, Indirizzi, Documenti) in due versioni affiancabili.
// «Oggi» riproduce la gerarchia attuale; «Proposta» applica i tre livelli:
// contenuto in primo piano, azioni rapide discrete, gestione solo in modalità Modifica.
import {el, icona, avviso, copia, attivaTema} from './utili.js';
import {CONTATTI, INDIRIZZI, DOCUMENTI} from './dati-profilo.js';

const dati = {
    contatti: structuredClone(CONTATTI),
    indirizzi: structuredClone(INDIRIZZI),
    documenti: structuredClone(DOCUMENTI),
};
const LINGUETTE = [
    {id: 'contatti', nome: 'Contatti', aggiungi: 'Aggiungi numero', iconaAggiungi: 'add_call'},
    {id: 'indirizzi', nome: 'Indirizzi', aggiungi: 'Aggiungi indirizzo', iconaAggiungi: 'add_location_alt'},
    {id: 'documenti', nome: 'Documenti', aggiungi: 'Aggiungi documento', iconaAggiungi: 'note_add'},
];
const stato = {modo: 'proposta', linguetta: 'contatti', modifica: false, inModifica: null, daConfermare: null};
const $ = selettore => document.querySelector(selettore);
const esempio = () => avviso('Nella versione «Oggi» i pulsanti sono solo di esempio');
const formattaData = iso => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', {day: '2-digit', month: '2-digit', year: 'numeric'});
const giorniA = iso => Math.round((new Date(`${iso}T12:00:00`) - new Date()) / 86400000);

/* =====================================================================
   VERSIONE «OGGI» — stessa gerarchia delle schermate attuali
   ===================================================================== */
const tratteggiato = (testo, extra = '') => el('button', {type: 'button', classe: `oggi-tratteggiato ${extra}`.trim(), onclick: esempio, testo});
const oggiTestata = (nomeIcona, etichetta, conAllegato = false) => el('div', {classe: 'oggi-testata'}, [
    icona(nomeIcona, 'oggi-testata-icona'),
    el('span', {classe: 'oggi-testata-etichetta', testo: etichetta}),
    conAllegato ? el('button', {type: 'button', classe: 'oggi-icona-azione', 'aria-label': 'Allega', onclick: esempio}, icona('attach_file')) : null,
    el('button', {type: 'button', classe: 'oggi-icona-azione', 'aria-label': 'Modifica', onclick: esempio}, icona('edit')),
    el('button', {type: 'button', classe: 'oggi-cestino', 'aria-label': 'Elimina', onclick: esempio}, icona('delete'))
]);
const oggiValore = (valore, etichetta) => el('div', {classe: 'oggi-valore'}, [
    el('span', {testo: valore}),
    el('button', {type: 'button', classe: 'oggi-copia', 'aria-label': `Copia ${etichetta}`, onclick: () => copia(valore, etichetta)}, icona('content_copy'))
]);
const oggiQr = (attivo, etichetta) => el('div', {classe: 'oggi-qr'}, [
    el('span', {classe: `oggi-spunta${attivo ? ' attiva' : ''}`, 'aria-hidden': 'true'}, attivo ? icona('check') : null),
    el('span', {classe: 'oggi-qr-testo', testo: 'QR'}),
    el('span', {classe: 'oggi-etichetta-destra', testo: etichetta})
]);
const oggiAccount = account => account
    ? [tratteggiato(`Apri: ${account}`, 'grande'), el('div', {classe: 'oggi-coppia'}, [tratteggiato('Cambia Account'), tratteggiato('Scollega Account')])]
    : [tratteggiato('Collega o crea Account', 'grande')];

function oggiContatti() {
    return dati.contatti.map(contatto => el('article', {classe: 'oggi-scheda'}, [
        oggiTestata(contatto.tipo === 'Email' ? 'mail' : 'call', contatto.tipo),
        oggiQr(contatto.qr, contatto.tipo === 'Email' ? 'Email' : 'Numero'),
        oggiValore(contatto.valore, contatto.tipo),
        ...oggiAccount(contatto.account)
    ]));
}

function oggiIndirizzi() {
    return dati.indirizzi.map(indirizzo => el('article', {classe: 'oggi-scheda'}, [
        oggiTestata('home', indirizzo.tipo.toUpperCase()),
        oggiQr(indirizzo.qr, 'Indirizzo'),
        oggiValore(indirizzo.via, 'Indirizzo'),
        el('p', {classe: 'oggi-etichetta', testo: 'Località'}),
        oggiValore(indirizzo.localita, 'Località'),
        ...indirizzo.utenze.flatMap(utenza => [
            el('hr', {classe: 'oggi-divisore'}),
            el('div', {classe: 'oggi-testata secondaria'}, [
                el('span', {classe: 'oggi-etichetta', testo: utenza.tipo}),
                el('button', {type: 'button', classe: 'oggi-icona-azione', 'aria-label': 'Modifica', onclick: esempio}, icona('edit')),
                el('button', {type: 'button', classe: 'oggi-cestino', 'aria-label': 'Elimina', onclick: esempio}, icona('delete'))
            ]),
            oggiValore(utenza.valore, utenza.tipo),
            ...oggiAccount(utenza.account)
        ])
    ]));
}

function oggiDocumenti() {
    return dati.documenti.map(documento => el('article', {classe: 'oggi-scheda'}, [
        oggiTestata('description', documento.tipo.toUpperCase(), true),
        oggiValore(documento.numero, 'Numero'),
        el('p', {classe: 'oggi-secondario', testo: documento.secondario}),
        el('p', {classe: 'oggi-scadenza'}, [icona('event'), el('span', {testo: `Scadenza: ${formattaData(documento.scadenza)}`})]),
        el('hr', {classe: 'oggi-divisore'}),
        el('p', {classe: 'oggi-allegati-titolo'}, [icona('attach_file'), el('span', {testo: `${documento.allegati.length} allegati`})]),
        el('div', {classe: 'oggi-allegati'}, documento.allegati.map(foto => el('div', {classe: 'oggi-allegato'}, [
            el('div', {classe: `foto-finta foto-${foto.stile}`, 'aria-hidden': 'true'}),
            el('div', {classe: 'oggi-allegato-piede'}, [
                el('span', {classe: 'oggi-allegato-testo'}, [el('strong', {testo: 'image-ritagliata…'}), el('span', {testo: '0.27 MB · 12/10/2026'})]),
                el('button', {type: 'button', classe: 'oggi-cestino tondo', 'aria-label': 'Elimina allegato', onclick: esempio}, icona('delete'))
            ])
        ]))),
        ...oggiAccount(documento.account),
        tratteggiato('Apri scadenza del documento', 'grande')
    ]));
}

/* =====================================================================
   VERSIONE «PROPOSTA» — tre livelli di importanza
   ===================================================================== */
const azione = (nomeIcona, etichetta, alClic) => el('button', {type: 'button', classe: 'p-azione', 'aria-label': etichetta, title: etichetta, onclick: alClic}, icona(nomeIcona));

function collegamento(account) {
    if (!account) return null;
    return el('button', {type: 'button', classe: 'p-collegamento', onclick: () => avviso(`Si aprirebbe l’account «${account}»`)}, [
        icona('link'), el('span', {testo: account}), icona('chevron_right', 'p-freccia')
    ]);
}

function pulsanteElimina(id, testo, alConferma) {
    const daConfermare = stato.daConfermare === id;
    return el('button', {
        type: 'button', classe: `p-testo pericolo${daConfermare ? ' conferma' : ''}`, 'data-focus': `elimina-${id}`,
        onclick: () => {
            if (!daConfermare) { stato.daConfermare = id; disegna(); return; }
            stato.daConfermare = null; alConferma(); disegna(); avviso('Eliminato (solo in questa prova)');
        }
    }, [icona('delete'), el('span', {testo: daConfermare ? 'Tocca di nuovo per confermare' : testo})]);
}

// Pannello di gestione: compare solo in modalità Modifica, sotto il dato.
function gestione(voce, {conQr = true, nomeElimina, rimuovi} = {}) {
    if (!stato.modifica) return null;
    return el('div', {classe: 'p-gestione'}, [
        el('div', {classe: 'p-gestione-riga'}, [
            el('button', {type: 'button', classe: 'p-testo', 'data-focus': `modifica-${voce.id}`, onclick: () => { stato.inModifica = voce.id; disegna(); $('.p-campo-input')?.focus(); }}, [icona('edit'), el('span', {testo: 'Modifica'})]),
            'account' in voce ? el('button', {type: 'button', classe: 'p-testo', 'data-focus': `account-${voce.id}`, onclick: () => {
                voce.account = voce.account ? null : 'Nuovo account di prova'; disegna(); avviso(voce.account ? 'Account collegato' : 'Account scollegato');
            }}, [icona(voce.account ? 'link_off' : 'add_link'), el('span', {testo: voce.account ? 'Scollega account' : 'Collega account'})]) : null,
        ]),
        conQr ? el('label', {classe: 'p-interruttore'}, [
            el('span', {testo: 'Includi nel biglietto QR'}),
            (() => { const input = el('input', {type: 'checkbox', role: 'switch', 'data-focus': `qr-${voce.id}`}); input.checked = voce.qr; input.addEventListener('change', () => { voce.qr = input.checked; disegna(); }); return input; })()
        ]) : null,
        pulsanteElimina(voce.id, nomeElimina, rimuovi)
    ]);
}

// Valore principale: in sola lettura è testo, durante la modifica diventa un campo.
function valorePrincipale(voce, chiave, azioniRapide) {
    if (stato.inModifica === voce.id) {
        const input = el('input', {classe: 'p-campo-input', 'aria-label': 'Nuovo valore', autocomplete: 'off', 'data-focus': `modifica-${voce.id}`});
        input.value = voce[chiave];
        const salva = () => { voce[chiave] = input.value.trim() || voce[chiave]; stato.inModifica = null; disegna(); avviso('Salvato (solo in questa prova)'); };
        input.addEventListener('keydown', evento => { if (evento.key === 'Enter') salva(); if (evento.key === 'Escape') { stato.inModifica = null; disegna(); } });
        return el('div', {classe: 'p-modifica-campo'}, [input, el('button', {type: 'button', classe: 'p-pulsante', 'data-focus': `modifica-${voce.id}`, onclick: salva, testo: 'Salva'})]);
    }
    return el('div', {classe: 'p-valore-riga'}, [
        el('span', {classe: 'p-valore', testo: voce[chiave]}),
        stato.modifica ? null : el('span', {classe: 'p-azioni'}, azioniRapide)
    ]);
}

const etichettaQr = attivo => attivo ? el('span', {classe: 'p-segno', title: 'Incluso nel biglietto QR'}, [icona('qr_code_2'), el('span', {testo: 'Nel QR'})]) : null;

function propostaContatti() {
    return el('ul', {classe: 'p-elenco'}, dati.contatti.map(contatto => el('li', {classe: 'p-voce'}, [
        el('div', {classe: 'p-voce-testa'}, [el('span', {classe: 'p-etichetta', testo: contatto.tipo}), etichettaQr(contatto.qr)]),
        valorePrincipale(contatto, 'valore', [
            contatto.tipo === 'Email'
                ? azione('mail', 'Scrivi email', () => avviso('Si aprirebbe la posta'))
                : azione('call', 'Chiama', () => avviso(`Si chiamerebbe ${contatto.valore}`)),
            azione('content_copy', `Copia ${contatto.tipo.toLowerCase()}`, () => copia(contatto.valore, contatto.tipo))
        ]),
        collegamento(contatto.account),
        gestione(contatto, {nomeElimina: 'Elimina numero', rimuovi: () => { dati.contatti = dati.contatti.filter(v => v !== contatto); }})
    ])));
}

function propostaIndirizzi() {
    return dati.indirizzi.map(indirizzo => el('article', {classe: 'p-scheda'}, [
        el('ul', {classe: 'p-elenco interno'}, [
            el('li', {classe: 'p-voce'}, [
                el('div', {classe: 'p-voce-testa'}, [el('span', {classe: 'p-etichetta', testo: indirizzo.tipo}), etichettaQr(indirizzo.qr)]),
                valorePrincipale(indirizzo, 'via', [
                    azione('map', 'Apri nelle mappe', () => avviso('Si aprirebbero le mappe')),
                    azione('content_copy', 'Copia indirizzo', () => copia(`${indirizzo.via}, ${indirizzo.localita}`, 'Indirizzo'))
                ]),
                el('p', {classe: 'p-sotto', testo: indirizzo.localita}),
                gestione(indirizzo, {nomeElimina: 'Elimina indirizzo', rimuovi: () => { dati.indirizzi = dati.indirizzi.filter(v => v !== indirizzo); }})
            ]),
            ...indirizzo.utenze.map(utenza => el('li', {classe: 'p-voce utenza'}, [
                el('div', {classe: 'p-voce-testa'}, [el('span', {classe: 'p-etichetta', testo: utenza.tipo})]),
                valorePrincipale(utenza, 'valore', [azione('content_copy', `Copia ${utenza.tipo}`, () => copia(utenza.valore, utenza.tipo))]),
                collegamento(utenza.account),
                gestione(utenza, {conQr: false, nomeElimina: 'Elimina utenza', rimuovi: () => { indirizzo.utenze = indirizzo.utenze.filter(v => v !== utenza); }})
            ])),
                stato.modifica ? el('li', {classe: 'p-voce'}, el('button', {type: 'button', classe: 'p-testo', 'data-focus': `aggiungi-utenza-${indirizzo.id}`, onclick: () => {
                const nuova = {id: `u${Date.now()}`, tipo: 'Nuova utenza', valore: 'Codice da inserire', account: null};
                indirizzo.utenze.push(nuova); stato.inModifica = nuova.id; disegna(); $('.p-campo-input')?.select();
            }}, [icona('add'), el('span', {testo: 'Aggiungi utenza (luce, gas, acqua…)'})])) : null
        ])
    ]));
}

function statoScadenza(iso) {
    const giorni = giorniA(iso);
    if (giorni < 0) return {classe: 'scaduto', testo: 'Scaduto'};
    if (giorni <= 60) return {classe: 'vicino', testo: `Scade tra ${giorni} giorni`};
    return {classe: 'ok', testo: `Valido fino al ${formattaData(iso)}`};
}

function propostaDocumenti() {
    return dati.documenti.map(documento => {
        const scadenza = statoScadenza(documento.scadenza);
        return el('article', {classe: 'p-scheda p-documento'}, [
            el('div', {classe: 'p-voce-testa'}, [
                el('span', {classe: 'p-etichetta', testo: documento.tipo}),
                el('span', {classe: `p-scadenza ${scadenza.classe}`}, [icona(scadenza.classe === 'ok' ? 'check_circle' : 'schedule'), el('span', {testo: scadenza.testo})])
            ]),
            valorePrincipale(documento, 'numero', [azione('content_copy', 'Copia numero', () => copia(documento.numero, 'Numero'))]),
            el('p', {classe: 'p-sotto', testo: documento.secondario}),
            el('div', {classe: 'p-foto'}, [
                ...documento.allegati.map(foto => el('div', {classe: 'p-foto-voce'}, [
                    el('button', {type: 'button', classe: 'p-miniatura', 'aria-label': `Apri foto ${foto.lato.toLowerCase()}`, onclick: () => apriFoto(documento, foto)}, [
                        el('span', {classe: `foto-finta foto-${foto.stile}`, 'aria-hidden': 'true'}),
                        el('span', {classe: 'p-miniatura-lato', testo: foto.lato})
                    ]),
                    stato.modifica ? el('button', {type: 'button', classe: 'p-togli', 'data-focus': `rimuovi-foto-${foto.id}`, 'aria-label': `Rimuovi foto ${foto.lato.toLowerCase()}`, onclick: () => {
                        documento.allegati = documento.allegati.filter(v => v !== foto); disegna(); avviso('Foto rimossa (solo in questa prova)');
                    }}, icona('close')) : null
                ])),
                stato.modifica ? el('button', {type: 'button', classe: 'p-miniatura aggiungi', onclick: () => avviso('Si aprirebbe fotocamera o galleria')}, [icona('add_a_photo'), el('span', {classe: 'p-miniatura-lato', testo: 'Aggiungi'})]) : null
            ]),
            el('button', {type: 'button', classe: 'p-collegamento', onclick: () => avviso('Si aprirebbe la scadenza collegata')}, [icona('event'), el('span', {testo: `Promemoria scadenza · ${formattaData(documento.scadenza)}`}), icona('chevron_right', 'p-freccia')]),
            collegamento(documento.account),
            gestione(documento, {conQr: false, nomeElimina: 'Elimina documento', rimuovi: () => { dati.documenti = dati.documenti.filter(v => v !== documento); }})
        ]);
    });
}

/* ---------- Visore foto ---------- */
let origineFoto;
function apriFoto(documento, foto) {
    const visore = $('#visore');
    origineFoto = document.activeElement;
    visore.replaceChildren(
        el('div', {classe: 'visore-barra'}, [
            el('p', {testo: `${documento.tipo} · ${foto.lato}`}),
            el('button', {type: 'button', classe: 'btn-icona', 'aria-label': 'Chiudi foto', onclick: chiudiFoto}, icona('close'))
        ]),
        el('div', {classe: `foto-finta grande foto-${foto.stile}`, role: 'img', 'aria-label': `Foto inventata: ${documento.tipo}, ${foto.lato.toLowerCase()}`})
    );
    visore.showModal();
    visore.querySelector('button').focus();
}
function chiudiFoto() { $('#visore').close(); }

/* ---------- Disegno della pagina ---------- */
function disegna() {
    const attivo = document.activeElement;
    const focusDaRipristinare = $('#contenuto').contains(attivo) ? attivo.dataset.focus : null;
    const linguetta = LINGUETTE.find(voce => voce.id === stato.linguetta);
    document.body.dataset.modo = stato.modo;
    for (const bottone of document.querySelectorAll('.commutatore [data-modo]')) bottone.setAttribute('aria-pressed', String(bottone.dataset.modo === stato.modo));
    for (const bottone of document.querySelectorAll('[data-linguetta]')) bottone.setAttribute('aria-pressed', String(bottone.dataset.linguetta === stato.linguetta));
    $('#contenuto').setAttribute('aria-label', linguetta.nome);

    let contenuto;
    if (stato.modo === 'oggi') {
        contenuto = [
            el('button', {type: 'button', classe: 'oggi-tratteggiato aggiungi', onclick: esempio}, [icona(linguetta.iconaAggiungi), el('span', {testo: linguetta.aggiungi})]),
            ...({contatti: oggiContatti, indirizzi: oggiIndirizzi, documenti: oggiDocumenti}[stato.linguetta])()
        ];
    } else {
        const numero = dati[stato.linguetta].length;
        contenuto = [
            el('div', {classe: 'p-testata'}, [
                el('div', {}, [el('h2', {classe: 'p-titolo', testo: linguetta.nome}), el('p', {classe: 'p-conteggio', testo: `${numero} ${numero === 1 ? 'voce' : 'voci'}`})]),
                el('button', {type: 'button', classe: `p-pulsante${stato.modifica ? '' : ' tenue'}`, 'data-focus': 'modalita-modifica', 'aria-pressed': String(stato.modifica), onclick: () => {
                    Object.assign(stato, {modifica: !stato.modifica, inModifica: null, daConfermare: null}); disegna();
                }, testo: stato.modifica ? 'Fine' : 'Modifica'})
            ]),
            ...[].concat(({contatti: propostaContatti, indirizzi: propostaIndirizzi, documenti: propostaDocumenti}[stato.linguetta])()),
            stato.modifica ? el('button', {type: 'button', classe: 'p-aggiungi', 'data-focus': 'aggiungi-voce', onclick: () => aggiungi(linguetta)}, [icona('add'), el('span', {testo: linguetta.aggiungi})]) : null,
            stato.modifica ? null : el('p', {classe: 'p-suggerimento', testo: 'Per aggiungere, collegare account o eliminare tocca «Modifica».'})
        ];
    }
    $('#contenuto').replaceChildren(...contenuto.filter(Boolean));
    if (focusDaRipristinare) {
        const nuovoFocus = Array.from($('#contenuto').querySelectorAll('[data-focus]'))
            .find(nodo => nodo.dataset.focus === focusDaRipristinare);
        (nuovoFocus || $('#contenuto [data-focus="modalita-modifica"]'))?.focus();
    }
}

function aggiungi(linguetta) {
    const id = `n${Date.now()}`;
    if (linguetta.id === 'contatti') dati.contatti.push({id, tipo: 'Nuovo numero', valore: '', qr: false, account: null});
    if (linguetta.id === 'indirizzi') dati.indirizzi.push({id, tipo: 'Nuovo indirizzo', via: '', localita: '', qr: false, utenze: []});
    if (linguetta.id === 'documenti') dati.documenti.push({id, tipo: 'Nuovo documento', numero: '', secondario: '', scadenza: new Date().toISOString().slice(0, 10), allegati: [], account: null});
    stato.inModifica = id;
    disegna();
    $('.p-campo-input')?.focus();
}

function avvia() {
    attivaTema();
    for (const bottone of document.querySelectorAll('.commutatore [data-modo]')) bottone.addEventListener('click', () => {
        Object.assign(stato, {modo: bottone.dataset.modo, modifica: false, inModifica: null, daConfermare: null});
        disegna();
    });
    for (const bottone of document.querySelectorAll('[data-linguetta]')) bottone.addEventListener('click', () => {
        Object.assign(stato, {linguetta: bottone.dataset.linguetta, modifica: false, inModifica: null, daConfermare: null});
        disegna();
        $('#contenuto').scrollTop = 0;
    });
    $('#visore').addEventListener('close', () => {
        if (origineFoto?.isConnected) origineFoto.focus();
        origineFoto = null;
    });
    $('#visore').addEventListener('click', evento => { if (evento.target.id === 'visore') chiudiFoto(); });
    const parametri = new URLSearchParams(location.search);
    if (parametri.get('modo') === 'oggi') stato.modo = 'oggi';
    if (LINGUETTE.some(voce => voce.id === parametri.get('sezione'))) stato.linguetta = parametri.get('sezione');
    disegna();
}

avvia();
