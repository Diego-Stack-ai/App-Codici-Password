import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-list-sort.js', import.meta.url), 'utf8');
const {
    ACCOUNT_SORT_MODES, accountSortMode, compareAccounts, nextAccountSortMode
} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

const rows = [
    {id: 'b', nomeAccount: 'Beta', updatedAt: {seconds: 20, nanoseconds: 0}},
    {id: 'a', nomeAccount: 'Alfa', updatedAt: {seconds: 10, nanoseconds: 0}},
    {id: 'c', nomeAccount: 'Gamma', updatedAt: {seconds: 30, nanoseconds: 0}}
];

test('ordinamento Account percorre nome e data con etichette accessibili', () => {
    assert.deepEqual(ACCOUNT_SORT_MODES.map(mode => mode.id), ['name-asc', 'name-desc', 'date-desc', 'date-asc']);
    let mode = accountSortMode('name-asc');
    for (const expected of ['name-desc', 'date-desc', 'date-asc', 'name-asc']) {
        mode = nextAccountSortMode(mode.id);
        assert.equal(mode.id, expected);
        assert.ok(mode.label);
        assert.match(mode.title, /Ordina/);
    }
});

test('ordina per nome oppure data di modifica e mantiene i fissati in testa', () => {
    const order = mode => [...rows].sort((a, b) => compareAccounts(a, b, mode)).map(row => row.id);
    assert.deepEqual(order('name-asc'), ['a', 'b', 'c']);
    assert.deepEqual(order('name-desc'), ['c', 'b', 'a']);
    assert.deepEqual(order('date-desc'), ['c', 'b', 'a']);
    assert.deepEqual(order('date-asc'), ['a', 'b', 'c']);
    const pinned = rows.map(row => row.id === 'b' ? {...row, isPinned: true} : row);
    assert.equal(pinned.sort((a, b) => compareAccounts(a, b, 'date-desc'))[0].id, 'b');
});

test('data assente usa un ordinamento stabile per nome', () => {
    const undated = [{id: '2', nomeAccount: 'Zulu'}, {id: '1', nomeAccount: 'Alfa'}];
    assert.deepEqual(undated.sort((a, b) => compareAccounts(a, b, 'date-desc')).map(row => row.id), ['1', '2']);
});
