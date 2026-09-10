import { auth, db } from '../../firebase-config.js?v=1.2.90';
import { collection, doc, updateDoc } from "/assets/js/vendor/firebase-runtime.js";
import { showAlertModal, showConfirmModal, showToast } from '../../ui-core-v129.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { showProfileModal } from './profilo-modal.js';
import {listDeadlines, listPrivateAccounts} from '../data/vault-repository.js';
import {buildProfileDocumentDeadlineDraft, findCompatibleDocumentDeadlines} from './profile-model.js';

export function openLinkedAccount(accountId) {
    if (accountId) window.location.href = `dettaglio_account_privato.html?id=${encodeURIComponent(accountId)}`;
}

export async function connectEmailAccount(email, syncData) {
    const user = auth.currentUser;
    if (!user || !email?.id) return;
    if (String(email.password || '').trim()) {
        await showAlertModal(
            'PASSWORD EMAIL DA PROTEGGERE',
            'Questa email contiene ancora una password nel Profilo. Prima salvala nell’Account corretto e poi rimuovila manualmente dall’email. Il collegamento è stato bloccato per evitare la perdita della credenziale.'
        );
        return;
    }
    const accountRecords = await listPrivateAccounts(user.uid);
    const vaultKeyMaterial = await ensureVaultKeyMaterial();
    const accounts = await Promise.all(accountRecords.map(async data => {
        let username = '';
        try { username = data._encrypted && data.username ? await decrypt(data.username, vaultKeyMaterial) : (data.username || ''); } catch { username = ''; }
        return { id: data.id, name: data.nomeAccount || 'Account', username };
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

export async function createDeadlineFromDocument(documentItem, syncData, profile = {}) {
    if (documentItem?.expiryReference?.deadlineId) {
        window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(documentItem.expiryReference.deadlineId)}`;
        return;
    }
    if (!documentItem?.expiry_date) {
        showToast('Inserisci prima la data di scadenza del documento.', 'warning');
        return;
    }
    const user = auth.currentUser;
    if (!user) return;
    const deadlines = await listDeadlines(user.uid);
    const legacyMatches = findCompatibleDocumentDeadlines(documentItem, deadlines);
    if (legacyMatches.length === 1) {
        const existing = legacyMatches[0];
        const linkExisting = await showConfirmModal(
            'Scadenza già presente',
            `Esiste già una scadenza “${existing.type || documentItem.type}” con la stessa data. Vuoi collegarla a questo documento invece di crearne un’altra?`,
            'Collega esistente',
            'Annulla'
        );
        if (!linkExisting) return;
        documentItem.expiryReference = {deadlineId: existing.id};
        await updateDoc(doc(db, 'users', user.uid, 'scadenze', existing.id), {
            sourceRef: {type: 'profileDocument', id: documentItem.id}
        });
        await syncData();
        showToast('Scadenza esistente collegata al documento.', 'success');
        window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(existing.id)}`;
        return;
    }
    if (legacyMatches.length > 1) {
        await showAlertModal(
            'Più scadenze compatibili',
            'Esistono più scadenze con la stessa categoria e data. Apri la sezione Scadenze e verifica quale conservare prima di creare il collegamento.'
        );
        return;
    }
    const confirmed = await showConfirmModal('Crea scadenza collegata', `Preparare una scheda per “${documentItem.type || 'Documento'}” con scadenza ${documentItem.expiry_date}?`);
    if (!confirmed) return;
    await syncData();
    sessionStorage.setItem('profile-deadline-link-draft', JSON.stringify(
        buildProfileDocumentDeadlineDraft(documentItem, profile)
    ));
    window.location.href = `aggiungi_scadenza.html?profileDocumentId=${encodeURIComponent(documentItem.id)}`;
}
