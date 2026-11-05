import {readContactCard, contactDetails} from './modules/shared/contact-card-model.js';
import {prepareContactVCard} from './modules/shared/contact-card-photo.js';
import { mountDocumentationHelp, getDocumentationPageContext } from './guide.js';
import { applyGlobalTranslations, getCurrentLanguage, loadLanguage, t } from './translations.js';

mountDocumentationHelp(getDocumentationPageContext(window.location.pathname));

const status = document.getElementById('contact-status');
const save = document.getElementById('save-contact');
const retry = document.getElementById('retry-contact');
const photo = document.getElementById('contact-photo');
let downloadURL;

async function prepare() {
    retry.hidden = true;
    save.hidden = true;
    photo.hidden = true;
    status.textContent = t('shared_contact_preparing_photo');
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    try {
        const card = readContactCard(window.location.hash);
        document.getElementById('contact-name').textContent = card.name;
        const details = document.getElementById('contact-details');
        const labels = {
            firstName: t('shared_contact_field_first_name'), lastName: t('shared_contact_field_last_name'),
            phone: t('shared_contact_field_phone'), email: t('shared_contact_field_email'),
            address: t('shared_contact_field_address'), birthDate: t('shared_contact_field_birth_date'),
            fiscalCode: t('shared_contact_field_fiscal_code'), birthPlace: t('shared_contact_field_birth_place'),
            note: t('shared_contact_field_note'), website: t('shared_contact_field_website')
        };
        details.replaceChildren(...contactDetails(card, labels).map(({label, value}) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const description = document.createElement('dd');
            term.textContent = label;
            description.textContent = value;
            row.append(term, description);
            return row;
        }));
        const prepared = await prepareContactVCard(card);
        photo.src = prepared.photo;
        photo.hidden = false;
        downloadURL = URL.createObjectURL(new Blob([prepared.vcard], {type: 'text/vcard;charset=utf-8'}));
        save.href = downloadURL;
        save.hidden = false;
        status.textContent = t('shared_contact_ready');
    } catch {
        status.textContent = t('shared_contact_error');
        retry.hidden = false;
    }
}

retry.addEventListener('click', prepare);
window.addEventListener('hashchange', () => window.location.reload());
window.addEventListener('pagehide', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); });
window.addEventListener('pageshow', event => { if (event.persisted) prepare(); });
async function initialize() {
    await loadLanguage(getCurrentLanguage());
    applyGlobalTranslations();
    await prepare();
}

initialize();
