import {readContactCard, contactDetails} from './modules/shared/contact-card-model.js';
import {prepareContactVCard} from './modules/shared/contact-card-photo.js';

const status = document.getElementById('contact-status');
const save = document.getElementById('save-contact');
const retry = document.getElementById('retry-contact');
const photo = document.getElementById('contact-photo');
let downloadURL;

async function prepare() {
    retry.hidden = true;
    save.hidden = true;
    photo.hidden = true;
    status.textContent = 'Preparazione del contatto con la foto…';
    if (downloadURL) URL.revokeObjectURL(downloadURL);
    try {
        const card = readContactCard(window.location.hash);
        document.getElementById('contact-name').textContent = card.name;
        const details = document.getElementById('contact-details');
        details.replaceChildren(...contactDetails(card).map(({label, value}) => {
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
        status.textContent = 'La foto è inclusa nel file del contatto. Premi Salva contatto e conferma l’importazione nella rubrica.';
    } catch {
        status.textContent = 'Non è stato possibile preparare il contatto con la foto. Controlla la connessione e riprova, oppure richiedi un nuovo QR.';
        retry.hidden = false;
    }
}

retry.addEventListener('click', prepare);
window.addEventListener('hashchange', () => window.location.reload());
window.addEventListener('pagehide', () => { if (downloadURL) URL.revokeObjectURL(downloadURL); });
window.addEventListener('pageshow', event => { if (event.persisted) prepare(); });
prepare();
