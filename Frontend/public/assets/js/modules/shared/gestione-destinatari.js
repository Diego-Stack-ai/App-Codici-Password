import { db, functions } from '../../firebase-config.js?v=1.2.244';
import { addDoc, collection, doc, httpsCallable, serverTimestamp, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { clearElement, createElement, setChildren } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { listCompanies, listContacts } from '../data/vault-repository.js';
import {
    contactCompanyAssociations,
    normalizeDeadlineCompanyContext,
    replaceContactCompanyAssociations
} from '../scadenze/deadline-recipient-model.js';

let currentUser = null;
let contacts = [];
let companies = [];
let editingId = '';
let requestedCompanyContext = null;
let associationCatalog = [];
const ALLOWED_RETURN_PAGES = new Set([
    'aggiungi_scadenza.html',
    'form_account_azienda.html',
    'form_account_privato.html'
]);

function safeReturnTarget(value) {
    const target = String(value || '').trim();
    if (!/^[a-z0-9_-]+\.html(?:\?[^#]*)?$/i.test(target)) return '';
    const page = target.split('?')[0];
    return ALLOWED_RETURN_PAGES.has(page) ? target : '';
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function companyName(company = {}) {
    return String(company.ragioneSociale || company.denominazione || company.nome || '').trim();
}

function associationKey(context) {
    const normalized = normalizeDeadlineCompanyContext(context);
    if (!normalized) return '';
    return normalized.kind === 'company'
        ? `company:${normalized.companyId}`
        : `external:${normalized.companyName.toLocaleLowerCase('it')}`;
}

function buildAssociationCatalog() {
    const available = [
        ...companies.map(company => normalizeDeadlineCompanyContext({
            kind: 'company', companyId: company.id, companyName: companyName(company)
        })),
        ...contacts.flatMap(contactCompanyAssociations),
        requestedCompanyContext
    ].filter(Boolean);
    const unique = new Map();
    available.forEach(context => unique.set(associationKey(context), context));
    associationCatalog = [...unique.values()].sort((left, right) => left.companyName.localeCompare(right.companyName, 'it', {sensitivity: 'base'}));
}

function renderCompanyOptions(selected = []) {
    const container = document.getElementById('recipient-company-options');
    if (!container) return;
    buildAssociationCatalog();
    clearElement(container);
    const selectedKeys = new Set(selected.map(associationKey));
    if (!associationCatalog.length) {
        container.appendChild(createElement('p', {
            className: 'recipient-company-empty',
            textContent: 'Nessuna azienda disponibile. Il destinatario resterà privato.'
        }));
        return;
    }
    associationCatalog.forEach(context => {
        const key = associationKey(context);
        container.appendChild(createElement('label', {className: 'recipient-company-option'}, [
            createElement('input', {
                type: 'checkbox',
                value: key,
                checked: selectedKeys.has(key),
                dataset: {associationKey: key}
            }),
            document.createTextNode(context.companyName)
        ]));
    });
}

function selectedCompanyAssociations() {
    const selected = new Set([...document.querySelectorAll('#recipient-company-options input[data-association-key]:checked')]
        .map(input => input.dataset.associationKey));
    return associationCatalog.filter(context => selected.has(associationKey(context)));
}

function resetForm() {
    editingId = '';
    document.getElementById('recipient-first-name').value = '';
    document.getElementById('recipient-last-name').value = '';
    document.getElementById('recipient-email').value = '';
    document.getElementById('recipient-form-title').textContent = 'Nuovo destinatario';
    document.getElementById('recipient-save').textContent = 'Salva destinatario';
    document.getElementById('recipient-cancel').classList.add('hidden');
    renderCompanyOptions(requestedCompanyContext ? [requestedCompanyContext] : []);
}

function editContact(contact) {
    editingId = contact.id;
    document.getElementById('recipient-first-name').value = contact.nome || '';
    document.getElementById('recipient-last-name').value = contact.cognome || '';
    document.getElementById('recipient-email').value = contact.email || '';
    renderCompanyOptions(contactCompanyAssociations(contact));
    document.getElementById('recipient-form-title').textContent = 'Modifica destinatario';
    document.getElementById('recipient-save').textContent = 'Aggiorna destinatario';
    document.getElementById('recipient-cancel').classList.remove('hidden');
    document.getElementById('recipient-first-name').focus();
}

function usageMessage(usage = {}) {
    const parts = [];
    if (usage.deadlines) parts.push(`${usage.deadlines} Scadenze`);
    if (usage.shares) parts.push(`${usage.shares} condivisioni account`);
    if (usage.invites) parts.push(`${usage.invites} inviti`);
    return parts.join(' e ') || 'uno dei servizi collegati';
}

async function deleteContact(contact) {
    if (!await showConfirmModal('Elimina destinatario', `Vuoi eliminare ${contact.nome || contact.email}? Il controllo comprende Scadenze e condivisioni.`)) return;
    try {
        const removeContact = httpsCallable(functions, 'deleteContactIfUnused');
        const result = await removeContact({ contactId: contact.id });
        if (!result.data?.deleted) {
            showToast(`Impossibile eliminare: il destinatario è usato in ${usageMessage(result.data?.usage)}. Puoi disattivarlo.`, 'warning');
            return;
        }
        showToast('Destinatario eliminato.', 'success');
        await loadContacts();
    } catch (error) {
        showToast(error?.message || 'Controllo utilizzo non riuscito.', 'error');
    }
}

async function toggleActive(contact) {
    await updateDoc(doc(db, 'users', currentUser.uid, 'contacts', contact.id), {
        active: contact.active === false,
        updatedAt: serverTimestamp()
    });
    showToast(contact.active === false ? 'Destinatario riattivato.' : 'Destinatario disattivato.', 'success');
    await loadContacts();
}

function renderContacts() {
    const list = document.getElementById('recipient-list');
    clearElement(list);
    document.getElementById('recipient-count').textContent = String(contacts.length);
    if (!contacts.length) {
        list.appendChild(createElement('p', { className: 'recipient-card-email', textContent: 'Nessun destinatario salvato.' }));
        return;
    }
    const cards = contacts.map(contact => createElement('article', { className: `recipient-card${contact.active === false ? ' is-inactive' : ''}` }, [
        createElement('div', { className: 'recipient-card-copy' }, [
            createElement('span', { className: 'recipient-card-name', textContent: [contact.nome, contact.cognome].filter(Boolean).join(' ') || 'Destinatario' }),
            createElement('span', { className: 'recipient-card-email', textContent: contact.email }),
            ...(contactCompanyAssociations(contact).length ? [createElement('span', {
                className: 'recipient-card-associations',
                textContent: `Aziende: ${contactCompanyAssociations(contact).map(item => item.companyName).join(', ')}`
            })] : [createElement('span', {className: 'recipient-card-associations'}, [document.createTextNode('Privato')])]),
            ...(contact.active === false ? [createElement('span', { className: 'recipient-card-status', textContent: 'Disattivato' })] : [])
        ]),
        createElement('div', { className: 'recipient-card-actions' }, [
            createElement('button', { type: 'button', className: 'recipient-icon-button', title: 'Modifica', onclick: () => editContact(contact) }, [
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'edit' })
            ]),
            createElement('button', { type: 'button', className: 'recipient-icon-button', title: contact.active === false ? 'Riattiva' : 'Disattiva', onclick: () => toggleActive(contact) }, [
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: contact.active === false ? 'person_off' : 'person_check' })
            ]),
            createElement('button', { type: 'button', className: 'recipient-icon-button action-delete', title: 'Elimina', onclick: () => deleteContact(contact) }, [
                createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'delete' })
            ])
        ])
    ]));
    setChildren(list, cards);
}

