/**
 * AGGIUNGI SCADENZA MODULE (V4.1)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/scadenze/.
 */

import { auth } from '../../firebase-config.js?v=1.2.76';
import { getFooterReady } from '../../footer-state.js';
import { LOG } from '../../logger.js';
import { onAuthStateChanged } from "/assets/js/vendor/firebase-runtime.js";

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';

import { t } from '../../translations.js';
import { initDatePickerV5 } from '../../datepicker_v5.js';
import { normalizeExternalUrl } from '../shared/attachment-security.js';
import { getDeadline } from '../data/vault-repository.js';
import { deadlineRecipientsFromRecord } from './deadline-recipient-model.js';
import { deadlineDateInputFields, deadlineInputDate } from './deadline-model.js';
import { createDeadlineAttachmentController } from './deadline-attachment-controller.js';
import { createDeadlineRecipientController } from './deadline-recipient-controller.js';
import { createDeadlineConfigController } from './deadline-config-controller.js';
import { saveDeadline } from './deadline-save-service.js';

// --- CONFIGURAZIONE E ELEMENTI DOM ---
const typeSelect = document.getElementById('tipo_scadenza');

let currentUser = null;
let currentMode = 'automezzi';
let editingScadenzaId = new URLSearchParams(window.location.search).get('id');
const attachmentController = createDeadlineAttachmentController();
const recipientController = createDeadlineRecipientController();
const configController = createDeadlineConfigController({
    recipientController,
    onRender: () => syncCustomDropdowns()
});
let profileDocumentLinkDraft = null;
let linkedSourceRef = null;

/**
 * AGGIUNGI SCADENZA MODULE (V5.0 ADAPTER)
 * Gestisce l'aggiunta o la modifica di scadenze.
 * - Entry Point: initAggiungiScadenza(user)
 */

