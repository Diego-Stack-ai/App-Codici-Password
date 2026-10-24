const FORMAT = 'codici-password-portable-archive';
const FORMAT_VERSION = 2;
const SCHEMA_VERSION = 1;
const KDF_ITERATIONS = 600000;
const DEFAULT_CHUNK_SIZE = 1024 * 1024;
const MIB = 1024 * 1024;
const PORTABLE_LIMITS = Object.freeze({
    maxFileBytes: 1536 * MIB,
    maxLineBytes: 17 * MIB,
    maxChunkBytes: 4 * MIB,
    maxChunkMetadataBytes: 64 * 1024,
    maxFooterBytes: 12 * MIB,
    maxFrames: 16386,
    maxLines: 16388,
    maxEntries: 10100,
    maxRecords: 10000,
    maxRetainedPlaintextBytes: 64 * MIB
});
const COMMON_PASSWORD_PARTS = Object.freeze([
    'password', 'passw0rd', 'qwerty', '123456', 'abcdef', 'letmein', 'welcome', 'benvenuto', 'amministratore'
]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function asBytes(value) {
    if (value instanceof Uint8Array) return value;
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    throw new Error('PORTABLE_BYTES_REQUIRED');
}

function bytesToBase64(value) {
    const bytes = asBytes(value);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
}

function base64ToBytes(value, maxBytes = Number.MAX_SAFE_INTEGER) {
    if (typeof value !== 'string' || value.length > Math.ceil(maxBytes / 3) * 4 + 4) throw new Error('PORTABLE_FRAME_LIMIT');
    let binary;
    try { binary = atob(value); } catch { throw new Error('PORTABLE_BASE64_INVALID'); }
    if (binary.length > maxBytes) throw new Error('PORTABLE_FRAME_LIMIT');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

async function sha256Base64(value, cryptoApi) {
    return bytesToBase64(new Uint8Array(await cryptoApi.subtle.digest('SHA-256', asBytes(value))));
}

function canonicalHeader(header) {
    return JSON.stringify({format: header.format, formatVersion: header.formatVersion, schemaVersion: header.schemaVersion,
        archiveId: header.archiveId, createdAt: header.createdAt, chunkSize: header.chunkSize, kdf: header.kdf, cipher: header.cipher});
}

function hasSubstantialRepeatedPattern(value) {
    const minimumSpan = Math.max(8, Math.ceil(value.length * 0.75));
    for (let size = 1; size <= Math.floor(value.length / 2); size += 1) {
        for (let start = 0; start + (2 * size) <= value.length; start += 1) {
            let matched = true;
            for (let offset = 0; offset < size; offset += 1) {
                if (value[start + offset] !== value[start + size + offset]) { matched = false; break; }
            }
            if (!matched) continue;
            let end = start + (2 * size);
            while (end < value.length && value[end] === value[start + ((end - start) % size)]) end += 1;
            if (end - start >= minimumSpan) return true;
        }
    }
    return false;
}

export function evaluatePortableArchivePassword(password) {
    if (typeof password !== 'string' || !password) {
        return {valid: false, code: 'PORTABLE_PASSWORD_REQUIRED', message: 'Inserisci una password dedicata per l’archivio.'};
    }
    if (password.length < 14) {
        return {valid: false, code: 'PORTABLE_PASSWORD_TOO_SHORT', message: 'Usa almeno 14 caratteri.'};
    }
    if (password.length > 256) {
        return {valid: false, code: 'PORTABLE_PASSWORD_TOO_LONG', message: 'Usa al massimo 256 caratteri.'};
    }
    const normalized = password.normalize('NFKC').toLocaleLowerCase('en-US');
    const compact = normalized.replace(/[^a-z0-9]/g, '');
    if (COMMON_PASSWORD_PARTS.some(part => compact.includes(part))) {
        return {valid: false, code: 'PORTABLE_PASSWORD_COMMON', message: 'Evita parole o sequenze comuni e scegli una password unica.'};
    }
    const characters = [...normalized];
    const frequencies = new Map();
    for (const character of characters) frequencies.set(character, (frequencies.get(character) || 0) + 1);
    const mostFrequent = Math.max(...frequencies.values());
    const repeatedPattern = hasSubstantialRepeatedPattern(normalized);
    if (repeatedPattern || mostFrequent / characters.length >= 0.6) {
        return {valid: false, code: 'PORTABLE_PASSWORD_REPETITIVE', message: 'Evita caratteri o schemi ripetuti.'};
    }
    const classes = [/[a-z]/u, /[A-Z]/u, /[0-9]/u, /[^A-Za-z0-9]/u].filter(pattern => pattern.test(password)).length;
    const distinct = new Set(characters).size;
    const passphrase = password.length >= 24 && distinct >= 10;
    if (classes < 3 && !passphrase) {
        return {
            valid: false,
            code: 'PORTABLE_PASSWORD_WEAK',
            message: 'Combina almeno tre tipi tra maiuscole, minuscole, numeri e simboli, oppure usa una frase di almeno 24 caratteri.'
        };
    }
    return {valid: true, code: null, message: 'Password robusta.'};
}

function validatePassword(password) {
    const result = evaluatePortableArchivePassword(password);
    if (!result.valid) throw Object.assign(new Error(result.code), {code: result.code});
}

function validateUnlockPassword(password) {
    if (typeof password !== 'string' || !password.length || password.length > 1024) throw new Error('PORTABLE_PASSWORD_INVALID');
}

function validateHeader(header) {
    if (header?.format !== FORMAT || header.formatVersion !== FORMAT_VERSION || header.schemaVersion !== SCHEMA_VERSION ||
        header.kdf?.name !== 'PBKDF2-SHA256' || header.kdf?.iterations !== KDF_ITERATIONS ||
        header.cipher !== 'AES-GCM-256-CHAINED-CHUNKS' || !Number.isInteger(header.chunkSize) ||
        header.chunkSize < 64 * 1024 || header.chunkSize > PORTABLE_LIMITS.maxChunkBytes ||
        typeof header.archiveId !== 'string' || !header.archiveId || header.archiveId.length > 128 ||
        typeof header.createdAt !== 'string' || header.createdAt.length > 64 ||
        typeof header.kdf.salt !== 'string' || header.kdf.salt.length !== 44) {
        throw new Error('PORTABLE_FORMAT_INVALID');
    }
    let salt;
    try { salt = base64ToBytes(header.kdf.salt, 32); } catch { throw new Error('PORTABLE_FORMAT_INVALID'); }
    if (salt.byteLength !== 32) throw new Error('PORTABLE_FORMAT_INVALID');
    salt.fill(0);
}

async function deriveKey(header, password, cryptoApi) {
    validateUnlockPassword(password); validateHeader(header);
    const passwordBytes = encoder.encode(password);
    const salt = base64ToBytes(header.kdf.salt, 32);
    try {
        const material = await cryptoApi.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveKey']);
        return await cryptoApi.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: KDF_ITERATIONS},
            material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
    } finally { passwordBytes.fill(0); salt.fill(0); }
}

function frameAad(header, type, sequence, previousDigest) {
    return encoder.encode(`${canonicalHeader(header)}\n${type}\n${sequence}\n${previousDigest}`);
}

function encodeChunkPayload(meta, bytes) {
    const metadata = encoder.encode(JSON.stringify(meta));
    if (metadata.byteLength > PORTABLE_LIMITS.maxChunkMetadataBytes || bytes.byteLength > PORTABLE_LIMITS.maxChunkBytes) {
        throw new Error('PORTABLE_CHUNK_LIMIT');
    }
    const output = new Uint8Array(4 + metadata.byteLength + bytes.byteLength);
    new DataView(output.buffer).setUint32(0, metadata.byteLength, false);
    output.set(metadata, 4); output.set(bytes, 4 + metadata.byteLength);
    return output;
}

function decodeChunkPayload(payload) {
    if (payload.byteLength < 4) throw new Error('PORTABLE_CHUNK_INVALID');
    const metadataSize = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getUint32(0, false);
    if (metadataSize < 2 || metadataSize > PORTABLE_LIMITS.maxChunkMetadataBytes || metadataSize > payload.byteLength - 4 ||
        payload.byteLength - 4 - metadataSize > PORTABLE_LIMITS.maxChunkBytes) throw new Error('PORTABLE_CHUNK_INVALID');
    let meta;
    try { meta = JSON.parse(decoder.decode(payload.subarray(4, 4 + metadataSize))); } catch { throw new Error('PORTABLE_CHUNK_INVALID'); }
    return {meta, bytes: payload.subarray(4 + metadataSize)};
}

function normalizeEntryMeta(meta) {
    if (!meta || typeof meta.id !== 'string' || !meta.id || typeof meta.kind !== 'string' || !meta.kind) throw new Error('PORTABLE_ENTRY_INVALID');
    return {id: meta.id, kind: meta.kind, name: String(meta.name || meta.id), type: String(meta.type || 'application/octet-stream'),
        recordKeys: Array.isArray(meta.recordKeys) ? meta.recordKeys.map(String).sort() : [],
        schemaVersion: Number.isInteger(meta.schemaVersion) ? meta.schemaVersion : 1};
}

async function *chunkSource(source, chunkSize) {
    if (source instanceof Uint8Array || source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
        const bytes = asBytes(source);
        for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) yield bytes.subarray(offset, offset + chunkSize);
        if (!bytes.byteLength) yield new Uint8Array();
        return;
    }
    if (!source?.[Symbol.asyncIterator] && !source?.[Symbol.iterator]) throw new Error('PORTABLE_SOURCE_INVALID');
    let carry = new Uint8Array();
    for await (const value of source) {
        const incoming = asBytes(value);
        if (!incoming.byteLength) continue;
        const combined = new Uint8Array(carry.byteLength + incoming.byteLength);
        combined.set(carry); combined.set(incoming, carry.byteLength);
        let offset = 0;
        while (combined.byteLength - offset > chunkSize) { yield combined.slice(offset, offset + chunkSize); offset += chunkSize; }
        carry = combined.slice(offset);
    }
    yield carry;
}

