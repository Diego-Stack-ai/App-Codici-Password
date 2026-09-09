import { db, functions } from '../../firebase-config.js?v=1.2.73';
import { addDoc, collection, doc, httpsCallable, serverTimestamp, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { clearElement, createElement, setChildren } from '../../dom-utils.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { listContacts } from '../data/vault-repository.js';

let currentUser = null;
let contacts = [];
let editingId = '';

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function resetForm() {
    editingId = '';
    document.getElementById('recipient-first-name').value = '';
    document.getElementById('recipient-last-name').value = '';
    document.getElementById('recipient-email').value = '';
    document.getElementById('recipient-form-title').textContent = 'Nuovo destinatario';
    document.getElementById('recipient-save').textContent = 'Salva destinatario';
    document.getElementById('recipient-cancel').classList.add('hidden');
}

function editContact(contact) {
    editingId = contact.id;
    document.getElementById('recipient-first-name').value = contact.nome || '';
    document.getElementById('recipient-last-name').value = contact.cognome || '';
    document.getElementById('recipient-email').value = contact.email || '';
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
            ...(contact.active === false ? [createElement('span', { className: 'recipient-card-status', textContent: 'Disattivato' })] : [])
        ]),
        createElement('div', { className: 'recipient-card-actions' }, [
            createElement('button', { type: 'button', className: 'recipient-icon-button', title: 'Modifica', onclick: () => editContact(contact) }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ]),
            createElement('button', { type: 'button', className: 'recipient-icon-button', title: contact.active === false ? 'Riattiva' : 'Disattiva', onclick: () => toggleActive(contact) }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: contact.active === false ? 'person_check' : 'person_off' })
            ]),
            createElement('button', { type: 'button', className: 'recipient-icon-button action-delete', title: 'Elimina', onclick: () => deleteContact(contact) }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
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

async function saveContact() {
    const nome = document.getElementById('recipient-first-name').value.trim();
    const cognome = document.getElementById('recipient-last-name').value.trim();
    const email = normalizeEmail(document.getElementById('recipient-email').value);
    if (!nome) return showToast('Inserisci il nome o una descrizione.', 'warning');
    if (!validEmail(email)) return showToast('Inserisci un indirizzo email valido.', 'warning');
    if (contacts.some(contact => contact.id !== editingId && normalizeEmail(contact.email) === email)) {
        return showToast('Questa email è già presente nella rubrica.', 'warning');
    }
    const existing = contacts.find(contact => contact.id === editingId);
    const data = { nome, cognome, email, emailNormalized: email, active: existing?.active !== false, updatedAt: serverTimestamp() };
    if (editingId) await updateDoc(doc(db, 'users', currentUser.uid, 'contacts', editingId), data);
    else await addDoc(collection(db, 'users', currentUser.uid, 'contacts'), { ...data, createdAt: serverTimestamp() });
    showToast(editingId ? 'Destinatario aggiornato.' : 'Destinatario salvato.', 'success');
    resetForm();
    await loadContacts();
}

export async function initGestioneDestinatari(user) {
    currentUser = user;
    const returnTarget = new URLSearchParams(window.location.search).get('return');
    const returnLink = document.getElementById('recipient-return');
    if (returnTarget && /^[a-z0-9_-]+\.html(?:\?[^#]*)?$/i.test(returnTarget)) {
        returnLink.href = returnTarget;
        returnLink.classList.remove('hidden');
    }
    document.getElementById('recipient-save')?.addEventListener('click', () => saveContact().catch(error => showToast(error.message, 'error')));
    document.getElementById('recipient-cancel')?.addEventListener('click', resetForm);
    await loadContacts();
}
