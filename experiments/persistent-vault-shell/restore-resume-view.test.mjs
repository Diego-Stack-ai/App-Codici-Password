import test from 'node:test';
import assert from 'node:assert/strict';
import {mountRestoreResume} from './restore-resume-view.mjs';
class Node extends EventTarget {
  constructor(tag) {super(); this.tag = tag; this.children = []; this.value = '';}
  append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
  remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
  setAttribute() {}
  all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('missing parent preview blocks creation and explains retained staged attachments', async () => {
  const root = new Node('main'), abort = new AbortController();
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {dispose() {},
    async previewNew() {throw Error('RESUME_ATTACHMENT_PARENT_MISSING');}, async create() {assert.fail('creation');}}});
  const button = label => root.all('button').find(node => node.textContent === label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click')); await tick();
  assert.ok(root.all('p').some(node => /manca l’Account padre/.test(node.textContent)));
  assert.ok(root.all('p').some(node => /non sono cancellati/.test(node.textContent)));
  assert.equal(button('Conferma creazione piano').disabled, true); abort.abort();
});

test('bank dependency rejection after selection explains the block without claiming rollback', async () => {
  const root=new Node('main'),abort=new AbortController();
  mountRestoreResume(root,{signal:abort.signal,assertUnlocked(){}},{source:{dispose(){},
    async previewNew(){return{records:2,chunks:1};},async create(){throw Error('RESUME_WIDGET_BANK_MISSING');}}});
  const button=label=>root.all('button').find(node=>node.textContent===label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));await tick();
  button('Conferma creazione piano').dispatchEvent(new Event('click'));await tick();
  assert.ok(root.all('p').some(node=>/conto collegato al widget manca/.test(node.textContent)));
  assert.ok(root.all('p').some(node=>/non li annulla/.test(node.textContent)));
  assert.equal(button('Conferma ripresa').disabled,true);abort.abort();
});

test('unsupported scope and generation have explicit fixed explanations', async () => {
  for (const [error, text] of [[Error('RESUME_SCOPE_NOT_CONNECTED'), /ambiti non ancora supportati/],
    [Object.assign(Error('private details'), {code: 'GENERATION_UNSUPPORTED'}), /versione esatta dell’allegato/]]) {
    const root = new Node('main'), abort = new AbortController();
    mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {dispose() {}, async previewNew() {throw error;}}});
    root.all('button').find(node => node.textContent === 'Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));
    await tick();
    assert.ok(root.all('p').some(node => text.test(node.textContent)));
    assert.ok(!root.all('p').some(node => /private details/.test(node.textContent)));
    abort.abort();
  }
});

test('timestamp rejection after partial resume never promises global rollback',async()=>{
  const root=new Node('main'),abort=new AbortController();
  mountRestoreResume(root,{signal:abort.signal,assertUnlocked(){}},{source:{dispose(){},
    async prepare(){return{applied:1,total:2};},async resume(){throw Error('BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED');}}});
  const buttons=root.all('button');
  buttons.find(node=>node.textContent.startsWith('Verifica')).dispatchEvent(new Event('click'));await tick();
  buttons.find(node=>node.textContent==='Conferma ripresa').dispatchEvent(new Event('click'));await tick();
  assert.ok(root.all('p').some(node=>/blocchi già completati restano applicati/.test(node.textContent)));
  assert.ok(!root.all('p').some(node=>/nessun dato ripristinato/i.test(node.textContent)));abort.abort();
});

test('cross-chunk dependency rejection explains that no plan was created',async()=>{
  const root=new Node('main'),abort=new AbortController();
  mountRestoreResume(root,{signal:abort.signal,assertUnlocked(){}},{source:{dispose(){},
    async previewNew(){return{records:3,chunks:2};},async create(){throw Error('RESUME_DEPENDENCY_CROSS_CHUNK');}}});
  const button=label=>root.all('button').find(node=>node.textContent===label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));await tick();
  button('Conferma creazione piano').dispatchEvent(new Event('click'));await tick();
  assert.ok(root.all('p').some(node=>/Piano non creato:/.test(node.textContent)));
  assert.equal(button('Conferma ripresa').disabled,true);abort.abort();
});