export async function initAggiungiScadenza(user) {
    
    if (!user) return;
    currentUser = user;

    editingScadenzaId = new URLSearchParams(window.location.search).get('id');
    const profileDocumentId = new URLSearchParams(window.location.search).get('profileDocumentId');
    if (!editingScadenzaId && profileDocumentId) {
        try {
            const draft = JSON.parse(sessionStorage.getItem('profile-deadline-link-draft') || 'null');
            if (draft?.profileDocumentId === profileDocumentId) profileDocumentLinkDraft = draft;
        } catch { profileDocumentLinkDraft = null; }
    }

    // Mode Switching Listeners
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            btn.addEventListener('click', () => setMode(mode));
        }
    });

    // Custom Datepicker V5.0
    initDatePickerV5('dueDate');

    initProxyDropdowns();
    attachmentController.init();

    recipientController.init();

    // --- FOOTER ACTIONS SYSTEM (Event Contract V6.1) ---
    function initFooterFromDetail(detail) {
        const { center: footerCenter, right: footerRight } = detail;
        if (!footerCenter || !footerRight) return;

        // 1. Settings Link (Right)
        const settLink = createElement('div', { id: 'footer-settings-link' });
        settLink.appendChild(
            createElement('a', {
                href: 'impostazioni.html',
                className: 'btn-icon-header footer-settings-link',
                title: 'Impostazioni'
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'tune' })
            ])
        );
        clearElement(footerRight);
        footerRight.appendChild(settLink);

        // 2. Main Actions (Center)
        clearElement(footerCenter);

        const cancelBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-neutral',
            title: t('cancel') || 'Annulla',
            dataset: { label: t('cancel_short') || 'Annulla' },
            onclick: () => {
                if (editingScadenzaId) window.location.href = `dettaglio_scadenza.html?id=${editingScadenzaId}`;
                else window.location.href = 'scadenze.html';
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })
        ]);

        const saveBtn = createElement('button', {
            id: 'save-btn',
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('save') || 'Salva Scadenza',
            dataset: { label: t('save_short') || 'Salva' }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]);

        const fabWrapper = createElement('div', {
            className: 'fab-group'
        }, [cancelBtn, saveBtn]);

        footerCenter.appendChild(fabWrapper);
        setupSaveLogic();

        // 3. Animations (Home Page Style)
        [cancelBtn, saveBtn].forEach((btn, index) => {
            btn.animate([
                { transform: 'scale(0) translateY(20px)', opacity: 0 },
                { transform: 'scale(1) translateY(0)', opacity: 1 }
            ], {
                duration: 400,
                delay: index * 100,
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                fill: 'forwards'
            });
        });
    }

    // V6.1: Late-subscriber safe — se il footer è già pronto, inizializza subito
    const _footerState = getFooterReady();
    if (_footerState) {
        initFooterFromDetail(_footerState);
    } else {
        document.addEventListener('footer:ready', (e) => initFooterFromDetail(e.detail), { once: true });
    }

    configController.initManagementButtons();
    configController.render();
    try {
        await configController.load(currentUser);
    } catch (error) {
        console.error('Config Load Error', error);
    }
    updateAttachmentsUI();

    if (editingScadenzaId) {
        // UI update immediately
        const pageTitle = document.querySelector('.detail-title-value');
        if (pageTitle) pageTitle.textContent = "Modifica Scadenza";
        await loadScadenzaForEdit(editingScadenzaId);
    } else {
        // Forza l'aggiornamento UI per la modalità di default ('automezzi') in "Aggiungi"
        setMode(currentMode);
        if (profileDocumentLinkDraft) {
            setMode('documenti');
            const nameInput = document.getElementById('nome_cognome');
            const dateInput = document.getElementById('dueDate');
            if (nameInput) nameInput.value = profileDocumentLinkDraft.name || 'Documento';
            if (dateInput) {
                dateInput.value = profileDocumentLinkDraft.dueDate || '';
                dateInput.dataset.isoValue = profileDocumentLinkDraft.dueDate || '';
            }
            if (typeSelect && profileDocumentLinkDraft.name && [...typeSelect.options].some(option => option.value === profileDocumentLinkDraft.name)) {
                typeSelect.value = profileDocumentLinkDraft.name;
            }
        }
    }

    
}
function setMode(mode) {
    currentMode = mode;
    updateUIButtons(mode);

    // Update labels and visibility
    const vehicleSection = document.getElementById('vehicle_fields_wrapper');
    const vehicleLabel = vehicleSection?.querySelector('.label-sm');
    const vehicleIcon = document.getElementById('vehicle-icon');

    if (mode === 'automezzi') {
        vehicleSection?.classList.remove('hidden');
        if (vehicleLabel) {
            vehicleLabel.textContent = "Dettaglio Veicolo";
            vehicleLabel.setAttribute('data-t', 'vehicle_extra');
        }
        if (vehicleIcon) vehicleIcon.textContent = 'directions_car';
    } else if (mode === 'documenti') {
        vehicleSection?.classList.remove('hidden');
        if (vehicleLabel) {
            vehicleLabel.textContent = "Intestatario / Dettagli";
            vehicleLabel.setAttribute('data-t', 'holder_details');
        }
        if (vehicleIcon) vehicleIcon.textContent = 'badge';
    } else if (mode === 'generali') {
        vehicleSection?.classList.add('hidden');
    }

    configController.setMode(mode);
}

function updateUIButtons(activeMode) {
    ['automezzi', 'documenti', 'generali'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            if (mode === activeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
    });
}

function updateAttachmentsUI() {
    const placeholder = document.getElementById('attachments-placeholder-new');
    const linkDiv = document.getElementById('attachments-link-edit');
    const btnManage = document.getElementById('btn-manage-attachments');

    if (editingScadenzaId) {
        placeholder?.classList.add('hidden');
        linkDiv?.classList.remove('hidden');

    } else {
        placeholder?.classList.remove('hidden');
        linkDiv?.classList.add('hidden');
    }
}


let isSubmitting = false;

