"use strict";

// Serialized in-memory transactions for unit tests, not a Firestore emulator.
module.exports = function fixture(initial = {}) {
  const records = new Map(Object.entries(initial));
  let tail = Promise.resolve();
  const ref = path => ({path, id: path.split("/").pop(),
    async get() {return {exists: records.has(path), data: () => records.get(path)};},
    async set(data) {records.set(path, {...data});},
    async delete() {records.delete(path);}});
  const db = {collection: name => ({doc: id => ref(`${name}/${id}`),
    where: (field, operator, value) => ({limit: cap => ({async get() {
      if (operator !== "<=") throw new Error("fixture operator");
      return {docs: Array.from(records).filter(([path, data]) => path.startsWith(name + "/") && data[field] <= value)
        .slice(0, cap).map(([path]) => ({ref: ref(path)}))};
    }})})}),
    runTransaction(fn) {
      const next = tail.then(() => fn({get: item => item.get(), set: (item, data) => item.set(data), delete: item => item.delete()}));
      tail = next.catch(() => {});
      return next;
    }};
  return {db, records};
};