test('oversized dependency group explains the block and never enables creation',async()=>{
  const root=new Node('main'),abort=new AbortController();let created=0;
  mountRestoreResume(root,{signal:abort.signal,assertUnlocked(){}},{source:{dispose(){},
    async previewNew(){throw Error('RESUME_DEPENDENCY_GROUP_TOO_LARGE');},async create(){created++;}}});
  const button=label=>root.all('button').find(node=>node.textContent===label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));await tick();
  assert.ok(root.all('p').some(node=>/supera il limite di un blocco atomico/.test(node.textContent)));
  assert.equal(button('Conferma creazione piano').disabled,true);
  button('Conferma creazione piano').dispatchEvent(new Event('click'));await tick();assert.equal(created,0);abort.abort();
});
test('overwrite UI starts unselected and requires explicit selection before creating a plan',async()=>{
  const root=new Node('main'),abort=new AbortController(),calls=[];
  mountRestoreResume(root,{signal:abort.signal,assertUnlocked(){}},{source:{dispose(){},
    async previewNew(){return {records:2,chunks:1,existing:2,choices:[{key:'0:0',scope:'private-account',id:'a',status:'changed'},
      {key:'0:1',scope:'private-account',id:'b',status:'changed'}]};},
    selectRecords(keys,confirmation){calls.push({keys,confirmation});return{records:1,chunks:1,attachments:0};},
    async create(){calls.push('create');return{planId:'selected'};}}});
  const button=text=>root.all('button').find(node=>node.textContent===text);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));await tick();
  const checks=root.all('input').filter(node=>node.type==='checkbox');assert.ok(checks.every(node=>node.checked===false));
  assert.equal(button('Conferma creazione piano').disabled,true);checks[1].checked=true;
  button('Conferma selezione e sostituzione degli esistenti').dispatchEvent(new Event('click'));
  assert.deepEqual(calls,[{keys:['0:1'],confirmation:'RESTORE_SELECTED_OVERWRITE'}]);
  button('Conferma creazione piano').dispatchEvent(new Event('click'));await tick();assert.equal(calls[1],'create');abort.abort();
});
test('new plan UI separates preview, creation and execution and displays server plan ID', async () => {
  const root = new Node('main'), abort = new AbortController(), actions = [];
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {
    async previewNew() {actions.push('preview'); return {records: 1, chunks: 1};},
    async create() {actions.push('create'); return {planId: 'server-plan'};},
    async resume() {actions.push('resume'); return {status: 'completed'};}, dispose() {}
  }});
  const button = label => root.all('button').find(node => node.textContent === label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click')); await tick();
  assert.deepEqual(actions, ['preview']); assert.equal(button('Conferma ripresa').disabled, true);
  button('Conferma creazione piano').dispatchEvent(new Event('click')); await tick();
  assert.deepEqual(actions, ['preview', 'create']); assert.equal(root.all('input')[0].value, 'server-plan');
  button('Conferma ripresa').dispatchEvent(new Event('click')); await tick();
  assert.deepEqual(actions, ['preview', 'create', 'resume']); abort.abort();
});
test('attachment UI blocks creation until separately confirmed staging succeeds', async () => {
  const root = new Node('main'), abort = new AbortController(), actions = []; let attempts = 0;
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {
    async previewNew() {actions.push('preview'); return {records: 1, chunks: 1, attachments: 1};},
    async stageAttachments() {actions.push('stage'); if (++attempts === 1) throw Error('lost'); return {staged: 1};},
    async create() {actions.push('create'); return {planId: 'server-plan'};}, dispose() {}
  }});
  const button = label => root.all('button').find(node => node.textContent === label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click')); await tick();
  const create = button('Conferma creazione piano'), stage = button('Conferma caricamento allegati nel laboratorio');
  assert.equal(create.disabled, true); create.dispatchEvent(new Event('click')); await tick();
  assert.deepEqual(actions, ['preview']);
  stage.dispatchEvent(new Event('click')); await tick(); assert.equal(create.disabled, true); assert.equal(stage.disabled, false);
  stage.dispatchEvent(new Event('click')); await tick(); assert.equal(create.disabled, false); assert.equal(stage.disabled, true);
  create.dispatchEvent(new Event('click')); await tick();
  assert.deepEqual(actions, ['preview', 'stage', 'stage', 'create']); abort.abort();
});

