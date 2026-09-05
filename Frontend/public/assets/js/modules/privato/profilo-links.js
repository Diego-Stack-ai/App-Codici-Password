import { getDocsSmart as getDocs } from "/assets/js/offline-firestore.js";
import { auth, db } from '../../firebase-config.js?v=1.2.42';
import { collection, doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { decrypt, ensureMasterKey } from '../core/security-manager.js';
import { showProfileModal } from './profilo-modal.js';

export function openLinkedAccount(accountId) {
    if (accountId) window.location.href = `dettaglio_account_privato.html?id=${encodeURIComponent(accountId)}`;
}

export async function connectEmailAccount(email, syncData) {
    const user = auth.currentUser;
    if (!user || !email?.id) return;
    const snapshot = await getDocs(collection(db, 'users', user.uid, 'accounts'));
    const masterKey = await ensureMasterKey();
    const accounts = await Promise.all(snapshot.docs.map(async item => {
        const data = item.data();
        let username = '';
        try { username = data._encrypted && data.username ? await decrypt(data.username, masterKey) : (data.username || ''); } catch { username = ''; }
        return { id: item.id, name: data.nomeAccount || 'Account', username };
    }));
    if (accounts.length === 0) {
        const create = await showConfirmModal('Account email assente', 'Non esiste ancora un Account collegabile. Vuoi aprire la creazione guidata?');
        if (!create) return;
        await syncData();
        sessionStorage.setItem('profile-account-link-draft', JSON.stringify({ profileEmailId: email.id, email: email.address || '' }));
        window.location.href = `form_account_privato.html?profileEmailId=${encodeURIComponent(email.id)}`;
        return;
    }
    const labels = accounts.map(account => `${account.name}${account.username ? ` — ${account.username}` : ''} · ${account.id.slice(0, 6)}`);
    showProfileModal('Collega Account email', [
        { key: 'account', label: 'Account', type: 'select', options: labels, icon: 'link' }
    ], { account: labels[0] }, async values => {
        const selected = accounts[labels.indexOf(values.account)];
        if (!selected) return;
        await updateDoc(doc(db, 'users', user.uid, 'accounts', selected.id), {
            linkedProfileField: { type: 'email', id: email.id }
        });
        email.linkedAccountId = selected.id;
        email.password = '';
        await syncData();
        showToast('Email e Account collegati senza duplicare le credenziali.', 'success');
    });
}

export async function createDeadlineFromDocument(documentItem, syncData) {
    if (documentItem?.expiryReference?.deadlineId) {
        window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(documentItem.expiryReference.deadlineId)}`;
        return;
    }
    if (!documentItem?.expiry_date) {
        showToast('Inserisci prima la data di scadenza del documento.', 'warning');
        return;
    }
    const confirmed = await showConfirmModal('Crea scadenza collegata', `Preparare una scheda per “${documentItem.type || 'Documento'}” con scadenza ${documentItem.expiry_date}?`);
    if (!confirmed) return;
    await syncData();
    sessionStorage.setItem('profile-deadline-link-draft', JSON.stringify({
        profileDocumentId: documentItem.id,
        name: documentItem.type || 'Documento',
        dueDate: documentItem.expiry_date
    }));
    window.location.href = `aggiungi_scadenza.html?profileDocumentId=${encodeURIComponent(documentItem.id)}`;
}
