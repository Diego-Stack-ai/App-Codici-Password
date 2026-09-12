import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const asModule = text => 'data:text/javascript;base64,' + Buffer.from(text).toString('base64');
const modelURL = asModule(await read('assets/js/modules/shared/contact-card-model.js'));
const {readContactCard, embedContactPhoto, validatePhotoURL, contactDetails} = await import(modelURL);
const {buildVCard, buildProfileQrPayload} = await import(asModule(await read('assets/js/modules/shared/qr_code_utils-v2.js')));
const {prepareContactVCard} = await import(asModule((await read('assets/js/modules/shared/contact-card-photo.js')).replace('./contact-card-model.js', modelURL)));
const avatar = 'https://firebasestorage.googleapis.com/v0/b/appcodici-password.firebasestorage.app/o/users%2Ffixture%2Favatar_fixture.jpg?alt=media&token=fixture';
const user = {nome:'Èva', cognome:'D’Amico', photoURL:avatar};
const raw = buildVCard(user, {photo:true, nome:true, phones:['p']}, {contactPhones:[{id:'p',number:'+39 0000'}]});
const payload = buildProfileQrPayload(raw, 'https://appcodici-password.web.app');
const card = readContactCard(new URL(payload).hash);

test('received preview exposes every selected contact field and preserves escaped values', () => {
    const vcard = buildVCard({...user, birth_date:'1980-01-02', birth_place:'Roma'}, {photo:true,nome:true,nascita:true,phones:['p','f'],emails:['e'],addresses:['a']}, {
        contactPhones:[{id:'p',number:'+39 111'},{id:'f',number:'+39 222'}],
        contactEmails:[{id:'e',address:'prova@example.test'},{id:'hidden',address:'excluded@example.test'}],
        userAddresses:[{id:'a',address:'Via Uno; Due',civic:'3',city:'Roma',cap:'00100'}]
    });
    const parsed = readContactCard(new URL(buildProfileQrPayload(vcard,'https://appcodici-password.web.app')).hash);
    const details = contactDetails(parsed);
    assert.deepEqual(details.filter(item=>item.label==='Telefono').map(item=>item.value),['+39 111','+39 222']);
    assert.ok(details.some(item=>item.label==='Email' && item.value==='prova@example.test'));
    assert.ok(details.some(item=>item.label==='Indirizzo' && item.value==='Via Uno; Due 3, Roma, 00100'));
    assert.ok(details.some(item=>item.label==='Nome' && item.value==='Èva'));
    assert.ok(details.some(item=>item.label==='Cognome' && item.value==='D’Amico'));
    assert.doesNotMatch(JSON.stringify(details), /excluded@example|PHOTO|token=/);
    const imported = embedContactPhoto(parsed,'data:image/jpeg;base64,/9j/2Q==');
    assert.match(imported,/EMAIL:prova@example.test/);
    assert.match(imported,/TEL:\+39 222/);
});

test('photo QR contains a same-origin receiver URL and only selected fields in the fragment', () => {
    const url = new URL(payload);
    assert.equal(url.pathname, '/contatto_condiviso.html');
    assert.equal(url.search, '');
    assert.equal(card.name, 'Èva D’Amico');
    assert.equal(card.photoURL, avatar);
    assert.ok(card.lines.includes('TEL:+39 0000'));
    assert.ok(!card.lines.some(line => /PHOTO|password|PIN/.test(line)));
    const noPhoto = buildVCard(user, {nome:true});
    assert.equal(buildProfileQrPayload(noPhoto, url.origin), noPhoto);
});

test('download contains actual JPEG bytes, folded correctly, and no remote PHOTO reference', () => {
    const bytes = Buffer.from([255,216,...Array(400).fill(17),255,217]);
    const vcard = embedContactPhoto(card, 'data:image/jpeg;base64,' + bytes.toString('base64'));
    const unfolded = vcard.replace(/\r\n /g,'');
    assert.match(unfolded, /PHOTO;ENCODING=b;TYPE=JPEG:/);
    assert.doesNotMatch(unfolded, /PHOTO;VALUE=URI/);
    const photo = unfolded.match(/PHOTO;ENCODING=b;TYPE=JPEG:([^\r]+)/)[1];
    assert.deepEqual(Buffer.from(photo,'base64'),bytes);
    assert.match(vcard, /FN:Èva D’Amico/);
    assert.match(vcard, /TEL:\+39 0000/);
    assert.match(vcard, /END:VCARD\r\n$/);
});

test('untrusted or oversized QR fragments and foreign photo URLs are rejected', () => {
    for (const value of ['', '#card=!', '#card='+'a'.repeat(16001)]) assert.throws(()=>readContactCard(value));
    for (const value of ['http://localhost/a.jpg', 'https://example.test/pixel.jpg', avatar.replace('appcodici-password.firebasestorage.app','other.appspot.com'), avatar.replace('avatar_fixture.jpg','secret.pdf'), 'javascript:alert(1)']) assert.throws(()=>validatePhotoURL(value));
    for (const value of [raw.replace('END:VCARD','BEGIN:VCARD\nEND:VCARD'),raw.replace('END:VCARD','X-UNEXPECTED:data\nEND:VCARD'),raw.replace('END:VCARD',`PHOTO;VALUE=URI:${avatar}\nEND:VCARD`)]) {
        assert.throws(()=>readContactCard(new URL(buildProfileQrPayload(value,'https://appcodici-password.web.app')).hash));
    }
    assert.throws(()=>embedContactPhoto(card,'data:image/svg+xml;base64,PHN2Zz4='));
});

test('photo download failure is not silently replaced with a contact without its photo', async () => {
    await assert.rejects(prepareContactVCard(card,{loadPhoto:async()=>{throw new Error('offline');}}),/offline/);
    const prepared = await prepareContactVCard(card,{loadPhoto:async()=>new Blob(['fixture']),encodePhoto:async()=> 'data:image/jpeg;base64,/9j/2Q=='});
    assert.match(prepared.vcard, /PHOTO;ENCODING=b;TYPE=JPEG:/);
});

test('receiver works without login and owner preview contains only the QR, not the avatar', async () => {
    const page = await read('contatto_condiviso.html');
    const receiver = await read('assets/js/contact-card-receiver.js');
    assert.doesNotMatch(page+receiver,/firebase-config|main\.js|signIn|localStorage|sessionStorage/);
    assert.match(page,/name="referrer" content="no-referrer"/);
    assert.match(receiver,/window\.location\.hash/);
    assert.match(receiver,/textContent = card.name/);
    assert.doesNotMatch(await read('assets/js/modules/privato/profilo-dashboard.js'),/digital-card-avatar/);
});
