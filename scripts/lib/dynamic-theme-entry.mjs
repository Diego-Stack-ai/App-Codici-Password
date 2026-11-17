// Test-only composition root. All DOM components below are imported from the selected
// public tree. Synthetic repositories are installed by the bundler, never by the app.
import {initComponents} from '../../PUBLIC/assets/js/components-v129.js';
import {loadLanguage} from '../../PUBLIC/assets/js/translations.js';
import {createAssistantUI} from '../../PUBLIC/assets/js/modules/assistant/assistant-ui.js';
import {selectAttachmentSource, closeAttachmentSourcePicker} from '../../PUBLIC/assets/js/modules/shared/attachment-source-picker.js';
import {openProfileDocumentAttachments, closeProfileDocumentAttachments, renderProfileDocumentAttachmentPreviews} from '../../PUBLIC/assets/js/modules/privato/profile-document-attachments.js';
import {initProfileDashboard, activateProfileTab, renderDigitalCard} from '../../PUBLIC/assets/js/modules/privato/profilo-dashboard.js';
import {initProfileWidgets} from '../../PUBLIC/assets/js/modules/privato/profilo-widgets.js';
import {initQRModule, setupQRToggles, generateProfileQRCode, getProfileVCard, setQRScalar, toggleQRInclusion} from '../../PUBLIC/assets/js/modules/privato/profilo-qr.js';
import {initScadenze} from '../../PUBLIC/assets/js/modules/scadenze/scadenze.js';
import {showInputModal} from '../../PUBLIC/assets/js/ui-core-v129.js';
import {setupCollapsibleSections} from '../../PUBLIC/assets/js/modules/privato/profilo-ui.js';
import {initPrivateAttachmentModule,loadPrivateAttachments} from '../../PUBLIC/assets/js/modules/privato/dettaglio-privato-attachments.js';
import {initAttachmentModule,loadAttachments} from '../../PUBLIC/assets/js/modules/azienda/dettaglio-azienda-attachments.js';
import {createDeadlineAttachmentController} from '../../PUBLIC/assets/js/modules/scadenze/deadline-attachment-controller.js';

