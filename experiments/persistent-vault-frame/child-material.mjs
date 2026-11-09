// The legacy child necessarily has a transient RAM copy. No persistence API.
export function createChildMaterial() {
  let generation = 0, material = null;
  return Object.freeze({
    clear() {generation++; material = null;},
    epoch: () => generation,
    isOpen: () => material !== null,
    async acquire(read) {
      const ticket = generation, candidate = await read();
      if (ticket !== generation || typeof candidate !== 'string' || !candidate) return false;
      material = candidate; return true;
    },
  });
}
