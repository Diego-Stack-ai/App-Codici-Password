import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const strip = source => source.replace(/^import .*;\r?\n/gm, '').replace(/\bexport /g, '');
const sources = await Promise.all(['scadenze/deadline-model.js', 'home/home-deadline-dashboard.js', 'home/home-deadline-inbox.js'].map(read));
const model = await import(`data:text/javascript;base64,${Buffer.from(sources[0]).toString('base64')}`);
const notification = (id, days, extra = {}) => ({id, deadlineId: 's1', dueDate: '2026-10-17', diffDays: days, status: 'unread', ...extra});
const deadline = {id: 's1', dueDate: '2026-10-17', type: 'Bollo'};
const project = (items, records = [deadline], now = new Date(2026, 8, 26)) => model.projectDeadlineReminders(items, new Map(records.map(x => [x.id, x])), now);

test('21→14→7 replaces by identity even with out-of-order arrival; source untouched', () => {
    const items = [notification('21', 21), notification('14', 14), notification('7', 7)];
    const before = JSON.stringify({items, deadline});
    for (let count = 1; count <= 3; count++) {
        assert.equal(project(items.slice(0, count))[0].notification.id, items[count - 1].id);
    }
    assert.equal(project([items[2], items[0], items[1]])[0].notification.id, '7');
    assert.equal(project(items)[0].diffDays, 21);
    assert.equal(JSON.stringify({items, deadline}), before);
});
test('viewed remains; resolved latest does not resurrect old events; deterministic tie', () => {
    const old = notification('old', 14);
    assert.equal(project([old, notification('new', 7, {status:'viewed'})])[0].notification.status, 'viewed');
    assert.equal(project([old, notification('new', 7, {status:'resolved'})]).length, 0);
    assert.equal(project([notification('a', 7), notification('b', 7, {status:'resolved'})]).length, 0);
    assert.equal(project([notification('z', 7), notification('a', 7)])[0].notification.id, 'a');
});
test('same names remain separate; obsolete dates, completed and missing sources excluded', () => {
    const items = [notification('n1', 7), notification('n2', 7, {deadlineId:'s2'})];
    assert.equal(project(items, [deadline, {...deadline, id:'s2'}]).length, 2);
    assert.equal(project(items, [{...deadline, dueDate:'2026-10-18'}]).length, 0);
    assert.equal(project(items, [{...deadline, completed:true}]).length, 0);
    assert.equal(project(items, []).length, 0);
});
test('today stays visible, next day only urgent; malformed records excluded', () => {
    assert.equal(project([notification('n', 0)], [deadline], new Date(2026, 9, 17, 23, 59))[0].diffDays, 0);
    assert.equal(project([notification('n', 0)], [deadline], new Date(2026, 9, 18)).length, 0);
    assert.equal(model.deadlineBucket(deadline, new Date(2026, 9, 18)), 'urgent');
    assert.equal(project([null, notification('', 7), notification('n', 7, {status:'unknown'})]).length, 0);
});

