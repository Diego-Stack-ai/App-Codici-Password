import { db } from '../../firebase-config.js?v=1.2.80';
import { doc, setDoc } from '/assets/js/vendor/firebase-runtime.js';
import { clearElement } from '../../dom-utils.js';
import { showConfirmModal, showInputModal, showToast } from '../../ui-core-v129.js';
import { getUserProfile, getUserSetting, listContacts } from '../data/vault-repository.js';
import { normalizeRecipientEmail } from './deadline-recipient-model.js';
import {
    appendDeadlineListItem,
    appendDeadlineType,
    normalizeDeadlineConfig,
    removeDeadlineListItem,
    updateDeadlineListItem,
    updateDeadlineType
} from './deadline-config-model.js';

const EMPTY_CONFIG = Object.freeze({
    deadlineTypes: [],
    models: [],
    emailTemplates: [],
    names: [],
    notificationEmails: []
});

const DEFAULT_CONFIGS = Object.freeze({
    automezzi: {
        deadlineTypes: [
            { name: 'Revisione Moto', freq: 7, period: 14 },
            { name: 'Assicurazione', freq: 7, period: 14 },
            { name: 'Revisione Auto', freq: 7, period: 14 },
            { name: 'Bollo', freq: 7, period: 14 },
            { name: 'Tagliando', freq: 7, period: 28 },
            { name: 'Olio motore', freq: 7, period: 14 }
        ],
        models: [],
        emailTemplates: [
            "l'assicurazione del motociclo targato",
            "l'assicurazione dell'auto targata",
            "la revisione del motociclo targato",
            "la revisione dell'auto targata",
            'Il bollo del motociclo targato',
            "Il bollo dell'auto targata",
            'Il tagliando del motociclo targato',
            "Il tagliando dell'auto targata",
            'Il bollo del carrello targato',
            'Olio motore da controllare'
        ]
    },
    documenti: {
        deadlineTypes: [
            { name: 'Patente', freq: 7, period: 56 },
            { name: 'Carta Identità', freq: 14, period: 56 },
            { name: 'Passaporto', freq: 14, period: 28 },
            { name: 'Codice fiscale', freq: 7, period: 56 }
        ],
        models: [],
        emailTemplates: [
            'la tua patente',
            'Il tuo documento di Identità',
            'Il tuo passaporto',
            'Il tuo codice fiscale'
        ]
    },
    generali: {
        deadlineTypes: [
            { name: 'Sale Addolcitore', freq: 7, period: 14 },
            { name: "Comodato d'uso", freq: 7, period: 28 },
            { name: 'Federazione Italiana Vela', freq: 7, period: 70 },
            { name: 'Visita medica', freq: 7, period: 14 },
            { name: 'Contratto', freq: 7, period: 14 },
            { name: 'Tessera isola ecologica', freq: 7, period: 14 }
        ],
        emailTemplates: [
            "Il sale dell'addolcitore",
            "Il comodato d'uso dell'auto targata",
            "E' in scadenza il tuo certificato medico",
            "E' in scadenza la tua tessera FIV",
            'Isola ecologica'
        ]
    }
});

const MODE_DOCUMENTS = Object.freeze({
    automezzi: 'deadlineConfig',
    documenti: 'deadlineConfigDocuments',
    generali: 'generalConfig'
});

const LIST_FIELDS = ['deadlineTypes', 'models', 'emailTemplates', 'names', 'notificationEmails'];

function configTarget(selectId, mode) {
    if (selectId === 'tipo_scadenza') return { field: 'deadlineTypes', docName: MODE_DOCUMENTS[mode] };
    if (selectId === 'modello_veicolo' && mode !== 'generali') return { field: 'models', docName: MODE_DOCUMENTS[mode] };
    if (selectId === 'testo_email_select') return { field: 'emailTemplates', docName: MODE_DOCUMENTS[mode] };
    if (selectId === 'email_primaria_select' || selectId === 'email_secondaria_select') {
        return { field: 'notificationEmails', docName: MODE_DOCUMENTS[mode] };
    }
    return null;
}

function itemName(item) {
    return typeof item === 'object' ? item?.name : item;
}

