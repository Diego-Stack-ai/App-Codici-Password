import { clearElement, createElement } from '../../dom-utils.js';
import {
    contactHasCompanyAssociation,
    deadlineRecipientDisplayName,
    mergeDeadlineRecipient,
    normalizeDeadlineCompanyContext,
    normalizeRecipientEmail,
    sortDeadlineContacts
} from './deadline-recipient-model.js';

export function createDeadlineRecipientController({ onManageContacts, getCompanyContext, onAssociateContact } = {}) {
    let recipients = [], contacts = [], ownerEmail = '';
    const isOwner = recipient => Boolean(ownerEmail && normalizeRecipientEmail(recipient?.email || recipient?.address) === ownerEmail);

    function renderRecipients() {
        const container = document.getElementById('deadline-recipients-list');
        if (!container) return;
        clearElement(container);
        if (!recipients.length) {
            container.appendChild(createElement('p', { className: 'deadline-recipient-help', textContent: 'Nessun destinatario aggiuntivo. Il proprietario continuerà a ricevere le proprie Push.' }));
            return;
        }
        recipients.forEach((recipient, index) => {
            const owner = isOwner(recipient);
            const emailToggle = createElement('input', { type: 'checkbox', checked: recipient.sendEmail, dataset: { recipientIndex: String(index), channel: 'email' } });
            const pushToggle = createElement('input', { type: 'checkbox', checked: recipient.sendPush, dataset: { recipientIndex: String(index), channel: 'push' } });
            container.appendChild(createElement('div', { className: `deadline-recipient-card${recipient.sendEmail || recipient.sendPush || recipient.canManage || owner ? '' : ' is-paused'}` }, [
                createElement('div', {}, [
                    createElement('span', { className: 'deadline-recipient-name', textContent: recipient.displayName || 'Destinatario' }),
                    createElement('span', { className: 'deadline-recipient-email', textContent: recipient.email })
                ]),
                createElement('div', { className: 'deadline-recipient-controls' }, [
                    createElement('label', { className: 'deadline-channel-label' }, [emailToggle, document.createTextNode('Email')]),
                    createElement('label', { className: 'deadline-channel-label' }, [pushToggle, document.createTextNode('Push')]),
                    ...(owner ? [] : [createElement('label', { className: 'deadline-channel-label' }, [
                        createElement('input', { type: 'checkbox', checked: recipient.canManage, dataset: { recipientIndex: String(index), channel: 'manage' } }),
                        document.createTextNode('Può gestire')
                    ])]),
                    createElement('button', { type: 'button', className: 'deadline-recipient-remove', dataset: { recipientRemove: String(index) }, title: 'Rimuovi destinatario' }, [
                        createElement('span', { className: 'material-symbols-outlined notranslate', textContent: 'delete' })
                    ])
                ])
            ]));
        });
    }

    function renderContacts() {
        const select = document.getElementById('deadline-contact-select');
        if (!select) return;
        clearElement(select);
        select.appendChild(new Option('Seleziona dalla rubrica…', ''));
        sortDeadlineContacts(contacts, getCompanyContext?.()).forEach(contact => {
            const email = normalizeRecipientEmail(contact.email);
            if (!email) return;
            const label = deadlineRecipientDisplayName(contact);
            select.appendChild(new Option(`${label} — ${email}`, contact.id || `email:${email}`));
        });
    }

    async function add(contact) {
        const companyContext = normalizeDeadlineCompanyContext(getCompanyContext?.());
        if (companyContext && !contactHasCompanyAssociation(contact, companyContext) && onAssociateContact) {
            const linked = await onAssociateContact(contact, companyContext);
            if (linked) {
                contact = {...contact, companyAssociations: linked.companyAssociations || contact.companyAssociations};
                contacts = contacts.map(item => item.id === contact.id ? contact : item);
            }
        }
        const associatedContext = companyContext && contactHasCompanyAssociation(contact, companyContext)
            ? companyContext
            : null;
        const result = mergeDeadlineRecipient(recipients, {
            contactId: contact.id, displayName: deadlineRecipientDisplayName(contact),
            email: contact.email, sendEmail: true, sendPush: true, canManage: false,
            ...(associatedContext ? {companyContext: associatedContext} : {})
        });
        recipients = result.recipients;
        renderRecipients();
    }

    function init(value = '') {
        ownerEmail = normalizeRecipientEmail(value);
        document.getElementById('btn-manage-deadline-contacts')?.addEventListener('click', async () => {
            const returnTo = `${window.location.pathname.split('/').pop()}${window.location.search}`;
            if (onManageContacts) {
                await onManageContacts(returnTo);
                return;
            }
            window.location.href = `gestione_destinatari.html?return=${encodeURIComponent(returnTo)}`;
        });
        document.getElementById('deadline-contact-select')?.addEventListener('change', async event => {
            const selectedValue = event.currentTarget.value || '';
            const contact = contacts.find(item => item.id === selectedValue || `email:${normalizeRecipientEmail(item.email)}` === selectedValue);
            if (contact) await add(contact);
            event.currentTarget.value = '';
        });
        document.getElementById('deadline-recipients-list')?.addEventListener('change', event => {
            const input = event.target.closest('input[data-recipient-index]');
            const recipient = input ? recipients[Number(input.dataset.recipientIndex)] : null;
            if (!recipient) return;
            const channelField = input.dataset.channel === 'email'
                ? 'sendEmail'
                : input.dataset.channel === 'push' ? 'sendPush' : 'canManage';
            recipients = recipients.map((item, index) => index === Number(input.dataset.recipientIndex)
                ? { ...item, [channelField]: input.checked }
                : item);
            renderRecipients();
        });
        document.getElementById('deadline-recipients-list')?.addEventListener('click', event => {
            const button = event.target.closest('[data-recipient-remove]');
            if (!button) return;
            recipients = recipients.filter((_, index) => index !== Number(button.dataset.recipientRemove));
            renderRecipients();
        });
        renderRecipients();
    }

    return {
        init,
        getRecipients: () => recipients.map(recipient => ({
            ...recipient,
            canManage: recipient.canManage || isOwner(recipient)
        })),
        getContacts: () => contacts.map(contact => ({ ...contact })),
        setRecipients(value) {
            recipients = Array.isArray(value) ? value.map(recipient => ({ ...recipient })) : [];
            renderRecipients();
        },
        setContacts(value) {
            contacts = Array.isArray(value) ? value.map(contact => ({ ...contact })) : [];
            renderContacts();
        },
        refreshContext() {
            renderContacts();
            renderRecipients();
        }
    };
}
