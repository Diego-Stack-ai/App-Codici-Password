import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = (await readFile(new URL('../Frontend/public/assets/js/modules/data/private-account-offline-coordinator.js', import.meta.url), 'utf8'))
  .replace(/^import[^;]+;\r?\n/gm, '')
  .replace(/export (async )?function/g, '$1function');

test('coordinatore controlla avvio, online e ritorno visibile senza polling', async () => {
  const listeners = new Map(), events = [], notices = [];
  let flushes = 0, closed = 0, onState;
  const target = {
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); }
  };
  const sandbox = {
    navigator:{onLine:true},
    window:target,
    document:{...target,visibilityState:'visible'},
    CustomEvent:class { constructor(type,{detail}) { this.type=type;this.detail=detail; } },
    dispatchEvent:event=>events.push(event),
    createPrivateAccountPilotClient:async options=>{
      onState=options.onState;
      return {flush:async()=>{flushes++;return{status:'idle'}},close:()=>closed++};
    }
  };
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  await sandbox.startPrivateAccountOfflineCoordinator({uid:'owner',vaultKeyMaterial:'key',onAttention:state=>notices.push(state)});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(flushes,1);
  for(const fn of listeners.get('online')) await fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(flushes,2);
  for(const fn of listeners.get('visibilitychange')) await fn();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(flushes,3);
  const state={state:'reconciliation-required',operation:{operationId:'one'}};
  onState(state);onState(state);
  assert.equal(notices.length,1);assert.equal(events.at(-1).detail,state);
  sandbox.stopPrivateAccountOfflineCoordinator();
  assert.equal(closed,1);assert.equal(listeners.get('online').size,0);assert.equal(listeners.get('visibilitychange').size,0);
});

test('l’avviso globale identifica e apre direttamente l’Account interessato', async () => {
  const main = await readFile(new URL('../Frontend/public/assets/js/main-v129.js', import.meta.url), 'utf8');
  assert.match(main, /operation\.record\?\.nomeAccount\?\.trim\(\) \|\| 'Account senza nome'/);
  assert.match(main, /La modifica in attesa riguarda l’Account/);
  assert.match(main, /form_account_privato\.html\?id=\$\{encodeURIComponent\(recordId\)\}/);
  assert.doesNotMatch(main, /Apri l’Account interessato per decidere come procedere/);
});