function serializedLine(value) {
    const bytes = encoder.encode(`${JSON.stringify(value)}\n`);
    if (bytes.byteLength > PORTABLE_LIMITS.maxLineBytes) throw new Error('PORTABLE_LINE_LIMIT');
    return bytes;
}

export function createPortableHeader({createdAt = new Date().toISOString(), chunkSize = DEFAULT_CHUNK_SIZE, cryptoApi = crypto} = {}) {
    const header = {format: FORMAT, formatVersion: FORMAT_VERSION, schemaVersion: SCHEMA_VERSION, archiveId: cryptoApi.randomUUID(),
        createdAt, chunkSize, kdf: {name: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS,
            salt: bytesToBase64(cryptoApi.getRandomValues(new Uint8Array(32)))}, cipher: 'AES-GCM-256-CHAINED-CHUNKS'};
    validateHeader(header); return header;
}

export async function createPortableArchiveWriter({sink, password, header = createPortableHeader(), cryptoApi = crypto, signal} = {}) {
    if (!sink?.write || !sink?.close || !sink?.abort) throw new Error('PORTABLE_SINK_INVALID');
    validatePassword(password);
    const key = await deriveKey(header, password, cryptoApi);
    const entries = [], seenIds = new Set();
    let sequence = 0, previousDigest = '', completed = false, failed = false, bytesWritten = 0;
    const check = () => {
        if (failed || completed) throw new Error('PORTABLE_WRITER_CLOSED');
        if (signal?.aborted) throw Object.assign(new Error('PORTABLE_EXPORT_CANCELLED'), {name: 'AbortError'});
    };
    const writeOutputLine = async value => {
        const bytes = serializedLine(value);
        if (bytes.byteLength > PORTABLE_LIMITS.maxFileBytes - bytesWritten) throw new Error('PORTABLE_FILE_LIMIT');
        await sink.write(bytes);
        bytesWritten += bytes.byteLength;
    };
    const writeEncryptedFrame = async (type, clearBytes) => {
        check();
        const clearLimit = type === 'chunk'
            ? 4 + PORTABLE_LIMITS.maxChunkMetadataBytes + PORTABLE_LIMITS.maxChunkBytes
            : PORTABLE_LIMITS.maxFooterBytes;
        if (sequence >= PORTABLE_LIMITS.maxFrames - 1 || clearBytes.byteLength > clearLimit) throw new Error('PORTABLE_FRAME_LIMIT');
        const iv = cryptoApi.getRandomValues(new Uint8Array(12));
        const ciphertext = new Uint8Array(await cryptoApi.subtle.encrypt({name: 'AES-GCM', iv,
            additionalData: frameAad(header, type, sequence, previousDigest)}, key, clearBytes));
        const envelope = {type, sequence, previousDigest, iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext)};
        const serialized = JSON.stringify(envelope);
        const digest = await sha256Base64(encoder.encode(serialized), cryptoApi);
        try {
            check();
            await writeOutputLine(envelope);
            previousDigest = digest; sequence += 1;
        } finally { ciphertext.fill(0); }
    };
    try { await writeOutputLine(header); } catch (error) { failed = true; try { await sink.abort(error); } catch {} throw error; }
    return {header,
        async addEntry(metaInput, source) {
            try { check(); }
            catch (error) { failed = true; try { await sink.abort(error); } catch {} throw error; }
            const entry = normalizeEntryMeta(metaInput);
            if (entries.length >= PORTABLE_LIMITS.maxEntries) {
                const error = new Error('PORTABLE_ENTRY_LIMIT'); failed = true;
                try { await sink.abort(error); } catch {}
                throw error;
            }
            if (seenIds.has(entry.id)) {
                const error = new Error('PORTABLE_ENTRY_DUPLICATE'); failed = true;
                try { await sink.abort(error); } catch {}
                throw error;
            }
            seenIds.add(entry.id);
            const chunkDigests = [];
            let size = 0, chunkIndex = 0, pending;
            try {
                for await (const chunk of chunkSource(source, header.chunkSize)) {
                    if (pending !== undefined) {
                        const digest = await sha256Base64(pending, cryptoApi); chunkDigests.push(digest);
                        const payload = encodeChunkPayload({...entry, chunkIndex, final: false, plainSize: pending.byteLength, sha256: digest}, pending);
                        await writeEncryptedFrame('chunk', payload); payload.fill(0); size += pending.byteLength; chunkIndex += 1;
                    }
                    pending = chunk;
                }
                const finalChunk = pending || new Uint8Array();
                const digest = await sha256Base64(finalChunk, cryptoApi); chunkDigests.push(digest);
                const payload = encodeChunkPayload({...entry, chunkIndex, final: true, plainSize: finalChunk.byteLength, sha256: digest}, finalChunk);
                await writeEncryptedFrame('chunk', payload); payload.fill(0); size += finalChunk.byteLength;
                const contentDigest = await sha256Base64(encoder.encode(chunkDigests.join('\n')), cryptoApi);
                entries.push({...entry, size, chunkCount: chunkDigests.length, chunkDigests, contentDigest});
                return entries.at(-1);
            } catch (error) { failed = true; try { await sink.abort(error); } catch {} throw error; }
        },
        async close(extraManifest = {}) {
            try { check(); }
            catch (error) { failed = true; try { await sink.abort(error); } catch {} throw error; }
            const manifest = {...extraManifest, format: 'codici-password-portable-manifest', version: 2, archiveId: header.archiveId,
                createdAt: header.createdAt, schemaVersion: header.schemaVersion, entryCount: entries.length, entries};
            const manifestBytes = encoder.encode(JSON.stringify(manifest));
            try {
                if (manifestBytes.byteLength > PORTABLE_LIMITS.maxFooterBytes) throw new Error('PORTABLE_MANIFEST_LIMIT');
                await writeEncryptedFrame('footer', manifestBytes);
                await writeOutputLine({type: 'end', sequence, finalDigest: previousDigest});
                await sink.close(); completed = true; return manifest;
            } catch (error) { failed = true; try { await sink.abort(error); } catch {} throw error; }
            finally { manifestBytes.fill(0); }
        },
        async abort(reason = new Error('PORTABLE_EXPORT_CANCELLED')) {
            if (completed || failed) return; failed = true; try { await sink.abort(reason); } catch {}
        }};
}

