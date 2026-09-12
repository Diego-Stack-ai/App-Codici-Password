import { changeProfileAccount, unlinkProfileAccount } from '../shared/profile-account-management.js';
import { auth, db } from '../../firebase-config.js?v=1.2.114';
import { doc, runTransaction, deleteField, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { createElement, setChildren } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { getPrivateAccountConfirmed, getCompanyAccountConfirmed, listPrivateAccounts, listCompanies, listCompanyAccounts } from '../data/vault-repository.js';
import { showProfileAccountPicker } from '../privato/profilo-modal.js';
import { profileAccountUrl } from '../privato/profile-model.js';
import { companyProfileContacts, companyProfileDraft, findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences } from './company-profile-model.js';
import { renderQRCode } from '../shared/qr_code_utils.js';

const button = (label, onclick) => createElement('button', { type: 'button', className: 'company-profile-action', textContent: label, onclick });
const text = (value, className = 'company-contact-value') => createElement('span', {className, textContent: value});
const editUrl = id => `modifica_azienda.html?id=${encodeURIComponent(id)}`;
function miniButton(label, icon, onclick) {
    return createElement('button',{type:'button',className:'profile-contact-mini',title:label,'aria-label':label,onclick},[createElement('span',{className:'material-symbols-outlined',textContent:icon})]);
}
function copyButton(getValue) {
    return miniButton('Copia', 'content_copy', async () => { try { const value = await getValue(); if (!value) return; await navigator.clipboard.writeText(value); showToast('Copiato!', 'success'); } catch { showToast('Impossibile copiare. Sblocca il Vault e riprova.', 'error'); } });
}
function secretField(label, read) {
    const value = text('••••••••');
    let revealed = false;
    const toggle = miniButton('Mostra password', 'visibility', async () => {
        if (revealed) { value.textContent = '••••••••'; toggle.querySelector('span').textContent = 'visibility'; revealed = false; return; }
        toggle.disabled = true;
        try { const password = await read(); value.textContent = password || 'Nessuna password'; revealed = true; toggle.querySelector('span').textContent = 'visibility_off'; }
        catch { showToast('Password non disponibile. Sblocca il Vault e controlla il collegamento.', 'error'); }
        finally { toggle.disabled = false; }
    });
    toggle.setAttribute('aria-label', 'Mostra o nascondi ' + label);
    return createElement('div', {}, [text(label, 'view-label'), createElement('div', {className:'company-contact-row'}, [value, toggle, copyButton(read)])]);
}
async function readLinkedPassword(contact) {
    const uid = auth.currentUser?.uid;
    const key = await ensureVaultKeyMaterial();
    if (!uid || auth.currentUser?.uid !== uid || !key) throw new Error('Vault bloccato');
    const account = contact.linkedAccountCompanyId ? await getCompanyAccountConfirmed(uid, contact.linkedAccountCompanyId, contact.linkedAccountId) : await getPrivateAccountConfirmed(uid, contact.linkedAccountId);
    if (!account || account.isArchived) throw new Error('Account mancante');
    const value = await decryptRequiredValue(account.password, key);
    if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata');
    return value;
}
export async function connectCompanyContact(contact, companyId, type) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        const [personal, companies, key] = await Promise.all([listPrivateAccounts(uid), listCompanies(uid), ensureVaultKeyMaterial()]);
        const active = companies.filter(c => !c.isArchived).map(c => ({id:c.id, name:c.ragioneSociale || 'Azienda'}));
        const nested = await Promise.all(active.map(async c => (await listCompanyAccounts(uid,c.id)).map(a => ({...a,companyId:c.id,companyName:c.name}))));
        const accounts = await Promise.all([...personal.map(a => ({...a,companyId:''})), ...nested.flat()].filter(a => !a.isArchived && !a._isGuest && a.visibility !== 'shared' && !a.shared && !a.isMemo && !a.hasMemo && !a.isMemoShared && !['memo','memorandum'].includes(a.type)).map(async a => {
            let username = '';
            try { username = await decryptRequiredValue(a.username,key); } catch { /* La ricerca resta disponibile senza credenziali illeggibili. */ }
            return {id:a.id,companyId:a.companyId,companyName:a.companyName||'',name:a.nomeAccount||'Account',username};
        }));
        accounts.sort((a,b)=>a.name.localeCompare(b.name,'it'));
        showProfileAccountPicker({ title: type === 'email' ? 'Collega Account email aziendale' : 'Collega Account telefono aziendale', accounts, companies:active, initialScope: `company:${companyId}`, onSelect: async selected => {
            sessionStorage.setItem('profile-account-link-draft',JSON.stringify(companyProfileDraft(contact,companyId,type,uid,selected.companyId||'')));
            window.location.href = profileAccountUrl(selected.id||'',selected.companyId||'',{edit:true,contactId:contact.id});
        }});
    } catch { showToast('Impossibile caricare gli Account. Controlla il Vault e la connessione.', 'error'); }
}
export function renderCompanyContacts(data, companyId, reload) {
    const contacts = companyProfileContacts(data);
    const card = (contact,type) => {
        const fields = [text(contact.label,'view-label'),createElement('div',{className:'company-contact-row'},[text(contact.address||contact.number),copyButton(async()=>contact.address||contact.number)])];
        if (contact.username) fields.push(createElement('div',{},[text('Username','view-label'),text(contact.username)]));
        if (contact.linkedAccountId) fields.push(secretField('Password Account collegato',()=>readLinkedPassword(contact)));
        if (contact.password) fields.push(secretField('Password nel profilo aziendale',async()=>decryptRequiredValue(contact.password,await ensureVaultKeyMaterial())), text('Conservata fino alla verifica del trasferimento nell’Account.','company-contact-note'));
        if (contact.note) fields.push(createElement('div',{className:'company-contact-note'},[text('Nota','view-label'),text(contact.note)]));
        const actions = contact.linkedAccountId ? [button('Apri Account collegato',()=>{window.location.href=profileAccountUrl(contact.linkedAccountId,contact.linkedAccountCompanyId||'');}),button('Cambia Account',()=>changeProfileAccount({contact,type,sourceCompanyId:companyId},reload)),button('Scollega Account',()=>unlinkProfileAccount({contact,type,sourceCompanyId:companyId},reload))] : [button('Collega o crea Account',()=>connectCompanyContact(contact,companyId,type))];
        actions.forEach(action=>action.classList.add('profile-contact-connect'));
        fields.push(createElement('div',{className:contact.linkedAccountId?'company-contact-actions profile-account-actions':'company-contact-actions'},actions));
        const header = createElement('div',{className:'profile-contact-header'},[text(contact.label,'profile-contact-label'),miniButton('Modifica contatto','edit',()=>{window.location.href=editUrl(companyId)+(type==='email'?'#section-email':'');})]);
        return createElement('article',{className:'company-contact-card profile-contact-card'},[header,createElement('div',{className:'profile-contact-fields'},fields.slice(1))]);
    };
    setChildren(document.getElementById('email-list-container'),contacts.emails.length ? contacts.emails.map(e=>card(e,'email')) : [text('Nessuna email. Usa Modifica contatti per aggiungerla.')]);
    setChildren(document.getElementById('company-phone-list'),contacts.phones.length ? contacts.phones.map(p=>card(p,'phone')) : [text('Nessun telefono. Usa Modifica contatti per aggiungerlo.')]);
}
export function initCompanyProfile(data, companyId, {buildVCard, reload}) {
    const tabs = [...document.querySelectorAll('[data-company-tab]')];
    styleCompanySections(companyId);
    tabs.forEach(tab => {
        tab.id = 'company-tab-' + tab.dataset.companyTab;
        const panels = [...document.querySelectorAll('[data-company-panel]')].filter(panel => panel.dataset.companyPanel === tab.dataset.companyTab);
        panels.forEach((panel,index) => { panel.id ||= 'company-panel-' + tab.dataset.companyTab + '-' + index; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',tab.id); });
        tab.setAttribute('aria-controls',panels.map(panel=>panel.id).join(' '));
    });
    const activate = name => {
        if (!tabs.some(tab=>tab.dataset.companyTab===name)) name='overview';
        tabs.forEach(tab=>{const active=tab.dataset.companyTab===name;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
        document.querySelectorAll('[data-company-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.companyPanel!==name));
        sessionStorage.setItem('company-profile-tab:'+companyId,name);
    };
    tabs.forEach((tab,index)=>{tab.onclick=()=>activate(tab.dataset.companyTab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;tabs[next].focus();activate(tabs[next].dataset.companyTab);};});
    const summary=[['badge','Partita IVA',data.partitaIva,'personal'],['mail','Email principale',companyProfileContacts(data).emails[0]?.address,'contacts'],['call','Telefono',data.telefonoAzienda,'contacts'],['home','Sede legale',[data.indirizzoSede,data.civicoSede,data.cittaSede].filter(Boolean).join(' '),'addresses']];
    setChildren(document.getElementById('company-overview'),[
        createElement('div',{className:'profile-overview-heading'},[
            createElement('div',{},[text('Profilo aziendale','data-label'),createElement('h2',{className:'profile-overview-name',textContent:data.ragioneSociale||'Azienda'})]),
            button('Modifica anagrafica',()=>{window.location.href=editUrl(companyId);})
        ]),
        createElement('div',{className:'profile-summary-grid'},summary.map(([icon,label,value,tab])=>createElement('button',{type:'button',className:'profile-summary-card profile-summary-card-action',onclick:()=>activate(tab)},[
            text(icon,'material-symbols-outlined'),createElement('div',{},[text(label,'data-label'),createElement('p',{className:'data-value',textContent:value||'Non indicato'})])
        ]))),
        createElement('section',{className:'form-card profile-expiry-card'},[
            createElement('h3',{className:'form-section-title',textContent:'Documenti aziendali'}),
            button(`${data.allegati?.length||0} allegati — Apri documenti`,()=>activate('documents'))
        ])
    ]);
    const qr=document.getElementById('company-digital-card');
    const options=[['ragioneSociale','Ragione sociale'],['partitaIva','Partita IVA'],['codiceSDI','Codice SDI'],['numeroCCIAA','CCIAA'],['dataIscrizione','Data iscrizione'],['referenteNome','Nome referente'],['referenteCognome','Cognome referente'],['referenteTitolo','Ruolo referente'],['referenteCellulare','Cellulare referente'],['aziendaEmail','PEC'],['adminEmail','Email amministrazione'],['persEmail','Email personale'],['qrLegale','Sede legale']];
    const preview=createElement('div',{className:'company-qr-preview'});
    const config={...data.qrConfig};
    const refresh=()=>{ const vcard=buildVCard({...data,qrConfig:config}); renderQRCode(preview,vcard,{width:220,height:220,colorDark:'#000000',colorLight:'#ffffff'}); const capacity=document.getElementById('company-qr-capacity'); if(capacity) { const bytes=new TextEncoder().encode(vcard).length; capacity.textContent=bytes>1200 ? `Il QR contiene ${bytes} byte: riduci i campi per renderlo più facile da leggere.` : `Capacità utilizzata: ${bytes} byte.`; capacity.classList.toggle('is-warning',bytes>1200); } };
    const checks=options.map(([key,label])=>createElement('label',{className:'digital-card-choice'},[createElement('input',{type:'checkbox',checked:config[key]===undefined?!['adminEmail','persEmail'].includes(key):Boolean(config[key]),onchange:event=>{config[key]=event.target.checked;refresh();}}),text(label)]));
    const save=button('Salva selezione',async()=>{try{save.disabled=true;await updateDoc(doc(db,'users',auth.currentUser.uid,'aziende',companyId),{qrConfig:config});showToast('Tessera aggiornata','success');await reload();}catch{showToast('Impossibile salvare la tessera','error');}finally{save.disabled=false;}});
    const download=button('Scarica contatto',()=>{const blob=new Blob([buildVCard({...data,qrConfig:config})],{type:'text/vcard;charset=utf-8'});const url=URL.createObjectURL(blob);const a=createElement('a',{href:url,download:'contatto-azienda.vcf'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    setChildren(qr,[createElement('div',{className:'digital-card-layout'},[
        createElement('section',{className:'form-card digital-card-preview'},[
            createElement('h2',{className:'form-section-title',textContent:'Anteprima Tessera digitale'}),preview,
            createElement('p',{className:'digital-card-warning',textContent:'Il QR contiene dati in chiaro. Password, PIN, chiavi e allegati sono sempre esclusi.'}),
            createElement('p',{className:'digital-card-capacity',id:'company-qr-capacity'}),
            createElement('div',{className:'digital-card-actions'},[download])
        ]),
        createElement('section',{className:'form-card digital-card-fields'},[
            createElement('h2',{className:'form-section-title',textContent:'Dati inclusi'}),
            text('Ogni scelta aggiorna l’anteprima. Salva la selezione per mantenerla.','data-value-sub'),
            ...checks,save
        ])
    ])]);
    refresh();
    renderCompanyContacts(data,companyId,reload);
    activate(new URLSearchParams(window.location.search).get('profileTab')||sessionStorage.getItem('company-profile-tab:'+companyId)||'overview');
}

function styleCompanySections(companyId) {
    document.querySelectorAll('[data-company-panel]').forEach(panel=>{
        const type=panel.dataset.companyPanel;
        panel.classList.add('profile-tab-panel');
        panel.querySelectorAll('.glass-card').forEach(card=>{card.classList.remove('glass-card');card.classList.add('form-card');});
        const header=panel.querySelector('.accordion-trigger-premium, .detail-section-header');
        if(!header || header.dataset.profileStyled) return;
        header.dataset.profileStyled='true';
        header.classList.add('form-section-header');
        const title=header.querySelector('.detail-section-title');
        title?.classList.add('form-section-title');
        const icon=header.querySelector('.detail-section-icon');
        if(icon) {
            icon.className='material-symbols-outlined detail-section-icon';
            const wrapper=createElement('div',{className:'section-title-wrapper'});
            const box=createElement('div',{className:'settings-icon-box '+({personal:'icon-blue',contacts:'icon-emerald',addresses:'icon-amber',documents:'icon-purple'}[type]||'icon-blue')},[icon]);
            wrapper.append(box);
            if(title) wrapper.append(title);
            header.prepend(wrapper);
        }
        // Editing belongs to each section, as in the private profile.
        panel.querySelector('#btn-add-email')?.remove();
        panel.querySelector('#btn-edit-fiscal')?.remove();
        if(!panel.querySelector('#btn-edit-note')) {
            const action=miniButton('Modifica '+({personal:'anagrafica',contacts:'contatti',addresses:'indirizzi',documents:'documenti'}[type]||'sezione'),'edit',event=>{
                event.stopPropagation();window.location.href=editUrl(companyId)+(type==='contacts'?'#section-email':'');
            });
            // Avoid nested buttons in accordion triggers.
            const row=createElement('div',{className:'profile-overview-heading'});
            header.before(row);row.append(header,action);
        }
    });
}