function fixture() {
    let clock = new Date(2026, 9, 17, 23, 59, 59).getTime();
    class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() {return clock;} }
    const nodes = [], events = new Map(), timers = new Map(), callbacks = [], reads = [];
    let nextTimer = 0;
    const node = (tag, props = {}, children = []) => {
        const classes = new Set((props.className || '').split(' '));
        return {tag, ...props, children, removed:false,
            classList:{add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x), toggle:(x,on)=>on?classes.add(x):classes.delete(x)},
            appendChild(x) {this.children.push(x);}, replaceChildren(...xs) {this.children=xs;}, remove() {this.removed=true;}};
    };
    for (const prefix of ['upcoming','expired']) for (const suffix of ['count','count-badge','list-container']) nodes.push(node('div', {id:`${prefix}-${suffix}`}));
    const eventTarget = {addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(fn);}, removeEventListener:(name,fn)=>events.get(name)?.delete(fn)};
    const document = {...eventTarget, visibilityState:'visible', body:{appendChild:n=>nodes.push(n)}, getElementById:id=>nodes.find(n=>!n.removed&&n.id===id)};
    const auth = {currentUser:{uid:'A'}};
    const data = {notifications:[notification('n21',21),notification('n7',7)], records:[structuredClone(deadline)]};
    let pending = null, fail = false, ready = true;
    const context = vm.createContext({Date:Clock, console:{warn(){}}, auth, document,
        window:{...eventTarget, location:{href:''}, privateAuthGate:{isReady:()=>ready}},
        setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
        requestAnimationFrame:fn=>fn(), createElement:node, clearElement:n=>n.replaceChildren(), setChildren:(n,xs)=>n.replaceChildren(...xs), t:key=>key,
        listDeadlines:async uid=>{reads.push(uid);if(pending)await pending;if(fail)throw Error('synthetic');return data.records;},
        listDeadlineNotifications:async uid=>{reads.push(uid);if(pending)await pending;if(fail)throw Error('synthetic');return data.notifications;},
        onAuthStateChanged:(_auth,fn)=>{const cb={fn,stopped:false};callbacks.push(cb);return ()=>cb.stopped=true;}
    });
    vm.runInContext(sources.map(strip).join('\n'), context);
    const drain = async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
    const fire = async name=>{for(const fn of [...(events.get(name)||[])])fn();await drain();};
    const modal = ()=>document.getElementById('deadline-inbox-modal');
    const walk = n=>n?[n,...n.children.flatMap(walk)]:[];
    return {data, reads, auth, document, context, callbacks, timers, modal, walk, drain, fire,
        start:()=>vm.runInContext('initHomeDeadlineReminders(auth.currentUser)',context),
        render:()=>vm.runInContext('renderHomeDeadlineInbox(auth.currentUser)',context),
        text:()=>walk(modal()).map(x=>x.textContent||'').join(' '),
        setDate:date=>clock=date.getTime(), setReady:value=>ready=value, setFail:value=>fail=value,
        defer:()=>{let release;pending=new Promise(resolve=>release=resolve);return ()=>{pending=null;release();};},
        tick:async()=>{const [id,{fn}]=timers.entries().next().value;timers.delete(id);fn();await drain();}
    };
}
test('real renderers: one reminder, current date, viewed label, valid deep link', async () => {
    const f=fixture(); await f.start();
    assert.equal(f.walk(f.modal()).filter(n=>n.className==='deadline-inbox-item').length,1);
    assert.match(f.text(), /Scade oggi.*17\/10\/2026/);
    assert.equal(f.document.getElementById('expired-count').textContent,0);
    f.data.notifications[1].status='viewed';await f.fire('visibilitychange');
    assert.match(f.text(),/Già visto/);
    f.walk(f.modal()).find(n=>n.className==='deadline-inbox-item').onclick();
    assert.equal(f.context.window.location.href,'dettaglio_scadenza.html?id=s1&notification=n7');
    assert.ok(f.reads.every(uid=>uid==='A'));
});
test('dismiss remains closed on unchanged refresh; a new stage opens; empty removes modal', async () => {
    const f=fixture();await f.start();
    f.walk(f.modal()).find(n=>n.textContent==='Ricordamelo dopo').onclick();
    await f.fire('visibilitychange');assert.equal(f.modal().classList.contains('active'),false);
    f.data.notifications.push(notification('n0',0));await f.fire('visibilitychange');
    assert.equal(f.modal().classList.contains('active'),true);
    f.data.notifications=[];await f.fire('visibilitychange');assert.equal(f.modal(),undefined);
});
test('midnight timer updates both surfaces without simultaneous reminder and urgency', async () => {
    const f=fixture();await f.start();assert.equal([...f.timers.values()][0].ms,1000);
    f.setDate(new Date(2026,9,18));await f.tick();
    assert.equal(f.modal(),undefined);
    assert.equal(f.document.getElementById('expired-count').textContent,1);
    assert.equal(f.document.getElementById('upcoming-count').textContent,0);
});
for(const event of ['pagehide','private-auth-blocked']) test(`${event} clears views and prevents pending responses from mounting`,async()=>{
    const f=fixture();await f.start();const old=f.walk(f.modal()).find(n=>n.className==='deadline-inbox-item');
    const release=f.defer();const pending=f.render();await f.fire(event);release();await pending;
    old.onclick();assert.equal(f.context.window.location.href,'');assert.equal(f.modal(),undefined);
    assert.equal(f.timers.size,0);assert.equal(f.callbacks[0].stopped,true);
});
test('UID change and closed gate cannot mount; old same-UID session cannot overwrite new one',async()=>{
    const f=fixture();const release=f.defer();const first=f.start();
    f.auth.currentUser={uid:'B'};f.callbacks[0].fn(f.auth.currentUser);release();await first;
    assert.equal(f.modal(),undefined);
    f.setReady(false);await f.start();assert.equal(f.modal(),undefined);
    f.setReady(true);const unlock=f.defer();const stale=f.start();const fresh=f.start();unlock();await Promise.all([stale,fresh]);
    assert.ok(f.modal());assert.equal(f.callbacks.filter(x=>!x.stopped).length,1);
});
test('read failures clear stale data; completed or changed-date deadlines disappear',async()=>{
    const f=fixture();await f.start();f.data.records[0].completed=true;await f.fire('visibilitychange');assert.equal(f.modal(),undefined);
    f.data.records[0].completed=false;f.data.records[0].dueDate='2026-10-18';await f.fire('visibilitychange');assert.equal(f.modal(),undefined);
    f.data.records[0].dueDate='2026-10-17';await f.fire('visibilitychange');assert.ok(f.modal());
    f.setFail(true);await f.fire('visibilitychange');assert.equal(f.modal(),undefined);
});

test('pagination bounds DOM to ten after dedup and reaches every current reminder',async()=>{
    const f=fixture();
    f.data.records=Array.from({length:23},(_,i)=>({...deadline,id:`s${String(i).padStart(2,'0')}`}));
    f.data.notifications=f.data.records.flatMap(d=>[21,14,7].map(days=>notification(`${d.id}-${days}`,days,{deadlineId:d.id})));
    await f.start();
    const buttons=()=>f.walk(f.modal()).filter(n=>n.className==='deadline-inbox-item');
    const next=()=>f.walk(f.modal()).find(n=>n.textContent==='Successivi');
    assert.equal(buttons().length,10);
    const seen=[];
    for(let page=0;page<3;page++) {
        for(const button of buttons()){button.onclick();seen.push(f.context.window.location.href);}
        if(page<2)next().onclick();
    }
    assert.equal(buttons().length,3);assert.equal(next().disabled,true);
    assert.equal(new Set(seen).size,23);assert.ok(seen.every(x=>x.endsWith('-7')));
    await f.fire('visibilitychange');assert.equal(buttons().length,3);
    f.data.notifications=[];await f.fire('visibilitychange');assert.equal(f.modal(),undefined);
});

test('dashboard keeps the calendar 30-day window and caps previews at three',async()=>{
    const f=fixture();
    f.data.records=[0,1,2,30,31,-1].map((days,i)=>({...deadline,id:`s${i}`,dueDate:new Date(2026,9,17+days)}));
    await f.start();
    assert.equal(f.document.getElementById('upcoming-count').textContent,4);
    assert.equal(f.document.getElementById('upcoming-list-container').children.length,3);
    assert.equal(f.document.getElementById('expired-count').textContent,1);
});