async function decryptEnvelope({header, key, envelope, expectedType, expectedSequence, previousDigest, cryptoApi}) {
    if (envelope?.type !== expectedType || envelope.sequence !== expectedSequence || envelope.previousDigest !== previousDigest) throw new Error('PORTABLE_CHAIN_INVALID');
    const clearLimit = expectedType === 'chunk'
        ? 4 + PORTABLE_LIMITS.maxChunkMetadataBytes + PORTABLE_LIMITS.maxChunkBytes
        : PORTABLE_LIMITS.maxFooterBytes;
    const iv = base64ToBytes(envelope.iv, 12);
    const ciphertext = base64ToBytes(envelope.ciphertext, clearLimit + 16);
    if (iv.byteLength !== 12 || ciphertext.byteLength < 16) {
        iv.fill(0); ciphertext.fill(0); throw new Error('PORTABLE_FRAME_INVALID');
    }
    const serialized = JSON.stringify(envelope);
    try {
        const clear = new Uint8Array(await cryptoApi.subtle.decrypt({name: 'AES-GCM', iv,
            additionalData: frameAad(header, expectedType, expectedSequence, previousDigest)}, key, ciphertext));
        if (clear.byteLength > clearLimit) { clear.fill(0); throw new Error('PORTABLE_FRAME_LIMIT'); }
        return {clear, digest: await sha256Base64(encoder.encode(serialized), cryptoApi)};
    } finally { iv.fill(0); ciphertext.fill(0); }
}

