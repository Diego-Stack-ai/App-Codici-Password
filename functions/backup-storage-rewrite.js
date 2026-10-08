// Pure candidate primitive. Callers must authenticate and verify every mapping
// against server-owned staging descriptors before publishing any reference.
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor']);
const LIMITS = Object.freeze({depth: 24, nodes: 200000, keys: 200, array: 10000, string: 1048576});
const fail = () => { throw new Error('BACKUP_STORAGE_REWRITE_INVALID'); };

function entries(value, array = false) {
  if (!value || (array ? Object.getPrototypeOf(value) !== Array.prototype :
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.some(key => typeof key !== 'string')) fail();
  return keys.map(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
      (!descriptor.enumerable && !(array && key === 'length')) || FORBIDDEN.has(key)) fail();
    return [key, descriptor.value];
  });
}

function ownerPath(uid, path) {
  if (typeof path !== 'string' || path.length > 1024 || !path.startsWith(`users/${uid}/`) ||
      path.includes('\\') || /[\u0000-\u001f\u007f%]/.test(path) ||
      path.split('/').some(part => !part || part === '.' || part === '..')) fail();
  return path;
}

function rewriteStorageData(uid, data, mapping) {
  if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid)) fail();
  const tableEntries = entries(mapping);
  if (tableEntries.length > 10000) fail();
  const table = new Map(tableEntries.map(([from, to]) => [ownerPath(uid, from), ownerPath(uid, to)]));
  const used = new Set();
  let nodes = 0;
  function visit(value, depth) {
    if (++nodes > LIMITS.nodes || depth > LIMITS.depth) fail();
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return value; }
    if (typeof value === 'string') { if (value.length > LIMITS.string) fail(); return value; }
    if (typeof value !== 'object') fail();
    if (Array.isArray(value)) {
      const pairs = entries(value, true), slots = new Map(pairs), length = slots.get('length');
      if (!Number.isSafeInteger(length) || length > LIMITS.array || pairs.length !== length + 1) fail();
      const result = [];
      for (let i = 0; i < length; i++) {
        if (!slots.has(String(i))) fail();
        result.push(visit(slots.get(String(i)), depth + 1));
      }
      return result;
    }
    const pairs = entries(value);
    if (pairs.length > LIMITS.keys) fail();
    const slots = new Map(pairs), type = slots.get('$type');
    if (slots.has('$type')) {
      const keys = pairs.map(([key]) => key).sort().join(',');
      if (type === 'timestamp') {
        const seconds = slots.get('seconds'), nanos = slots.get('nanoseconds');
        if (keys !== '$type,nanoseconds,seconds' || !Number.isSafeInteger(seconds) ||
          seconds < -62135596800 || seconds > 253402300799 || !Number.isInteger(nanos) || nanos < 0 || nanos > 999999999) fail();
      } else if (type === 'date') {
        const date = slots.get('value');
        if (keys !== '$type,value' || typeof date !== 'string' || !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString() !== date) fail();
      } else if (type === 'bytes') {
        if (keys !== '$type,value' || !Array.isArray(slots.get('value'))) fail();
        const bytes = visit(slots.get('value'), depth + 1);
        if (bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) fail();
        return {$type: 'bytes', value: bytes};
      } else fail();
    }
    return Object.fromEntries(pairs.map(([key, child]) => {
      if (key !== 'storagePath') return [key, visit(child, depth + 1)];
      ownerPath(uid, child);
      if (!table.has(child)) fail();
      used.add(child);
      return [key, table.get(child)];
    }));
  }
  const result = visit(data, 0);
  if (used.size !== table.size) fail();
  return result;
}

module.exports = {rewriteStorageData, LIMITS};