function setupSaveLogic() {
    const oldBtnSave = document.getElementById('save-btn');
    if (!oldBtnSave) return;

    // Rimuoviamo eventuali vecchi listener clonando il nodo
    const btnSave = oldBtnSave.cloneNode(true);
    oldBtnSave.parentNode.replaceChild(btnSave, oldBtnSave);

    btnSave.addEventListener('click', async () => {
        if (!auth.currentUser || isSubmitting) {
            LOG("[FRONTEND] Click ignorato: processo già in corso o utente non loggato.");
            return;
        }

        const name = document.getElementById('nome_cognome').value.trim();
        const type = typeSelect.value;
        const dateInput = document.getElementById('dueDate');
        const date = deadlineInputDate(dateInput.dataset.isoValue, dateInput.value);

        if (!name || !type || !date) {
            return showToast("Compila i campi obbligatori (Nome, Categoria, Data)", "error");
        }

        const rawReferenceUrl = document.getElementById('deadline_url')?.value.trim() || '';
        const referenceUrl = rawReferenceUrl ? normalizeExternalUrl(rawReferenceUrl) : '';
        if (rawReferenceUrl && !referenceUrl) {
            return showToast('Inserisci un URL valido (http o https).', 'error');
        }

        try {
            isSubmitting = true;
            LOG("[FRONTEND-TRACE] Lock UI attivato. Singolo salvataggio in corso...");

            // --- UI LOCK ---
            btnSave.disabled = true;
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined animate-spin mr-2', textContent: 'progress_activity' }),
                createElement('span', { id: 'save-btn-text', textContent: 'Inizio...' })
            ]);
            const btnText = document.getElementById('save-btn-text');

            const result = await saveDeadline({
                user: currentUser,
                editingDeadlineId: editingScadenzaId,
                profileDocumentLinkDraft,
                linkedSourceRef,
                mode: currentMode,
                data: {
                    name,
                    type,
                    dueDate: date,
                    veicolo_modello: document.getElementById('modello_veicolo')?.value || '',
                    referenceUrl,
                    notes: document.getElementById('notes').value,
                    status: 'active',
                    completed: false,
                    templateText: document.getElementById('testo_email_select')?.value || '',
                    notifChannel: 'multichannel',
                    notif_days_before: Number(document.getElementById('notif_days_before')?.value || 14),
                    notif_frequency: Number(document.getElementById('notif_frequency')?.value || 7)
                },
                recipients: recipientController.getRecipients(),
                selectedFiles: attachmentController.getSelectedFiles(),
                existingAttachments: attachmentController.getExistingAttachments(),
                onProgress(progress) {
                    if (!btnText) return;
                    btnText.textContent = progress.phase === 'upload'
                        ? `Upload ${progress.current}/${progress.total}...`
                        : 'Salvataggio DB...';
                }
            });
            const finalDocId = result.deadlineId;
            if (result.consumedProfileDocumentDraft) {
                sessionStorage.removeItem('profile-deadline-link-draft');
                profileDocumentLinkDraft = null;
            }

            if (btnText) btnText.textContent = "Completato!";
            showToast(editingScadenzaId ? "Scadenza aggiornata!" : "Scadenza salvata!", "success");

            setTimeout(() => {
                window.location.replace(`dettaglio_scadenza.html?id=${finalDocId}`);
            }, 1000);

        } catch (e) {
            console.error("[FRONTEND-ERROR] Errore critico nel flusso di salvataggio:", e);
            showToast("Errore durante il salvataggio: " + e.message, "error");
            btnSave.disabled = false;
            clearElement(btnSave);
            setChildren(btnSave, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
            ]);
        }
    });
}

/**
 * SISTEMA ALLEGATI (V4.1)
 * Gestione Modali, Picker e Render
 */
async function showSuccessModal() {
    window.location.href = 'scadenze.html';
}