function boundedLine(value, maxLineBytes = PORTABLE_LIMITS.maxLineBytes) {
    const line = String(value);
    if (line.length > maxLineBytes || encoder.encode(line).byteLength > maxLineBytes) {
        throw new Error('PORTABLE_LINE_LIMIT');
    }
    return line;
}

function countPortableRecords(bytes) {
    let payload;
    try { payload = JSON.parse(decoder.decode(bytes)); } catch { throw new Error('PORTABLE_RECORDS_INVALID'); }
    if (!payload || !Array.isArray(payload.records) || payload.records.length > PORTABLE_LIMITS.maxRecords) {
        throw new Error('PORTABLE_RECORD_LIMIT');
    }
    return payload.records.length;
}

function restrictedReaderLimits(overrides = {}) {
    const limits = {};
    for (const key of ['maxFileBytes', 'maxLineBytes', 'maxFrames', 'maxLines', 'maxEntries', 'maxRecords', 'maxRetainedPlaintextBytes']) {
        const value = overrides[key] ?? PORTABLE_LIMITS[key];
        if (!Number.isSafeInteger(value) || value < 1) throw new Error('PORTABLE_LIMIT_INVALID');
        limits[key] = Math.min(value, PORTABLE_LIMITS[key]);
    }
    return limits;
}

