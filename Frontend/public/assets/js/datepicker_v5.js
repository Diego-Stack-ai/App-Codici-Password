/**
 * DATEPICKER V5.0 - Custom JS Module
 * Sostituisce il date picker nativo con una modale V5.0 style
 */

import { createElement, setChildren, clearElement } from './dom-utils.js';
import { t } from './translations.js';

let activeInput = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null;

const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const WEEK_DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/**
 * Inizializza il date picker su un input specifico
 * @param {HTMLInputElement} inputElement - Input di tipo text o readonly (ex date)
 */
export function initDatePickerV5(inputElementId) {
    const inputElement = document.getElementById(inputElementId);
    if (!inputElement) return;

    // Disabilita tastiera mobile e input diretto
    inputElement.readOnly = true;
    inputElement.type = 'text'; // Forza text per evitare picker nativo mobile
    inputElement.classList.add('input-datepicker-trigger');
    inputElement.setAttribute('placeholder', 'GG/MM/AAAA'); // Placeholder umano

    // Iniezione Evento Click
    inputElement.addEventListener('click', (e) => {
        e.preventDefault();
        openDatePicker(inputElement);
    });

    // Gestione icona calendario nel wrapper
    const wrapper = inputElement.closest('.input-wrapper');
    if (wrapper) {
        wrapper.style.cursor = 'pointer';
        wrapper.onclick = (e) => {
            if (e.target !== inputElement) openDatePicker(inputElement);
        };
    }
}

function openDatePicker(input) {
    activeInput = input;

    // Parse valore corrente se esiste
    if (input.value) {
        // Formato atteso DD/MM/YYYY o YYYY-MM-DD
        let d = parseDateString(input.value) || parseDateString(input.dataset.isoDate);
        if (d) {
            selectedDate = d;
            currentMonth = d.getMonth();
            currentYear = d.getFullYear();
        } else {
            selectedDate = null;
            const now = new Date();
            currentMonth = now.getMonth();
            currentYear = now.getFullYear();
        }
    } else {
        const now = new Date();
        currentMonth = now.getMonth();
        currentYear = now.getFullYear();
        selectedDate = null;
    }

    renderModal();
}

function parseDateString(str) {
    if (!str) return null;
    // Try ISO YYYY-MM-DD
    if (str.includes('-')) return new Date(str);
    // Try DD/MM/YYYY
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    return null;
}

function renderModal() {
    // Rimuovi modali esistenti
    const existing = document.getElementById('datepicker-modal-v5');
    if (existing) existing.remove();

    const overlay = createElement('div', { id: 'datepicker-modal-v5', className: 'datepicker-overlay' });
    const card = createElement('div', { className: 'datepicker-card' });

    // HEADER
    const header = createElement('div', { className: 'dp-header' }, [
        createElement('button', { className: 'dp-nav-btn', onclick: () => changeMonth(-1) }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'chevron_left' })
        ]),
        createElement('span', { className: 'dp-title-btn', textContent: `${MONTH_NAMES[currentMonth]} ${currentYear}` }),
        createElement('button', { className: 'dp-nav-btn', onclick: () => changeMonth(1) }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'chevron_right' })
        ])
    ]);

    // GRID
    const grid = createElement('div', { id: 'dp-grid-container', className: 'dp-grid' });
    renderGrid(grid);

    // FOOTER (Annulla / Oggi / Conferma)
    const footer = createElement('div', { className: 'dp-footer' }, [
        createElement('button', {
            className: 'dp-btn-text',
            textContent: t('cancel_short') || 'Annulla',
            onclick: closeDatePicker
        }),
        createElement('button', {
            className: 'dp-btn-fill',
            textContent: t('confirm') || 'OK',
            onclick: confirmSelection
        })
    ]);

    setChildren(card, [header, grid, footer]);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animazione
    requestAnimationFrame(() => overlay.classList.add('active'));

    // Chiudi cliccando fuori
    overlay.onclick = (e) => {
        if (e.target === overlay) closeDatePicker();
    };
}

function renderGrid(container) {
    clearElement(container);

    // Labels
    WEEK_DAYS.forEach(d => {
        container.appendChild(createElement('div', { className: 'dp-day-label', textContent: d }));
    });

    const firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Correzione per lunedì come primo giorno (1=Lun, 7=Dom)
    // getDay(): 0=Sun, 1=Mon... -> Vogliamo 0=Mon... 6=Sun
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;

    // Celle vuote iniziali
    for (let i = 0; i < startOffset; i++) {
        container.appendChild(createElement('div', { className: 'dp-day empty' }));
    }

    // Giorni
    const today = new Date();
    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentYear, currentMonth, d);
        const isToday = dateObj.toDateString() === today.toDateString();
        const isSelected = selectedDate && dateObj.toDateString() === selectedDate.toDateString();

        const cell = createElement('div', {
            className: `dp-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`,
            textContent: d,
            onclick: () => selectDay(d)
        });
        container.appendChild(cell);
    }
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    // Rerender solo contenuto
    renderModal();
}

function selectDay(day) {
    selectedDate = new Date(currentYear, currentMonth, day);
    renderModal(); // Aggiorna selezione visiva
}

function confirmSelection() {
    if (selectedDate && activeInput) {
        // Salva valore ISO in dataset per uso JS backend
        // YYYY-MM-DD
        const iso = selectedDate.toISOString().split('T')[0];
        activeInput.dataset.isoDate = iso;
        activeInput.value = iso; // Compatibilità standard form (value = YYYY-MM-DD solitamente)

        // Formatta valore visibile se l'input fosse "text" puro, ma qui usiamo type="text" che simula date value
        // Se volessimo mostrare DD/MM/YYYY all'utente:
        const visibleDate = selectedDate.toLocaleDateString('it-IT');
        activeInput.value = visibleDate;
        activeInput.dataset.isoValue = iso; // Chiave sicura per il backend

        // Trigger Change event per listeners
        activeInput.dispatchEvent(new Event('change'));
    }
    closeDatePicker();
}

function closeDatePicker() {
    const modal = document.getElementById('datepicker-modal-v5');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}
