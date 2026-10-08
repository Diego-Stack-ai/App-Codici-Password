import {signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {collection, getDocsFromServer} from 'firebase/firestore';
import {auth, db} from 'reminder-local-config';
import {initHomeDeadlineReminders, renderHomeDeadlineInbox} from '../Frontend/public/assets/js/modules/home/home-deadline-inbox.js';
import {renderHomeDeadlineDashboard} from '../Frontend/public/assets/js/modules/home/home-deadline-dashboard.js';

const report=document.getElementById('probe-results');
const status=document.getElementById('probe-status');
const check=(ok,label)=>{const p=document.createElement('p');p.textContent=(ok?'PASS: ':'FAIL: ')+label;report.appendChild(p);if(!ok)throw Error(label);};
const phase=async value=>{const response=await fetch('/phase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phase:value})});if(!response.ok)throw Error('LOCAL_SEED_FAILED');return response.json();};
const refresh=async()=>{
 await getDocsFromServer(collection(db,'users',auth.currentUser.uid,'deadlineNotifications'));
 await getDocsFromServer(collection(db,'users',auth.currentUser.uid,'scadenze'));
 await renderHomeDeadlineDashboard(auth.currentUser);await renderHomeDeadlineInbox(auth.currentUser);
};
try{
 const credentials=await phase('start');
 await signInWithEmailAndPassword(auth,credentials.email,credentials.password);
 const ticket=window.privateAuthGate.begin(auth.currentUser.uid);
 if(!window.privateAuthGate.acceptIdentity(ticket,auth.currentUser))throw Error('LOCAL_IDENTITY_GATE_FAILED');
 check(Boolean(auth.currentUser),'accesso reale Auth emulator');
 await initHomeDeadlineReminders(auth.currentUser);
 check(document.querySelectorAll('.deadline-inbox-item').length===1,'lettura repository + Firestore + Rules');
 await phase('stages');await refresh();
 check(document.querySelectorAll('.deadline-inbox-item').length===1,'21→14→7 persistiti: un solo corrente');
 await phase('homonym');await refresh();
 check(document.querySelectorAll('.deadline-inbox-item').length===2,'due scadenze omonime restano separate');
 await phase('viewed');await refresh();
 check(document.getElementById('deadline-inbox-modal').textContent.includes('Già visto'),'avviso visto resta consultabile');
 await phase('expired');await refresh();
 check(!document.getElementById('deadline-inbox-modal')&&document.getElementById('expired-count').textContent==='2','scadute soltanto nelle Urgenze');
 await phase('reset');await refresh();
 check(document.querySelectorAll('.deadline-inbox-item').length===2,'date aggiornate lette dal database locale');
 if(new URLSearchParams(location.search).has('visual')){
  status.textContent='ANTEPRIMA LOCALE — dati sintetici, non app completa';
 }else{
 await signOut(auth);await new Promise(resolve=>setTimeout(resolve,0));
 check(!document.getElementById('deadline-inbox-modal'),'logout reale rimuove promemoria');
 let denied=false;try{await getDocsFromServer(collection(db,'users',credentials.uid,'deadlineNotifications'));}catch(error){denied=error.code==='permission-denied';}
 check(denied,'Rules negano lettura dopo logout');
 const result=await phase('verify');check(result.originals===2,'entrambe le scadenze originali conservate');
 status.textContent='SUPERATO — 10 controlli integrati Auth/Firestore locali';
 }
}catch(error){status.textContent='FALLITO — '+error.message;console.error(error);}