export async function verifyPortableArchiveLines(lines, password, {cryptoApi = crypto,
    retainKinds = ['records', 'json', 'csv', 'ods'], onProgress = () => {}, limits = {}} = {}) {
    if (!Array.isArray(retainKinds)) throw new Error('PORTABLE_RETAIN_KINDS_INVALID');
    const retainedKinds = new Set(retainKinds);
    const activeLimits = restrictedReaderLimits(limits);
    const iterator = lines[Symbol.asyncIterator] ? lines[Symbol.asyncIterator]() : lines[Symbol.iterator]();
    let consumedBytes = 0, consumedLines = 0;
    const nextBoundedLine = async () => {
        const next = await iterator.next();
        if (next.done) return next;
        consumedLines += 1;
        if (consumedLines > activeLimits.maxLines) throw new Error('PORTABLE_LINE_LIMIT');
        const line = boundedLine(next.value, activeLimits.maxLineBytes);
        const lineBytes = encoder.encode(line).byteLength + 1;
        if (lineBytes > activeLimits.maxFileBytes - consumedBytes) throw new Error('PORTABLE_FILE_LIMIT');
        consumedBytes += lineBytes;
        return {done: false, value: line};
    };
    const first = await nextBoundedLine();
    if (first.done) throw new Error('PORTABLE_HEADER_MISSING');
    let header;
    try { header = JSON.parse(first.value); } catch (error) {
        if (error?.message === 'PORTABLE_LINE_LIMIT') throw error;
        throw new Error('PORTABLE_HEADER_INVALID');
    }
    validateHeader(header);
    const key = await deriveKey(header, password, cryptoApi), retained = new Map(), observed = [];
    const observedIds = new Set();
    let current = null, sequence = 0, previousDigest = '', manifest = null, ended = false;
    let frameCount = 0, retainedBytes = 0, succeeded = false;
    const clearRetained = () => {
        for (const bytes of retained.values()) bytes.fill(0);
        retained.clear();
        for (const bytes of current?.retained || []) bytes.fill(0);
    };
    try {
        for (;;) {
            const next = await nextBoundedLine(); if (next.done) break;
            let envelope;
            try { envelope = JSON.parse(next.value); } catch (error) {
                if (error?.message === 'PORTABLE_LINE_LIMIT') throw error;
                throw new Error('PORTABLE_LINE_INVALID');
            }
            frameCount += 1;
            if (frameCount > activeLimits.maxFrames) throw new Error('PORTABLE_FRAME_LIMIT');
            if (envelope.type === 'chunk') {
                if (manifest) throw new Error('PORTABLE_FOOTER_ORDER_INVALID');
                const opened = await decryptEnvelope({header, key, envelope, expectedType: 'chunk', expectedSequence: sequence, previousDigest, cryptoApi});
                try {
                    previousDigest = opened.digest; sequence += 1;
                    const {meta, bytes} = decodeChunkPayload(opened.clear), normalized = normalizeEntryMeta(meta);
                    if (!Number.isInteger(meta.chunkIndex) || meta.chunkIndex < 0 || typeof meta.final !== 'boolean' ||
                        meta.plainSize !== bytes.byteLength || bytes.byteLength > header.chunkSize ||
                        await sha256Base64(bytes, cryptoApi) !== meta.sha256) throw new Error('PORTABLE_CHUNK_INVALID');
                    if (!current) {
                        if (observedIds.has(normalized.id)) throw new Error('PORTABLE_ENTRY_DUPLICATE');
                        current = {...normalized, size: 0, chunkDigests: [], retained: []};
                    }
                    if (current.id !== normalized.id || current.kind !== normalized.kind || meta.chunkIndex !== current.chunkDigests.length ||
                        JSON.stringify(current.recordKeys) !== JSON.stringify(normalized.recordKeys)) throw new Error('PORTABLE_ENTRY_ORDER_INVALID');
                    current.size += bytes.byteLength; current.chunkDigests.push(meta.sha256);
                    if (retainedKinds.has(current.kind) || current.kind === 'records') {
                        if (bytes.byteLength > activeLimits.maxRetainedPlaintextBytes - retainedBytes) {
                            throw new Error('PORTABLE_RETAINED_LIMIT');
                        }
                        current.retained.push(bytes.slice()); retainedBytes += bytes.byteLength;
                    }
                    onProgress({kind: current.kind, entryId: current.id, bytes: bytes.byteLength, sequence});
                    if (meta.final) {
                        if (observed.length >= activeLimits.maxEntries) throw new Error('PORTABLE_ENTRY_LIMIT');
                        const descriptor = {id: current.id, kind: current.kind, name: current.name, type: current.type,
                            recordKeys: current.recordKeys, schemaVersion: current.schemaVersion, size: current.size,
                            chunkCount: current.chunkDigests.length, chunkDigests: current.chunkDigests,
                            contentDigest: await sha256Base64(encoder.encode(current.chunkDigests.join('\n')), cryptoApi)};
                        observed.push(descriptor); observedIds.add(current.id);
                        if (current.retained.length) {
                            const total = current.retained.reduce((sum, part) => sum + part.byteLength, 0), joined = new Uint8Array(total);
                            let offset = 0;
                            for (const part of current.retained) { joined.set(part, offset); part.fill(0); offset += part.byteLength; }
                            retained.set(current.id, joined);
                        }
                        current = null;
                    }
                } finally { opened.clear.fill(0); }
            } else if (envelope.type === 'footer') {
                if (current || manifest) throw new Error('PORTABLE_FOOTER_ORDER_INVALID');
                const opened = await decryptEnvelope({header, key, envelope, expectedType: 'footer', expectedSequence: sequence, previousDigest, cryptoApi});
                try {
                    previousDigest = opened.digest; sequence += 1;
                    try { manifest = JSON.parse(decoder.decode(opened.clear)); } catch { throw new Error('PORTABLE_MANIFEST_INVALID'); }
                } finally { opened.clear.fill(0); }
                if (manifest?.format !== 'codici-password-portable-manifest' || manifest.version !== 2 || manifest.archiveId !== header.archiveId ||
                    !Number.isSafeInteger(manifest.entryCount) || manifest.entryCount < 0 || manifest.entryCount > activeLimits.maxEntries ||
                    manifest.entryCount !== observed.length || !Array.isArray(manifest.entries) || manifest.entries.length !== observed.length ||
                    manifest.entries.some((entry, index) => JSON.stringify(entry) !== JSON.stringify(observed[index]))) {
                    throw new Error('PORTABLE_MANIFEST_INVALID');
                }
            } else if (envelope.type === 'end') {
                if (!manifest || envelope.sequence !== sequence || envelope.finalDigest !== previousDigest) throw new Error('PORTABLE_END_INVALID');
                ended = true;
                for (;;) {
                    const trailing = await nextBoundedLine();
                    if (trailing.done) break;
                    if (trailing.value.trim()) throw new Error('PORTABLE_TRAILING_DATA');
                }
                break;
            } else throw new Error('PORTABLE_FRAME_INVALID');
        }
        if (!ended || !manifest) throw new Error('PORTABLE_INCOMPLETE');
        let recordCount = 0;
        for (const descriptor of observed) {
            if (descriptor.kind !== 'records') continue;
            const bytes = retained.get(descriptor.id);
            if (!bytes) throw new Error('PORTABLE_RECORDS_INVALID');
            recordCount += countPortableRecords(bytes);
            if (recordCount > activeLimits.maxRecords) throw new Error('PORTABLE_RECORD_LIMIT');
            if (!retainedKinds.has('records')) { retained.delete(descriptor.id); bytes.fill(0); }
        }
        succeeded = true;
        return {header, manifest, retained};
    } finally {
        if (!succeeded) clearRetained();
        try { await iterator.return?.(); } catch {}
    }
}

