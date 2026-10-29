import { db } from '../../firebase-config.js?v=1.2.242';
import { clearElement } from '../../dom-utils.js';
import { doc, serverTimestamp, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { listCompanies } from '../data/vault-repository.js';
import {
    contactHasCompanyAssociation,
    mergeContactCompanyAssociation,
    normalizeDeadlineCompanyContext
} from './deadline-recipient-model.js';

const companyName = (company = {}) => String(
    company.ragioneSociale || company.denominazione || company.nome || ''
).trim();

export function createDeadlineCompanyContextController({
    getCurrentUser,
    getCurrentDomain,
    recipientController,
    showConfirmModal,
    showToast,
    t
}) {
    let companies = [];
    let bound = false;
    let loaded = false;

    function getSelected() {
        const select = document.getElementById('deadline-company-context-select');
        if (!select?.value || select.value === 'new') return null;
        if (select.value === 'external') {
            return normalizeDeadlineCompanyContext({
                kind: 'external',
                companyName: document.getElementById('deadline-external-company-name')?.value
            });
        }
        const company = companies.find(item => item.id === select.value);
        return normalizeDeadlineCompanyContext({
            kind: 'company', companyId: company?.id, companyName: companyName(company)
        });
    }

    function updateUi() {
        const needed = ['company', 'user-company'].includes(getCurrentDomain?.());
        const value = document.getElementById('deadline-company-context-select')?.value || '';
        document.getElementById('deadline-company-context')?.classList.toggle('hidden', !needed);
        document.getElementById('deadline-external-company-field')?.classList.toggle('hidden', !needed || value !== 'external');
        document.getElementById('deadline-new-company-help')?.classList.toggle('hidden', !needed || value !== 'new');
        recipientController.refreshContext?.();
    }

    function render(preferred = null) {
        const select = document.getElementById('deadline-company-context-select');
        if (!select) return;
        const previous = preferred || getSelected();
        clearElement(select);
        select.appendChild(new Option(t('deadline_form_select_company'), ''));
        companies.filter(company => company.isArchived !== true && companyName(company))
            .sort((left, right) => companyName(left).localeCompare(companyName(right), 'it'))
            .forEach(company => select.appendChild(new Option(companyName(company), company.id)));
        select.appendChild(new Option(t('deadline_form_external_company'), 'external'));
        select.appendChild(new Option(t('deadline_form_create_company'), 'new'));
        if (previous?.kind === 'company' && companies.some(company => company.id === previous.companyId)) {
            select.value = previous.companyId;
        } else if (previous?.kind === 'external') {
            select.value = 'external';
            const input = document.getElementById('deadline-external-company-name');
            if (input) input.value = previous.companyName;
        }
        updateUi();
    }

    async function refresh(preferred = null) {
        const user = getCurrentUser?.();
        companies = user?.uid ? await listCompanies(user.uid) : [];
        loaded = true;
        render(preferred);
    }

    async function associateContact(contact, context) {
        const user = getCurrentUser?.();
        if (!contact?.id || !user?.uid || !context || contactHasCompanyAssociation(contact, context)) return contact;
        const confirmed = await showConfirmModal(
            'Destinatario già esistente',
            `${contact.email} è già presente. Vuoi collegarlo anche a “${context.companyName}”? Se scegli Annulla verrà usato soltanto in questa scadenza.`,
            'Collega',
            'Solo questa scadenza'
        );
        if (!confirmed) return null;
        const next = mergeContactCompanyAssociation(contact, context);
        await updateDoc(doc(db, 'users', user.uid, 'contacts', contact.id), {
            companyAssociations: next.companyAssociations,
            updatedAt: serverTimestamp()
        });
        showToast(`Destinatario collegato a ${context.companyName}.`, 'success');
        return next;
    }

    function bind() {
        if (bound) return;
        bound = true;
        document.getElementById('deadline-company-context-select')?.addEventListener('change', updateUi);
        document.getElementById('deadline-external-company-name')?.addEventListener('input', () => recipientController.refreshContext?.());
        document.getElementById('btn-refresh-deadline-companies')?.addEventListener('click', () => {
            refresh().catch(error => {
                console.error('Company refresh failed', error);
                showToast('Impossibile aggiornare l’elenco aziende.', 'error');
            });
        });
    }

    return { associateContact, bind, getSelected, isLoaded: () => loaded, refresh, render, updateUi };
}