const state = {
  currentUserUid: 'synthetic-local-only', currentUserData: {name: 'Prova locale', nome: 'Prova', cognome: 'Locale'},
  contactPhones: [{id:'phone',number:'0000000000',label:'Fittizio'}], contactEmails:[{id:'email',address:'fixture@example.invalid'}],
  userAddresses:[], userDocuments:[], customWidgets:[],
  qrCodeInclusions:{nome:true,cf:false,nascita:false,photo:false,phones:[],emails:[],addresses:[]}
};
let assistant;
const implementedStates={
  'UI275-01':['initial','changed','reloaded'],'UI275-02':['locked','focus'],
  'UI275-03':['picker','dialog','inline','disabled','private-rows','company-rows','deadline-files','deadline-picker'],
  'UI275-04':['closed','open','hover','focus'],'UI275-05':['initial','scrolled'],
  'UI275-06':['checked','unchecked','digital-card'],'UI275-07':['inline','zoom'],
  'UI275-08':['expanded','collapsed','color-default','color-custom'],
  'UI275-09':['selected','keyboard','scrolled'],'UI275-10':['open','hover','focus'],
  'UI275-11':['valid','upcoming','expired','completed']
};
const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
function closeOverlays() {
  assistant?.destroy(); assistant=null;
  closeAttachmentSourcePicker(); closeProfileDocumentAttachments();
  for (const id of ['guide-modal-local','qr-zoom-modal-dynamic','protocol-input-modal']) document.getElementById(id)?.remove();
  document.body.style.overflow='';
}
async function boot() {
  await loadLanguage('it');
  if (location.pathname.endsWith('profilo_privato.html')) {
    await initComponents();
    initQRModule(() => state, {renderPhonesView(){},renderEmailsView(){},renderAddressesView(){}});
    const callbacks={getVCard:getProfileVCard,getQRPayload:getProfileVCard,setQRScalar,toggleQRInclusion,
      setWidgetFieldQr(){},downloadVCard(){},shareVCard(){},onTabActivated(name){ if(name==='digital-card') renderDigitalCard(); }};
    initProfileDashboard(() => state,callbacks);
    setupQRToggles();
    setupCollapsibleSections();
    await generateProfileQRCode();
    await initProfileWidgets({onChanged(widgets){state.customWidgets=widgets;}});
  } else if(location.pathname.endsWith('scadenze.html')) {
    await initComponents();
    await initScadenze({uid:'synthetic-local-only',email:'fixture@example.invalid'});
  }
  document.body.hidden=false;document.body.inert=false;
  document.documentElement.dataset.i18n='ready';
  window.__dynamicThemeReady=true;
}
window.__dynamicTheme = {
  async trigger(id, phase) {
    if(!implementedStates[id]?.includes(phase)) throw Error(`No real producer scenario implemented for ${id}/${phase}`);
    closeOverlays(); window.scrollTo(0,0);
    if(id==='UI275-01'||id==='UI275-02') {
      document.getElementById('frame-loading').hidden=id==='UI275-02';
      document.getElementById('frame-status').hidden=id==='UI275-01';
    }
    if(id==='UI275-03') {
      if(phase==='picker') void selectAttachmentSource();
      else if(phase==='dialog'||phase==='disabled') {
        window.__dynamicAttachmentLimit=phase==='disabled';
        await openProfileDocumentAttachments({uid:state.currentUserUid,documentItem:{id:'doc',type:'Documento fittizio'},vaultKey:{},encryptName:async name=>name});
      } else if(phase==='inline') {
        activateProfileTab('documents');
        const host=document.querySelector('#documenti-view-container');
        if(host.classList.contains('collapsed')) document.querySelector('.collapsible-header[data-section="documenti"]').click();
        const mount=document.createElement('div');mount.dataset.profileDocumentAttachmentsInline='doc';host.append(mount);
        await renderProfileDocumentAttachmentPreviews({uid:state.currentUserUid,documentItems:[{id:'doc'}],vaultKey:{},decryptName:async()=> 'Allegato fittizio.pdf'});
      } else if(phase==='private-rows') {
        initPrivateAttachmentModule({ownerId:state.currentUserUid,currentUid:state.currentUserUid,accountId:'synthetic',account:{}});
        await loadPrivateAttachments();
      } else if(phase==='company-rows') {
        initAttachmentModule({ownerUid:state.currentUserUid,currentUid:state.currentUserUid,currentAziendaId:'synthetic-company',currentId:'synthetic',account:{}});
        await loadAttachments();
      } else if(phase==='deadline-files'||phase==='deadline-picker') {
        const controller=createDeadlineAttachmentController();controller.init();
        controller.setExistingAttachments([{id:'synthetic-file',name:'Documento inventato.pdf'}]);
        if(phase==='deadline-picker') document.getElementById('btn-trigger-upload').click();
      }
    }
    if(id==='UI275-04') {
      if(!document.querySelector('link[data-dynamic-assistant-css]')) {
        const link=document.createElement('link');link.rel='stylesheet';link.href='/assets/css/vault-assistant.css';link.dataset.dynamicAssistantCss='true';
        document.head.append(link);await new Promise((resolve,reject)=>{link.onload=resolve;link.onerror=reject;});
      }
      assistant=createAssistantUI({onAsk:async()=>({message:'Risposta sintetica',items:[]}),onClose(){assistant?.destroy();},resolveCredential:async()=>''});
      if(phase!=='closed') document.querySelector('.vault-assistant-help').click();
    }
    if(id==='UI275-05') {
      activateProfileTab('personal');
      const main=document.querySelector('main.base-main');
      main.scrollTop=phase==='scrolled'?main.scrollHeight:0;
    }
    if(id==='UI275-06') {
      activateProfileTab(phase==='digital-card'?'digital-card':'personal');
      const input=document.getElementById('qr-toggle-nome');
      if(phase!=='digital-card' && input.checked !== (phase==='checked')) input.click();
    }
    if(id==='UI275-07') {
      activateProfileTab('digital-card');await generateProfileQRCode();
      if(phase==='zoom') document.getElementById('qrcode-header').click();
    }
    if(id==='UI275-08') {
      activateProfileTab('personal');
      if(phase==='color-default'||phase==='color-custom') {
        window.__dynamicWidgetColor=phase==='color-default'?'':'#c026d3';
        await initProfileWidgets({onChanged(widgets){state.customWidgets=widgets;}});
      }
      const button=[...document.querySelectorAll('.profile-widget-actions button')].find(el=>el.textContent==='Comprimi'||el.textContent==='Apri');
      if(!button) throw Error('Real widget producer did not render');
      if((phase==='collapsed') !== (button.textContent==='Apri')) button.click();
    }
    if(id==='UI275-09') {
      document.querySelector('[data-profile-tab-target="personal"]').click();
      if(phase==='keyboard') document.querySelector('[data-profile-tab-target="personal"]').dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));
      if(phase==='scrolled') document.querySelector('.profile-tabs').scrollLeft=10000;
    }
    if(id==='UI275-10') document.querySelector('button[title="Guida Profilo"]').click();
    if(id==='UI275-11') {
      document.querySelector(`[data-filter="${phase==='completed'?'completed':'all'}"]`)?.click();
    }
    await tick(); await new Promise(resolve=>setTimeout(resolve,30));
    window.__dynamicLastTrigger={id,phase};
  },
  unlock() { void showInputModal('Sblocco Vault','','Master Password','Solo fixture: nessun materiale crittografico.'); },
  state
};
boot().catch(error=>{window.__dynamicThemeError=error.stack||String(error);});