export async function *linesFromByteChunks(chunks, limits = {}) {
    const maxFileBytes = Math.min(limits.maxFileBytes ?? PORTABLE_LIMITS.maxFileBytes, PORTABLE_LIMITS.maxFileBytes);
    const maxLineBytes = Math.min(limits.maxLineBytes ?? PORTABLE_LIMITS.maxLineBytes, PORTABLE_LIMITS.maxLineBytes);
    if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes < 1 || !Number.isSafeInteger(maxLineBytes) || maxLineBytes < 1) {
        throw new Error('PORTABLE_LIMIT_INVALID');
    }
    let pending = '', fileBytes = 0;
    for await (const chunk of chunks) {
        const bytes = asBytes(chunk);
        if (bytes.byteLength > maxFileBytes - fileBytes) throw new Error('PORTABLE_FILE_LIMIT');
        fileBytes += bytes.byteLength;
        for (let offset = 0; offset < bytes.byteLength; offset += 64 * 1024) {
            pending += decoder.decode(bytes.subarray(offset, offset + 64 * 1024), {stream: true});
            let newline;
            while ((newline = pending.indexOf('\n')) >= 0) {
                const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
                if (encoder.encode(line).byteLength > maxLineBytes) throw new Error('PORTABLE_LINE_LIMIT');
                if (line) yield line;
            }
            if (encoder.encode(pending).byteLength > maxLineBytes) throw new Error('PORTABLE_LINE_LIMIT');
        }
    }
    pending += decoder.decode();
    if (encoder.encode(pending).byteLength > maxLineBytes) throw new Error('PORTABLE_LINE_LIMIT');
    if (pending.trim()) yield pending;
}

