import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../tools/native-ai2/Program.cs', import.meta.url), 'utf8');

test('il motore nativo ascolta soltanto su loopback con porte separate', () => {
    assert.match(source, /UseUrls\(\$"http:\/\/127\.0\.0\.1:\{PublicPort\}"\)/);
    assert.match(source, /127\.0\.0\.1 --port \{EnginePort\}/);
    assert.doesNotMatch(source, /--host 0\.0\.0\.0/);
});

test('lo stato locale distingue host, installazione del modello e runtime pronto', () => {
    assert.match(source, /MapGet\("\/v1\/status"/);
    assert.match(source, /installed = engine\.IsInstalled/);
    assert.match(source, /ready = await engine\.IsReady/);
    assert.match(source, /TotalAvailableMemoryBytes/);
    assert.match(source, /AvailableFreeSpace/);
    assert.match(source, /MapGet\("\/v1\/health"[\s\S]*EnsureReady/);
    assert.match(source, /Task\.Delay\(Timeout\.InfiniteTimeSpan, stoppingToken\)/);
    assert.match(source, /SemaphoreSlim _startLock/);
});

test('CORS è ristretto alle origini dell’app e il proxy richiede associazione', () => {
    assert.match(source, /https:\/\/appcodici-password\.web\.app/);
    assert.match(source, /allowedOrigins\.Contains\(origin\)/);
    assert.match(source, /pairing\.Authorize\(context\.Request\.Headers\.Authorization/);
    assert.match(source, /MapGet\("\/v1\/health"[\s\S]*LOCAL_AI_NATIVE_PAIRING_REQUIRED/);
    assert.match(source, /CryptographicOperations\.FixedTimeEquals/);
    assert.match(source, /ProtectKeysWithDpapi\(\)/);
});

test('llama-server non espone interfaccia o rete e usa una chiave interna casuale', () => {
    assert.match(source, /--no-webui/);
    assert.match(source, /--api-key \{EngineApiKey\}/);
    assert.match(source, /RandomNumberGenerator\.GetBytes\(32\)/);
    assert.match(source, /--n-gpu-layers 0/);
    assert.match(source, /--reasoning off/);
    assert.match(source, /--reasoning-budget 0/);
    assert.match(source, /qwen3-4b-q4_k_m\.gguf/);
    assert.doesNotMatch(source, /qwen2\.5-3b-instruct-q4_k_m\.gguf/);
});

test('richieste e conversazione sono limitate prima dell’inoltro', () => {
    assert.match(source, /MaximumRequestBytes = 128 \* 1024/);
    assert.match(source, /messages\.GetArrayLength\(\) is < 1 or > 14/);
    assert.match(source, /total > 12_000/);
});
