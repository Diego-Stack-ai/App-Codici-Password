// Isolated browser probe: explicit in-memory routes, no Firebase, credentials or writes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const base = new URL('../Frontend/public/assets/js/', import.meta.url);
const paths = ['dom-utils.js', 'modules/scadenze/deadline-model.js', 'modules/home/home-deadline-dashboard.js', 'modules/home/home-deadline-inbox.js'];
const runtime = (await Promise.all(paths.map(p=>readFile(new URL(p,base),'utf8'))))
    .map(s=>s.replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'')).join('\n');
const setup = `
const RealDate=globalThis.Date; let clock=new RealDate(2026,9,17,12).getTime();
class Date extends RealDate {constructor(...a){super(...(a.length?a:[clock]));}static now(){return clock;}}
const auth={currentUser:{uid:'synthetic-A'}};
window.privateAuthGate={isReady:()=>true};
const t=key=>key;
const records=[{id:'s1',dueDate:'2026-10-17',type:'Bollo sintetico'},{id:'s2',dueDate:'2026-10-17',type:'Bollo sintetico'}];
let notifications=[{id:'n21',deadlineId:'s1',dueDate:'2026-10-17',diffDays:21,status:'unread'}];
const listDeadlines=async()=>records;
const listDeadlineNotifications=async()=>notifications;
const onAuthStateChanged=()=>()=>{};
`;
const checks = `
const out=document.getElementById('results');
const check=(ok,label)=>{const p=document.createElement('p');p.textContent=(ok?'PASS: ':'FAIL: ')+label;out.appendChild(p);if(!ok)throw Error(label);};
const refresh=async()=>{await renderHomeDeadlineDashboard(auth.currentUser);await renderHomeDeadlineInbox(auth.currentUser);};
try {
 await refresh();check(document.querySelectorAll('.deadline-inbox-item').length===1,'avviso a 21 giorni');
 for(const days of [14,7]){notifications.push({...notifications[0],id:'n'+days,diffDays:days});await refresh();check(document.querySelectorAll('.deadline-inbox-item').length===1,'sostituzione '+days+' giorni');}
 check(document.querySelector('.deadline-inbox-copy small').textContent.includes('Scade oggi'),'giorni ricalcolati');
 notifications.push({...notifications[0],id:'other',deadlineId:'s2'});await refresh();check(document.querySelectorAll('.deadline-inbox-item').length===2,'omonimi distinti');
 clock=new RealDate(2026,9,18).getTime();await refresh();check(!document.getElementById('deadline-inbox-modal')&&document.getElementById('expired-count').textContent==='2','giorno dopo: solo Urgenze');
 check(records.length===2&&records.every(x=>x.dueDate==='2026-10-17'),'scadenze originali intatte');
 clock=new RealDate(2026,9,17,12).getTime();
 records.splice(0,records.length,...Array.from({length:23},(_,i)=>({id:'page'+String(i).padStart(2,'0'),dueDate:'2026-10-17',type:'Scadenza sintetica '+i})));
 notifications=records.flatMap(d=>[21,14,7].map(days=>({id:d.id+'-'+days,deadlineId:d.id,dueDate:d.dueDate,diffDays:days,status:'unread'})));
 await refresh();check(document.querySelectorAll('.deadline-inbox-item').length===10,'prima pagina: 10 di 23 correnti');
 const next=()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Successivi');
 next().click();check(document.querySelectorAll('.deadline-inbox-item').length===10,'seconda pagina: altri 10');
 next().click();check(document.querySelectorAll('.deadline-inbox-item').length===3&&next().disabled,'terza pagina: ultimi 3, nessuna perdita');
 clock=new RealDate(2026,9,17,12).getTime();await initHomeDeadlineReminders(auth.currentUser);
 window.dispatchEvent(new Event('private-auth-blocked'));check(!document.getElementById('deadline-inbox-modal'),'blocco rimuove promemoria');
 document.getElementById('status').textContent='COLLAUDO SUPERATO — 11 controlli DOM reali, servizi simulati';
}catch(error){document.getElementById('status').textContent='COLLAUDO FALLITO: '+error.message;}
`;
const html = `<!doctype html><html lang="it"><meta charset="utf-8"><title>Prova locale promemoria</title><body><h1>Prova locale isolata</h1><p>Nessun collegamento a Firebase. Solo dati sintetici in memoria.</p><h2 id="status">In esecuzione</h2><section id="results"></section>${['upcoming','expired'].map(p=>`<section><h3>${p}</h3><span id="${p}-count"></span><span id="${p}-count-badge"></span><div id="${p}-list-container"></div></section>`).join('')}<script type="module" src="/probe.js"></script></body></html>`;
const routes=new Map([['/', ['text/html',html]], ['/probe.js',['text/javascript',setup+runtime+checks]]]);
createServer((req,res)=>{
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'none'; img-src 'none'; style-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'");
    res.setHeader('Cache-Control','no-store');
    const route=routes.get(req.url);if(!route){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',route[0]+'; charset=utf-8');res.end(route[1]);
}).listen(3087,'127.0.0.1',()=>console.log('Synthetic reminder probe: http://127.0.0.1:3087'));