async function loadContacts() {
    contacts = (await listContacts(currentUser.uid))
        .sort((a, b) => `${a.nome || ''} ${a.cognome || ''}`.localeCompare(`${b.nome || ''} ${b.cognome || ''}`, 'it'));
    renderContacts();
}

async function loadCompanies() {
    try {
        companies = (await listCompanies(currentUser.uid)).filter(company => company.id && companyName(company));
    } catch {
        companies = [];
    }
}

async function saveContact() {
    const nome = document.getElementById('recipient-first-name').value.trim();
    const cognome = document.getElementById('recipient-last-name').value.trim();
    const email = normalizeEmail(document.getElementById('recipient-email').value);
    if (!nome) return showToast('Inserisci il nome o una descrizione.', 'warning');
    if (!validEmail(email)) return showToast('Inserisci un indirizzo email valido.', 'warning');
    const duplicate = contacts.find(contact => contact.id !== editingId && normalizeEmail(contact.email) === email);
    if (duplicate) {
        editContact(duplicate);
        showToast('Questa email è già presente. Ho aperto il destinatario esistente: scegli qui i collegamenti corretti.', 'warning');
        return;
    }
    const existing = contacts.find(contact => contact.id === editingId);
    const selectedAssociations = selectedCompanyAssociations();
    const previousAssociations = contactCompanyAssociations(existing || {});
    const selectedKeys = new Set(selectedAssociations.map(associationKey));
    const removed = previousAssociations.filter(context => !selectedKeys.has(associationKey(context)));
    if (removed.length) {
        const confirmed = await showConfirmModal(
            'Rimuovi collegamenti aziendali',
            `Vuoi rimuovere il collegamento a ${removed.map(item => item.companyName).join(', ')}? Le Scadenze già salvate non verranno modificate.`,
            'Rimuovi collegamento',
            'Annulla'
        );
        if (!confirmed) return;
    }
    const scoped = replaceContactCompanyAssociations(existing || {}, selectedAssociations);
    const data = {
        nome, cognome, email, emailNormalized: email,
        active: existing?.active !== false,
        companyAssociations: scoped.companyAssociations,
        updatedAt: serverTimestamp()
    };
    if (editingId) await updateDoc(doc(db, 'users', currentUser.uid, 'contacts', editingId), data);
    else await addDoc(collection(db, 'users', currentUser.uid, 'contacts'), { ...data, createdAt: serverTimestamp() });
    showToast(editingId ? 'Destinatario aggiornato.' : 'Destinatario salvato.', 'success');
    resetForm();
    await loadContacts();
}

export async function initGestioneDestinatari(user) {
    currentUser = user;
    const query = new URLSearchParams(window.location.search);
    const returnTarget = safeReturnTarget(query.get('return'));
    requestedCompanyContext = normalizeDeadlineCompanyContext({
        kind: query.get('companyKind'),
        companyId: query.get('companyId'),
        companyName: query.get('companyName')
    });
    const companyContext = document.getElementById('recipient-company-context');
    if (requestedCompanyContext && companyContext) {
        document.getElementById('recipient-company-context-name').textContent = requestedCompanyContext.companyName;
        companyContext.classList.remove('hidden');
    }
    const returnLink = document.getElementById('recipient-return');
    if (returnTarget) {
        returnLink.href = returnTarget;
        returnLink.classList.remove('hidden');
    }
    document.getElementById('recipient-save')?.addEventListener('click', () => saveContact().catch(error => showToast(error.message, 'error')));
    document.getElementById('recipient-cancel')?.addEventListener('click', resetForm);
    await Promise.all([loadCompanies(), loadContacts()]);
    resetForm();
}