async function loadScadenzaForEdit(id) {
    try {
        const data = await getDeadline(currentUser.uid, id);
        if (!data) {
            showToast("Scadenza non trovata", "error");
            return;
        }
        linkedSourceRef = data.sourceRef || null;

        // 1. Identifica il Mode corretto in base al tipo salvato
        const foundMode = configController.getModeForDeadlineType(data.type);

        // 2. Imposta il Mode (popola i select nativi)
        setMode(foundMode);

        // 3. Riempi i campi base e i menu a tendina
        document.getElementById('nome_cognome').value = data.name || '';
        if (typeSelect && data.type) typeSelect.value = data.type;

        const modVeicolo = document.getElementById('modello_veicolo');
        if (modVeicolo && data.veicolo_modello) modVeicolo.value = data.veicolo_modello;

        const notifChannel = document.getElementById('notif_channel_select');
        if (notifChannel && data.notifChannel) notifChannel.value = data.notifChannel;
        const dateInput = document.getElementById('dueDate');
        const dateFields = deadlineDateInputFields(data);
        dateInput.value = dateFields.displayValue;
        dateInput.dataset.isoValue = dateFields.isoValue;
        const referenceUrlInput = document.getElementById('deadline_url');
        if (referenceUrlInput) referenceUrlInput.value = data.referenceUrl || data.url || '';
        document.getElementById('notes').value = data.notes || '';

        // 4. Notifiche (Valori numerici)
        const dNotice = document.getElementById('display_notif_days');
        const iNotice = document.getElementById('notif_days_before');
        const period = data.notif_days_before || data.period || '14';
        if (dNotice) dNotice.textContent = period;
        if (iNotice) iNotice.value = period;

        const dFreq = document.getElementById('display_notif_freq');
        const iFreq = document.getElementById('notif_frequency');
        const freq = data.notif_frequency || data.freq || '7';
        if (dFreq) dFreq.textContent = freq;
        if (iFreq) iFreq.value = freq;


        recipientController.setRecipients(deadlineRecipientsFromRecord(data));

        const testoEmailSelect = document.getElementById('testo_email_select');
        if (data.templateText && testoEmailSelect) {
            const opt = Array.from(testoEmailSelect.options).find(o => o.value === data.templateText);
            if (opt) { testoEmailSelect.value = data.templateText; }
        }

        // 6. Allegati esistenti
        attachmentController.setExistingAttachments(data.attachments);

        // 7. Sincronizzazione Dropdown Custom (V4.1 System)
        syncCustomDropdowns();

        // 8. Refresh Anteprima Oggetto
        updatePreview();

    } catch (e) {
        console.error("Errore caricamento modifica:", e);
        showToast("Errore nel caricamento dei dati", "error");
    }
}

/**
 * CUSTOM PREMIUM DROPDOWNS (PROXY SYSTEM)
 * Sincronizza i div 'base-dropdown' con i select nativi (hidden).
 */
function initProxyDropdowns() {
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.dropdown-trigger');
        const container = trigger?.closest('[data-custom-select]');
        const menu = container?.querySelector('.base-dropdown-menu');

        // Chiudi tutti gli altri
        document.querySelectorAll('.base-dropdown-menu.show').forEach(m => {
            if (m !== menu) m.classList.remove('show');
        });

        if (trigger && menu) {
            e.stopPropagation();
            menu.classList.toggle('show');
        } else {
            document.querySelectorAll('.base-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        }
    });

    // Auto-Sync iniziale e osservazione cambiamenti
    syncCustomDropdowns();
}