export function createDeadlineConfigController({ recipientController, onRender = () => {} } = {}) {
    let user = null;
    let mode = 'automezzi';
    let emailSeeded = false;
    let configs = { automezzi: null, documenti: null, generali: null };

    const currentConfig = () => configs[mode] || { ...EMPTY_CONFIG };

    function populateSimpleSelect(select, options = []) {
        const currentValue = select.value;
        clearElement(select);
        select.appendChild(new Option('Seleziona...', ''));
        options.forEach(option => select.appendChild(new Option(option, option)));
        if (currentValue && options.includes(currentValue)) select.value = currentValue;
    }

    function populateEmailSelects(emails = []) {
        ['email_primaria_select', 'email_secondaria_select'].forEach(id => {
            const select = document.getElementById(id);
            if (!select) return;
            const currentValue = select.value;
            clearElement(select);
            select.appendChild(new Option('Seleziona email...', ''));
            emails.forEach(email => select.appendChild(new Option(email, email)));
            if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) {
                select.value = currentValue;
            } else if (currentValue && currentValue !== 'manual') {
                select.appendChild(new Option(currentValue, currentValue));
                select.value = currentValue;
            }
        });
    }

    function render() {
        const config = currentConfig();
        const typeSelect = document.getElementById('tipo_scadenza');
        if (typeSelect) {
            const currentValue = typeSelect.value;
            clearElement(typeSelect);
            typeSelect.appendChild(new Option('Scegli categoria...', ''));
            (config.deadlineTypes || []).forEach(item => {
                const name = itemName(item);
                const option = new Option(name, name);
                if (typeof item === 'object') {
                    if (item.period !== undefined) option.dataset.period = item.period;
                    if (item.freq !== undefined) option.dataset.freq = item.freq;
                }
                typeSelect.appendChild(option);
            });
            typeSelect.value = currentValue && Array.from(typeSelect.options).some(option => option.value === currentValue)
                ? currentValue
                : '';
        }

        const modelSelect = document.getElementById('modello_veicolo');
        if (modelSelect && mode !== 'generali') populateSimpleSelect(modelSelect, config.models || []);

        const templateSelect = document.getElementById('testo_email_select');
        if (templateSelect) {
            document.getElementById('testo_email_wrapper')?.classList.remove('hidden');
            populateSimpleSelect(templateSelect, [...new Set(config.emailTemplates || [])]);
        }

        // Compatibilità con le vecchie select: la rubrica destinatari resta la fonte primaria.
        populateEmailSelects(configs.generali?.notificationEmails || []);

        const namesList = document.getElementById('names-list');
        if (namesList) {
            clearElement(namesList);
            const names = [...new Set([
                ...(config.names || []),
                ...(recipientController?.getContacts?.() || [])
                    .map(contact => [contact.nome, contact.cognome].filter(Boolean).join(' ').trim())
                    .filter(Boolean)
            ])].sort((a, b) => a.localeCompare(b, 'it'));
            names.forEach(name => namesList.appendChild(new Option(name, name)));
        }
        onRender();
    }

    async function load(nextUser) {
        user = nextUser;
        if (!user) return;

        const [autoConfig, documentConfig, generalConfig, profile, contacts] = await Promise.all([
            getUserSetting(user.uid, MODE_DOCUMENTS.automezzi),
            getUserSetting(user.uid, MODE_DOCUMENTS.documenti),
            getUserSetting(user.uid, MODE_DOCUMENTS.generali),
            getUserProfile(user.uid),
            listContacts(user.uid)
        ]);

        const rawGeneral = { ...(generalConfig || {}) };
        let notificationEmails = Array.isArray(rawGeneral.notificationEmails) ? rawGeneral.notificationEmails : [];
        if (notificationEmails.length === 0 && profile) {
            notificationEmails = (profile.contactEmails || []).filter(entry => entry?.address).map(entry => entry.address);
            rawGeneral.notificationEmails = notificationEmails;
            if (notificationEmails.length > 0 && !emailSeeded) {
                await setDoc(doc(db, 'users', user.uid, 'settings', MODE_DOCUMENTS.generali), { notificationEmails }, { merge: true });
                emailSeeded = true;
            }
        }

        const recipientContacts = (contacts || []).filter(contact => contact.active !== false);
        notificationEmails.forEach(email => {
            const normalized = normalizeRecipientEmail(email);
            if (normalized && !recipientContacts.some(contact => normalizeRecipientEmail(contact.email) === normalized)) {
                recipientContacts.push({ id: '', nome: 'Email salvata', cognome: '', email: normalized });
            }
        });
        recipientController?.setContacts?.(recipientContacts);

        configs.automezzi = normalizeDeadlineConfig(autoConfig || DEFAULT_CONFIGS.automezzi, LIST_FIELDS);
        configs.documenti = normalizeDeadlineConfig(documentConfig || DEFAULT_CONFIGS.documenti, LIST_FIELDS);

        const needsGeneralSeed = !generalConfig || !Array.isArray(rawGeneral.deadlineTypes) || rawGeneral.deadlineTypes.length === 0;
        const mergedGeneral = needsGeneralSeed
            ? {
                ...DEFAULT_CONFIGS.generali,
                ...rawGeneral,
                deadlineTypes: DEFAULT_CONFIGS.generali.deadlineTypes,
                emailTemplates: Array.isArray(rawGeneral.emailTemplates) && rawGeneral.emailTemplates.length > 0
                    ? rawGeneral.emailTemplates
                    : DEFAULT_CONFIGS.generali.emailTemplates,
                notificationEmails
            }
            : rawGeneral;
        configs.generali = normalizeDeadlineConfig(mergedGeneral, LIST_FIELDS);

        const seeds = [];
        if (!autoConfig) seeds.push(setDoc(doc(db, 'users', user.uid, 'settings', MODE_DOCUMENTS.automezzi), DEFAULT_CONFIGS.automezzi));
        if (!documentConfig) seeds.push(setDoc(doc(db, 'users', user.uid, 'settings', MODE_DOCUMENTS.documenti), DEFAULT_CONFIGS.documenti));
        if (needsGeneralSeed) {
            seeds.push(setDoc(doc(db, 'users', user.uid, 'settings', MODE_DOCUMENTS.generali), {
                ...DEFAULT_CONFIGS.generali,
                notificationEmails
            }, { merge: true }));
        }
        await Promise.all(seeds);
        render();
    }

    async function persist(selectId, nextConfig) {
        const target = configTarget(selectId, mode);
        if (!user || !target) return false;
        configs[mode] = nextConfig;
        try {
            await setDoc(doc(db, 'users', user.uid, 'settings', target.docName), {
                [target.field]: nextConfig[target.field]
            }, { merge: true });
            render();
            return true;
        } catch (error) {
            console.error('Deadline config update failed', error);
            showToast("Errore durante l'aggiornamento", 'error');
            return false;
        }
    }

    async function addItem(selectId, value) {
        const target = configTarget(selectId, mode);
        if (!target) return;
        const config = currentConfig();
        const exists = (config[target.field] || []).some(item => itemName(item) === itemName(value));
        if (exists) return showToast('Valore già esistente', 'info');
        const nextConfig = target.field === 'deadlineTypes'
            ? appendDeadlineType(config, value)
            : appendDeadlineListItem(config, target.field, value);
        nextConfig[target.field].sort((a, b) => String(itemName(a)).localeCompare(String(itemName(b)), 'it'));
        if (await persist(selectId, nextConfig)) {
            showToast('Lista aggiornata!', 'success');
            setTimeout(() => {
                const select = document.getElementById(selectId);
                if (!select) return;
                select.value = itemName(value);
                select.dispatchEvent(new Event('change'));
            }, 100);
        }
    }

    async function editItem(selectId, oldValue) {
        const target = configTarget(selectId, mode);
        if (!target) return;
        const newValue = await showInputModal('Modifica Voce', oldValue, 'Inserisci nuovo valore...');
        if (!newValue?.trim() || newValue.trim() === oldValue) return;
        const config = currentConfig();
        const index = (config[target.field] || []).findIndex(item => itemName(item) === oldValue);
        if (index < 0) return;
        const nextConfig = target.field === 'deadlineTypes'
            ? updateDeadlineType(config, index, { ...config[target.field][index], name: newValue.trim() })
            : updateDeadlineListItem(config, target.field, index, newValue);
        nextConfig[target.field].sort((a, b) => String(itemName(a)).localeCompare(String(itemName(b)), 'it'));
        if (await persist(selectId, nextConfig)) showToast('Voce modificata!', 'success');
    }

    async function deleteItem(selectId, value) {
        const confirmed = await showConfirmModal(
            'Elimina Voce',
            `Sei sicuro di voler eliminare "${value}"? Questa azione non influirà sulle scadenze esistenti, ma la voce non sarà più disponibile per le nuove.`
        );
        if (!confirmed) return;
        const target = configTarget(selectId, mode);
        if (!target) return;
        const config = currentConfig();
        const index = (config[target.field] || []).findIndex(item => itemName(item) === value);
        if (index < 0) return;
        const nextConfig = removeDeadlineListItem(config, target.field, index);
        if (await persist(selectId, nextConfig)) showToast('Voce eliminata', 'success');
    }

    function initManagementButtons() {
        document.querySelectorAll('.btn-manage-config-inline[data-config-id]').forEach(button => {
            button.onclick = async event => {
                event.stopPropagation();
                const selectId = button.dataset.configId;
                if (selectId === 'tipo_scadenza') {
                    const name = await showInputModal('Aggiungi Nuova Categoria', '', 'Nome categoria...');
                    if (!name?.trim()) return;
                    const period = await showInputModal('Giorni di preavviso', '14', 'Inserisci giorni (es. 14)');
                    if (period === null) return;
                    const freq = await showInputModal('Frequenza notifica', '7', 'Inserisci giorni (es. 7)');
                    if (freq === null) return;
                    await addItem(selectId, {
                        name: name.trim(),
                        period: Number.parseInt(period, 10) || 14,
                        freq: Number.parseInt(freq, 10) || 7
                    });
                    return;
                }
                const value = await showInputModal('Aggiungi Nuovo', '', 'Inserisci nuovo valore...');
                if (value?.trim()) await addItem(selectId, value.trim());
            };
        });
    }

    return Object.freeze({
        addItem,
        deleteItem,
        editItem,
        getModeForDeadlineType(type) {
            if (configs.documenti?.deadlineTypes?.some(item => itemName(item) === type)) return 'documenti';
            if (configs.generali?.deadlineTypes?.some(item => itemName(item) === type)) return 'generali';
            return 'automezzi';
        },
        initManagementButtons,
        load,
        render,
        setMode(nextMode) {
            if (!MODE_DOCUMENTS[nextMode]) return;
            mode = nextMode;
            render();
        }
    });
}