test('resume UI requires verification and confirmation, wipes secrets and retries without rereading', async () => {
  const root = new Node('main'), abort = new AbortController(); let prepared = 0, sent = 0, disposed = 0;
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {
    async prepare(data) {prepared++; assert.equal(data.recoveryKey, 'SYNTHETIC-KEY'); return {applied: 1, total: 2};},
    async resume() {sent++; if (sent === 1) throw Error('lost'); return {status: 'completed'};}, dispose() {disposed++;}
  }});
  const [plan, file, key] = root.all('input'), [inspect, resume] = root.all('button');
  assert.equal(resume.disabled, true); key.value = 'SYNTHETIC-KEY'; plan.value = 'plan'; file.files = [{}];
  inspect.dispatchEvent(new Event('click')); await tick();
  assert.equal(key.value, ''); assert.equal(file.value, ''); assert.equal(sent, 0); assert.equal(resume.disabled, false);
  resume.dispatchEvent(new Event('click')); await tick();
  assert.equal(resume.disabled, false); assert.equal(inspect.disabled, true);
  resume.dispatchEvent(new Event('click')); await tick();
  assert.equal(prepared, 1); assert.equal(sent, 2); assert.equal(resume.disabled, true);
  assert.equal(disposed, 1); abort.abort(); assert.equal(root.children.length, 0);
});
test('mixed backup UI needs explicit missing-only selection before create', async () => {
  const root=new Node('main'),abort=new AbortController(),calls=[];
  mountRestoreResume(root,{signal:abort.signal,assertUnlocked(){}},{source:{
    async previewNew(){return {records:2,chunks:1,existing:1};},
    selectMissingOnly(){calls.push('selection');return {records:1,chunks:1,attachments:0};},
    async create(){calls.push('create');return {planId:'selected'};},dispose(){}
  }});
  const button=label=>root.all('button').find(node=>node.textContent===label);
  button('Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));await tick();
  assert.equal(button('Conferma creazione piano').disabled,true);
  button('Conferma creazione piano').dispatchEvent(new Event('click'));await tick();assert.deepEqual(calls,[]);
  button('Conserva esistenti e seleziona solo mancanti').dispatchEvent(new Event('click'));
  assert.equal(button('Conferma creazione piano').disabled,false);
  button('Conferma creazione piano').dispatchEvent(new Event('click'));await tick();
  assert.deepEqual(calls,['selection','create']);abort.abort();
});

test('unsupported timestamp precision has an explicit non-rounding explanation', async () => {
  const root = new Node('main'), abort = new AbortController();
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {
    async previewNew() {throw Error('BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED');}, dispose() {}
  }});
  root.all('button').find(node => node.textContent === 'Anteprima nuovo piano isolato').dispatchEvent(new Event('click'));
  await tick();
  assert.ok(root.all('p').some(node => /precisione non rappresentabile/.test(node.textContent) && /Nessun arrotondamento/.test(node.textContent)));
  assert.equal(root.all('button').find(node => node.textContent === 'Conferma creazione piano').disabled, true); abort.abort();
});

test('cleanup follows only returned page cursor and preserves cursor on uncertain response', async () => {
  const root = new Node('main'), abort = new AbortController(), cursors = [];
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {
    async cleanupExpired(after) {cursors.push(after); if (cursors.length === 2) throw Error('lost');
      return {removed: 1, retained: 2, rejected: 0, next: cursors.length === 1 ? 'a'.repeat(64) : null};}, dispose() {}
  }});
  const cleanup = root.all('button').find(node => node.textContent.startsWith('Rimuovi solo'));
  for (let index = 0; index < 3; index++) {cleanup.dispatchEvent(new Event('click')); await tick();}
  assert.deepEqual(cursors, [null, 'a'.repeat(64), 'a'.repeat(64)]); abort.abort();
});

test('lock disposes pending UI and late verification cannot reenable it', async () => {
  const root = new Node('main'), abort = new AbortController(); let resolve, disposed = 0;
  mountRestoreResume(root, {signal: abort.signal, assertUnlocked() {}}, {source: {
    prepare: () => new Promise(done => {resolve = done;}), dispose() {disposed++;}
  }});
  root.all('input')[2].value = 'SECRET'; root.all('button')[0].dispatchEvent(new Event('click'));
  abort.abort(); resolve({applied: 0, total: 1}); await tick();
  assert.equal(disposed, 1); assert.equal(root.children.length, 0);
});