function syncCustomDropdowns() {
    document.querySelectorAll('[data-custom-select]').forEach(container => {
        const select = container.querySelector('select');
        const trigger = container.querySelector('.dropdown-trigger');
        const labelEl = container.querySelector('.dropdown-label');
        const menu = container.querySelector('.base-dropdown-menu');

        if (!select || !trigger || !menu) return;

        // Reset menu
        clearElement(menu);

        // Build items
        Array.from(select.children).forEach(child => {
            if (child.tagName === 'OPTGROUP') {
                menu.appendChild(createElement('div', { className: 'base-dropdown-group-label', textContent: child.label }));
                Array.from(child.children).forEach(opt => createItem(opt, menu, select, labelEl));
            } else {
                createItem(child, menu, select, labelEl);
            }
        });

        // Sync Label
        const updateSelectionUI = () => {
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt) {
                labelEl.textContent = selectedOpt.textContent;
                if (selectedOpt.dataset.t) labelEl.setAttribute('data-t', selectedOpt.dataset.t);
                else labelEl.removeAttribute('data-t');

                // Sync Active Class in menu
                menu.querySelectorAll('.base-dropdown-item').forEach(i => {
                    i.classList.toggle('active', i.dataset.value === select.value);
                });
            }

            if (['testo_email_select', 'modello_veicolo'].includes(select.id)) {
                if (typeof updatePreview === 'function') updatePreview();
            }
        };

        updateSelectionUI();

        // Ri-sincronizza se il select cambia (programmaticamente o via proxy)
        if (!select._proxyInit) {
            select.addEventListener('change', updateSelectionUI);
            // Osserva se cambiano le opzioni (es. populateTypeSelect)
            const observer = new MutationObserver(() => syncCustomDropdowns());
            observer.observe(select, { childList: true });
            select._proxyInit = true;
        }

        function createItem(opt, parent, sel, lab) {
            const item = createElement('div', {
                className: `base-dropdown-item ${opt.selected ? 'active' : ''}`,
                dataset: { value: opt.value }
            }, [
                createElement('span', {
                    textContent: opt.textContent,
                    className: 'truncate',
                    dataset: opt.dataset.t ? { t: opt.dataset.t } : {}
                })
            ]);

            // Add delete button for user-defined items (skip placeholders or manual triggers)
            const isUserItem = opt.value && !['manual', ''].includes(opt.value);
            const isManageable = ['tipo_scadenza', 'modello_veicolo', 'testo_email_select', 'email_primaria_select', 'email_secondaria_select'].includes(sel.id);

            if (isUserItem && isManageable) {
                const actions = createElement('div', { className: 'dropdown-item-actions' });

                const editBtn = createElement('button', {
                    type: 'button',
                    className: 'btn-edit-opt',
                    title: 'Modifica voce',
                    onclick: (e) => {
                        e.stopPropagation();
                        configController.editItem(sel.id, opt.value);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
                ]);

                const delBtn = createElement('button', {
                    type: 'button',
                    className: 'btn-delete-opt',
                    title: 'Elimina voce',
                    onclick: (e) => {
                        e.stopPropagation();
                        configController.deleteItem(sel.id, opt.value);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
                ]);

                actions.appendChild(editBtn);
                actions.appendChild(delBtn);
                item.appendChild(actions);
            }

            if (opt.dataset.t) item.setAttribute('data-t', opt.dataset.t);

            item.onclick = (e) => {
                e.stopPropagation();
                sel.value = opt.value;
                sel.dispatchEvent(new Event('change'));

                // --- Nuovo: Aggiorna campi notifica se presenti nel dataset dell'opzione ---
                if (sel.id === 'tipo_scadenza') {
                    if (opt.dataset.period) {
                        const displayPeriod = document.getElementById('display_notif_days');
                        const inputPeriod = document.getElementById('notif_days_before');
                        if (displayPeriod) displayPeriod.textContent = opt.dataset.period;
                        if (inputPeriod) inputPeriod.value = opt.dataset.period;
                    }
                    if (opt.dataset.freq) {
                        const displayFreq = document.getElementById('display_notif_freq');
                        const inputFreq = document.getElementById('notif_frequency');
                        if (displayFreq) displayFreq.textContent = opt.dataset.freq;
                        if (inputFreq) inputFreq.value = opt.dataset.freq;
                    }
                }

                parent.classList.remove('show');
            };
            parent.appendChild(item);
        }
    });
}

function updatePreview() {
    const previewArea = document.getElementById('oggetto_email');
    if (!previewArea) return;

    const templateText = document.getElementById('testo_email_select')?.value || '';
    if (!templateText) {
        previewArea.value = '';
        return;
    }

    let compiledText = '';
    if (currentMode === 'automezzi') {
        const vehicle = document.getElementById('modello_veicolo')?.value || '';
        const vehicleStr = vehicle ? ` ${vehicle.trim()}` : '';
        compiledText = `E' in scadenza ${templateText.trim()}${vehicleStr}`;
    } else if (currentMode === 'documenti') {
        const vehicle = document.getElementById('modello_veicolo')?.value || '';
        let code = vehicle.trim();
        if (code.includes(' - ')) {
            code = code.split(' - ')[1].trim();
        }
        const vehicleStr = code ? ` ${code}` : '';
        compiledText = `E' in scadenza ${templateText.trim()}${vehicleStr}`;
    } else {
        compiledText = `E' in scadenza ${templateText.trim()}`;
    }

    previewArea.value = compiledText;
}