export function byteChunksFromBlob(blob) {
    if (!blob?.stream) throw new Error('PORTABLE_FILE_STREAM_REQUIRED');
    if (!Number.isSafeInteger(blob.size) || blob.size < 0 || blob.size > PORTABLE_LIMITS.maxFileBytes) throw new Error('PORTABLE_FILE_LIMIT');
    return blob.stream();
}

export function createBoundedPortableSink({limitBytes, onComplete = async () => {}} = {}) {
    if (!Number.isSafeInteger(limitBytes) || limitBytes < 64 * 1024) throw new Error('PORTABLE_FALLBACK_LIMIT_INVALID');
    const parts = [];
    let size = 0, closed = false;
    return {
        async write(value) {
            if (closed) throw new Error('PORTABLE_SINK_CLOSED');
            const bytes = asBytes(value);
            if (size + bytes.byteLength > limitBytes) {
                throw Object.assign(new Error('PORTABLE_STREAMING_REQUIRED'), {code: 'PORTABLE_STREAMING_REQUIRED'});
            }
            parts.push(bytes.slice()); size += bytes.byteLength;
        },
        async close() {
            if (closed) return;
            closed = true;
            await onComplete(parts, size);
            parts.length = 0; size = 0;
        },
        async abort() { closed = true; parts.length = 0; size = 0; },
        get size() { return size; }
    };
}

export const PORTABLE_STREAM_FORMAT = Object.freeze({format: FORMAT, formatVersion: FORMAT_VERSION,
    schemaVersion: SCHEMA_VERSION, iterations: KDF_ITERATIONS, defaultChunkSize: DEFAULT_CHUNK_SIZE});
export const PORTABLE_ARCHIVE_LIMITS = PORTABLE_LIMITS;
