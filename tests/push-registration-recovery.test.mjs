import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

test('il runtime rinnova un token push invalidato conservando gli ambiti scelti', async () => {
    const push = await readFile('Frontend/public/assets/js/modules/shared/push-manager.js', 'utf8');
    const main = await readFile('Frontend/public/assets/js/main-v129.js', 'utf8');
    const repository = await readFile('Frontend/public/assets/js/modules/data/vault-repository.js', 'utf8');

    assert.match(repository, /getPushDeviceConfirmed/);
    assert.match(push, /export async function recoverPushRegistration/);
    assert.match(push, /device\?\.status === 'invalid'/);
    assert.match(push, /resetLocalPushSubscription\(messaging, registration\)/);
    assert.match(push, /rememberedActiveScopes\(\)/);
    assert.match(main, /await recoverPushRegistration\(user\)/);
    assert.match(main, /void listenForDeadlinePushInForeground\(\)/);
    assert.ok(main.indexOf('await recoverPushRegistration(user)') < main.indexOf('void listenForDeadlinePushInForeground()'));
});
