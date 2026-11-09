import { changeProfileAccount, unlinkProfileAccount } from '../shared/profile-account-management.js';
import { auth, db } from '../../firebase-config.js?v=1.2.265';
import { onAuthStateChanged } from '/assets/js/vendor/firebase-runtime.js';
import { doc, runTransaction, deleteField, updateDoc } from '/assets/js/vendor/firebase-runtime.js';
import { createElement, setChildren } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed, listPrivateAccounts, listCompanies, listCompanyAccounts } from '../data/vault-repository.js';
import { showProfileAccountPicker } from '../privato/profilo-modal.js';
import { profileAccountUrl } from '../privato/profile-model.js';
import { companyProfileContacts, companyProfileDraft, findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences } from './company-profile-model.js';
import { renderQRCode } from '../shared/qr_code_utils.js';
import { t } from '../../translations.js';

const formatTranslation = (key, values = {}) => Object.entries(values)
    .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

const button = (label, onclick) => createElement('button', { type: 'button', className: 'company-profile-action', textContent: label, onclick });
const text = (value, className = 'company-contact-value') => createElement('span', {className, textContent: value});
const editUrl = id => `modifica_azienda.html?id=${encodeURIComponent(id)}`;
function miniButton(label, icon, onclick) {
    return createElement('button',{type:'button',className:'profile-contact-mini',title:label,'aria-label':label,onclick},[createElement('span',{className:'material-symbols-outlined notranslate',textContent:icon})]);
}
function copyButton(getValue) {
    return miniButton(t('common_copy'), 'content_copy', async () => { try { const value = await getValue(); if (!value) return; await navigator.clipboard.writeText(value); showToast(t('copied'), 'success'); } catch { showToast(t('common_copy_vault_error'), 'error'); } });
}
function secretField(label, read) {
    const value = text('••••••••');
    let revealed = false;
    const toggle = miniButton(t('common_show_password'), 'visibility', async () => {
        if (revealed) { value.textContent = '••••••••'; toggle.querySelector('span').textContent = 'visibility'; revealed = false; return; }
        toggle.disabled = true;
        try { const password = await read(); value.textContent = password || t('common_password_none'); revealed = true; toggle.querySelector('span').textContent = 'visibility_off'; }
        catch { showToast(t('common_password_unavailable'), 'error'); }
        finally { toggle.disabled = false; }
    });
    toggle.setAttribute('aria-label', formatTranslation('common_show_hide_field', { label }));
    return createElement('div', {}, [text(label, 'view-label'), createElement('div', {className:'company-contact-row'}, [value, toggle, copyButton(read)])]);
}
async function readLinkedPassword(contact) {
    const uid = auth.currentUser?.uid;
    const key = await ensureVaultKeyMaterial();
    if (!uid || auth.currentUser?.uid !== uid || !key) throw new Error('Vault bloccato');
    const offline = globalThis.navigator?.onLine === false;
    const account = contact.linkedAccountCompanyId
        ? await (offline ? getCompanyAccount : getCompanyAccountConfirmed)(uid, contact.linkedAccountCompanyId, contact.linkedAccountId)
        : await (offline ? getPrivateAccount : getPrivateAccountConfirmed)(uid, contact.linkedAccountId);
    if (!account || account.isArchived) throw new Error('Account mancante');
    if (auth.currentUser?.uid !== uid || (Object.hasOwn(account, 'ownerId') && account.ownerId !== uid)) throw new Error('Sessione cambiata');
    const value = await decryptRequiredValue(account.password, key);
    if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata');
    return value;
}
const linkedAccountNameCache = new Map();
async function readLinkedAccountName(contact) {
    const uid = auth.currentUser?.uid;
    if (!uid || !contact?.linkedAccountId) return '';
    const companyId = contact.linkedAccountCompanyId || '';
    const cacheKey = `${uid}|${companyId}|${contact.linkedAccountId}`;
    if (linkedAccountNameCache.has(cacheKey)) return linkedAccountNameCache.get(cacheKey);
    const account = companyId
        ? await getCompanyAccount(uid, companyId, contact.linkedAccountId)
        : await getPrivateAccount(uid, contact.linkedAccountId);
    if (auth.currentUser?.uid !== uid || !account || account.isArchived) return '';
    const name = String(account.nomeAccount || account.name || '').trim();
    if (name) linkedAccountNameCache.set(cacheKey, name);
    return name;
}
export async function connectCompanyContact(contact, companyId, type) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        const [personal, companies, key] = await Promise.all([listPrivateAccounts(uid), listCompanies(uid), ensureVaultKeyMaterial()]);
        const active = companies.filter(c => !c.isArchived).map(c => ({id:c.id, name:c.ragioneSociale || t('company_profile_fallback')}));
        const nested = await Promise.all(active.map(async c => (await listCompanyAccounts(uid,c.id)).map(a => ({...a,companyId:c.id,companyName:c.name}))));
        const accounts = await Promise.all([...personal.map(a => ({...a,companyId:''})), ...nested.flat()].filter(a => !a.isArchived && !a._isGuest && a.visibility !== 'shared' && !a.shared && !a.isMemo && !a.hasMemo && !a.isMemoShared && !['memo','memorandum'].includes(a.type)).map(async a => {
            let username = '';
            try { username = await decryptRequiredValue(a.username,key); } catch { /* La ricerca resta disponibile senza credenziali illeggibili. */ }
            return {id:a.id,companyId:a.companyId,companyName:a.companyName||'',name:a.nomeAccount||t('label_account'),username};
        }));
        accounts.sort((a,b)=>a.name.localeCompare(b.name,'it'));
        showProfileAccountPicker({ title: type === 'email' ? t('company_accounts_email_link_title') : t('company_accounts_phone_link_title'), accounts, companies:active, initialScope: `company:${companyId}`, onSelect: async selected => {
            sessionStorage.setItem('profile-account-link-draft',JSON.stringify(companyProfileDraft(contact,companyId,type,uid,selected.companyId||'')));
            window.location.href = profileAccountUrl(selected.id||'',selected.companyId||'',{edit:true,contactId:contact.id});
        }});
    } catch { showToast(t('company_accounts_load_error'), 'error'); }
}
export function renderCompanyContacts(data, companyId, reload) {
    const contacts = companyProfileContacts(data);
    const card = (contact,type) => {
        const fields = [text(contact.label,'view-label'),createElement('div',{className:'company-contact-row'},[text(contact.address||contact.number),copyButton(async()=>contact.address||contact.number)])];
        if (contact.username) fields.push(createElement('div',{},[text(t('username'),'view-label'),text(contact.username)]));
        if (contact.linkedAccountId) fields.push(secretField(t('company_linked_password'),()=>readLinkedPassword(contact)));
        if (contact.password) {
            const legacyPassword = secretField(t('company_profile_password'),async()=>decryptRequiredValue(contact.password,await ensureVaultKeyMaterial()));
            if (contact.linkedAccountId) {
                fields.push(createElement('details',{className:'profile-legacy-credential'},[
                    createElement('summary',{textContent:t('company_profile_password_retained')}),
                    legacyPassword,
                    text(t('company_profile_password_conflict_note'),'company-contact-note')
                ]));
            } else {
                fields.push(legacyPassword, text(t('company_profile_password_note'),'company-contact-note'));
            }
        }
        if (contact.note) fields.push(createElement('div',{className:'company-contact-note'},[text(t('notes'),'view-label'),text(contact.note)]));
        const actions = contact.linkedAccountId ? [button(t('company_open_linked_account'),()=>{window.location.href=profileAccountUrl(contact.linkedAccountId,contact.linkedAccountCompanyId||'');}),button(t('company_change_account'),()=>changeProfileAccount({contact,type,sourceCompanyId:companyId},reload)),button(t('company_unlink_account'),()=>unlinkProfileAccount({contact,type,sourceCompanyId:companyId},reload))] : [button(t('company_link_or_create_account'),()=>connectCompanyContact(contact,companyId,type))];
        actions.forEach(action=>action.classList.add('profile-contact-connect'));
        if (contact.linkedAccountId) {
            actions[0].classList.add('profile-account-primary');
            readLinkedAccountName(contact).then(name=>{if(name && actions[0].isConnected) actions[0].textContent=formatTranslation('company_open_named_account',{name});}).catch(()=>{});
        }
        fields.push(createElement('div',{className:contact.linkedAccountId?'company-contact-actions profile-account-actions':'company-contact-actions'},actions));
        const header = createElement('div',{className:'profile-contact-header'},[text(contact.label,'profile-contact-label'),miniButton(t('company_edit_contact'),'edit',()=>{window.location.href=editUrl(companyId)+(type==='email'?'#section-email':'');})]);
        return createElement('article',{className:'company-contact-card profile-contact-card'},[header,createElement('div',{className:'profile-contact-fields'},fields.slice(1))]);
    };
    setChildren(document.getElementById('email-list-container'),contacts.emails.length ? contacts.emails.map(e=>card(e,'email')) : [text(t('company_no_email'))]);
    setChildren(document.getElementById('company-phone-list'),contacts.phones.length ? contacts.phones.map(p=>card(p,'phone')) : [text(t('company_no_phone'))]);
}
let pdfCleanup, pdfRoot, pdfGeneration = 0, pdfOwnerUid, pdfLifecycleStarted = false;
function clearCompanyPdf() {
    pdfGeneration++;
    pdfCleanup?.(); pdfCleanup = null;
    pdfRoot?.replaceChildren(); pdfRoot = null;
}
function startCompanyPdfLifecycle() {
    if (pdfLifecycleStarted) return;
    pdfLifecycleStarted = true;
    pdfOwnerUid = auth.currentUser?.uid;
    for (const event of ['pagehide', 'private-auth-blocked', 'vault-session-locked']) {
        window.addEventListener(event, clearCompanyPdf);
    }
    onAuthStateChanged(auth, user => {
        if (user?.uid !== pdfOwnerUid) clearCompanyPdf();
        pdfOwnerUid = user?.uid;
    });
}
export function initCompanyProfile(data, companyId, {buildVCard, reload}) {
    startCompanyPdfLifecycle();
    clearCompanyPdf();
    const ownerUid = auth.currentUser?.uid;
    const tabs = [...document.querySelectorAll('[data-company-tab]')];
    styleCompanySections(companyId);
    tabs.forEach(tab => {
        tab.id = 'company-tab-' + tab.dataset.companyTab;
        const panels = [...document.querySelectorAll('[data-company-panel]')].filter(panel => panel.dataset.companyPanel === tab.dataset.companyTab);
        panels.forEach((panel,index) => { panel.id ||= 'company-panel-' + tab.dataset.companyTab + '-' + index; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',tab.id); });
        tab.setAttribute('aria-controls',panels.map(panel=>panel.id).join(' '));
    });
    const activate = name => {
        clearCompanyPdf();
        const generation = pdfGeneration;
        if (!tabs.some(tab=>tab.dataset.companyTab===name)) name='overview';
        tabs.forEach(tab=>{const active=tab.dataset.companyTab===name;tab.classList.toggle('is-active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});
        document.querySelectorAll('[data-company-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.dataset.companyPanel!==name));
        sessionStorage.setItem('company-profile-tab:'+companyId,name);
        if (name === 'pdf-summary') {
            const root = document.getElementById('company-pdf-summary');
            if (!root || !ownerUid || auth.currentUser?.uid !== ownerUid) return;
            pdfRoot = root;
            root.textContent = t('company_pdf_loading');
            import('./pdf/company-summary-entry.js').then(({mountCompanySummary}) => {
                if (generation === pdfGeneration && root.isConnected && auth.currentUser?.uid === ownerUid) {
                    pdfCleanup = mountCompanySummary(root, companyId);
                }
            }).catch(() => {
                if (generation === pdfGeneration && root.isConnected && auth.currentUser?.uid === ownerUid) {
                    root.textContent = t('company_pdf_unavailable');
                }
            });
        }
    };
    tabs.forEach((tab,index)=>{tab.onclick=()=>activate(tab.dataset.companyTab);tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;tabs[next].focus();activate(tabs[next].dataset.companyTab);};});
    const summary=[['badge',t('company_primary_vat'),data.partitaIva,'personal'],['mail',t('company_primary_email'),companyProfileContacts(data).emails[0]?.address,'contacts'],['call',t('company_primary_phone'),data.telefonoAzienda,'contacts'],['home',t('company_legal_address'),[data.indirizzoSede,data.civicoSede,data.cittaSede].filter(Boolean).join(' '),'addresses']];
    setChildren(document.getElementById('company-overview'),[
        createElement('div',{className:'profile-overview-heading'},[
            createElement('div',{},[text(t('company_profile_page_title'),'data-label'),createElement('h2',{className:'profile-overview-name',textContent:data.ragioneSociale||t('company_profile_fallback')})]),
            button(t('company_profile_edit'),()=>{window.location.href=editUrl(companyId);})
        ]),
        createElement('div',{className:'profile-summary-grid'},summary.map(([icon,label,value,tab])=>createElement('button',{type:'button',className:'profile-summary-card profile-summary-card-action',onclick:()=>activate(tab)},[
            text(icon,'material-symbols-outlined'),createElement('div',{},[text(label,'data-label'),createElement('p',{className:'data-value',textContent:value||t('profile_value_not_provided')})])
        ]))),
        createElement('section',{className:'form-card profile-expiry-card'},[
            createElement('h3',{className:'form-section-title',textContent:t('company_documents_heading')}),
            button(formatTranslation('company_attachments_open',{count:data.allegati?.length||0}),()=>activate('documents'))
        ])
    ]);
    const qr=document.getElementById('company-digital-card');
    const options=[['ragioneSociale',t('company_qr_include_name')],['partitaIva',t('company_qr_include_vat')],['codiceSDI',t('company_qr_include_sdi')],['numeroCCIAA',t('company_qr_include_cciaa')],['dataIscrizione',t('company_qr_include_registration_date')],['referenteNome',t('company_qr_include_first_name')],['referenteCognome',t('company_qr_include_last_name')],['referenteTitolo',t('company_qr_include_role')],['referenteCellulare',t('company_qr_include_mobile')],['telefonoAzienda',t('phone')],['aziendaEmail',t('company_qr_include_pec')],['adminEmail',t('company_qr_include_admin_email')],['persEmail',t('company_qr_include_personal_email')],['qrLegale',t('company_qr_include_legal_address')]];
    const preview=createElement('div',{className:'company-qr-preview'});
    const config={...data.qrConfig};
    const refresh=()=>{ const vcard=buildVCard({...data,qrConfig:config}); renderQRCode(preview,vcard,{width:220,height:220,colorDark:'#000000',colorLight:'#ffffff'}); const capacity=document.getElementById('company-qr-capacity'); if(capacity) { const bytes=new TextEncoder().encode(vcard).length; capacity.textContent=bytes>1200 ? formatTranslation('digital_card_capacity_warning',{bytes}) : formatTranslation('digital_card_capacity_used',{bytes}); capacity.classList.toggle('is-warning',bytes>1200); } };
    const checks=options.map(([key,label])=>createElement('label',{className:'digital-card-choice'},[createElement('input',{type:'checkbox',checked:config[key]===undefined?!['adminEmail','persEmail','telefonoAzienda'].includes(key):Boolean(config[key]),onchange:event=>{config[key]=event.target.checked;refresh();}}),text(label)]));
    const save=button(t('company_card_save_selection'),async()=>{try{save.disabled=true;await updateDoc(doc(db,'users',auth.currentUser.uid,'aziende',companyId),{qrConfig:config});showToast(t('company_card_updated'),'success');await reload();}catch{showToast(t('company_card_update_error'),'error');}finally{save.disabled=false;}});
    const download=button(t('company_card_download_contact'),()=>{const blob=new Blob([buildVCard({...data,qrConfig:config})],{type:'text/vcard;charset=utf-8'});const url=URL.createObjectURL(blob);const a=createElement('a',{href:url,download:'contatto-azienda.vcf'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
    setChildren(qr,[createElement('div',{className:'digital-card-layout'},[
        createElement('section',{className:'form-card digital-card-preview'},[
            createElement('h2',{className:'form-section-title',textContent:t('digital_card_preview_title')}),preview,
            createElement('p',{className:'digital-card-warning',textContent:t('digital_card_plaintext_warning')}),
            createElement('p',{className:'digital-card-capacity',id:'company-qr-capacity'}),
            createElement('div',{className:'digital-card-actions'},[download])
        ]),
        createElement('section',{className:'form-card digital-card-fields'},[
            createElement('h2',{className:'form-section-title',textContent:t('digital_card_included_data')}),
            text(t('company_card_instruction'),'data-value-sub'),
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
            icon.className='material-symbols-outlined detail-section-icon notranslate';
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
            const action=miniButton(t('company_profile_edit'),'edit',event=>{
                event.stopPropagation();window.location.href=editUrl(companyId)+(type==='contacts'?'#section-email':'');
            });
            // Avoid nested buttons in accordion triggers.
            const row=createElement('div',{className:'profile-overview-heading'});
            header.before(row);row.append(header,action);
        }
    });
}
