import { db } from '../../firebase-config.js?v=1.1.8';
import { collection, doc, getDoc, getDocs } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const list = value => Array.isArray(value) ? value : [];
const make = ({ id, kind, title, subtitle = '', keywords = [], href }) => ({
    id: `${kind}:${id}`, kind, title: text(title) || 'Senza nome', subtitle: text(subtitle),
    keywords: keywords.map(text).filter(Boolean), href
});

function profileRecords(uid, data) {
    const owner = [data.nome, data.cognome].map(text).filter(Boolean).join(' ') || 'Profilo personale';
    const result = [make({ id: uid, kind: 'profilo', title: owner, subtitle: 'Profilo personale', keywords: ['utente', 'privato'], href: '/profilo_privato.html' })];
    list(data.documenti).forEach((item, index) => result.push(make({
        id: item.id || index, kind: 'documento', title: item.tipo || item.type || item.nome || 'Documento', subtitle: owner,
        // I metadati cifrati del documento non entrano nell'indice.
        keywords: ['documento', owner], href: '/profilo_privato.html'
    })));
    return result;
}

function accountRecord(id, data, companyId = '') {
    return make({ id, kind: companyId ? 'account aziendale' : 'account', title: data.nomeAccount || data.nome || 'Account',
        subtitle: companyId ? 'Account aziendale' : 'Account privato',
        keywords: [data.type, data.tipo, data.categoria, data.url, data.sitoWeb, data.referenteNome],
        href: companyId ? `/dettaglio_account_azienda.html?aziendaId=${encodeURIComponent(companyId)}&id=${encodeURIComponent(id)}` : `/dettaglio_account_privato.html?id=${encodeURIComponent(id)}` });
}

function companyRecord(id, data) {
    return make({ id, kind: 'azienda', title: data.ragioneSociale || data.nome || data.denominazione || 'Azienda', subtitle: 'Azienda',
        keywords: [data.nomeBreve, data.partitaIva, data.codiceFiscale, data.citta, data.settore], href: `/dettaglio_azienda.html?id=${encodeURIComponent(id)}` });
}

function deadlineRecord(id, data) {
    const vehicle = text(data.veicolo_modello) || [data.marca, data.modello, data.targa].map(text).filter(Boolean).join(' ');
    return make({ id, kind: 'scadenza', title: data.titolo || data.nome || data.tipoScadenza || data.tipo || 'Scadenza', subtitle: vehicle || data.categoria || 'Scadenza',
        keywords: [data.mode, data.categoria, data.type, data.tipo, data.tipoScadenza, data.name, data.intestatario, vehicle, data.riferimento], href: `/dettaglio_scadenza.html?id=${encodeURIComponent(id)}` });
}

export async function loadVaultSearchRecords(user) {
    if (!user?.uid) throw new Error('Utente non autenticato');
    const uid = user.uid;
    const [profile, accounts, companies, deadlines] = await Promise.all([
        getDoc(doc(db, 'users', uid)), getDocs(collection(db, 'users', uid, 'accounts')),
        getDocs(collection(db, 'users', uid, 'aziende')), getDocs(collection(db, 'users', uid, 'scadenze'))
    ]);
    const records = profile.exists() ? profileRecords(uid, profile.data()) : [];
    accounts.forEach(item => records.push(accountRecord(item.id, item.data())));
    deadlines.forEach(item => records.push(deadlineRecord(item.id, item.data())));
    const nested = [];
    companies.forEach(item => {
        records.push(companyRecord(item.id, item.data()));
        nested.push(getDocs(collection(db, 'users', uid, 'aziende', item.id, 'accounts'))
            .then(snapshot => snapshot.forEach(account => records.push(accountRecord(account.id, account.data(), item.id)))));
    });
    await Promise.all(nested);
    return records;
}
