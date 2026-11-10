const bankingIntents = new WeakMap();
export function markBankingRemoval(banks, intent) {
  const list = bankingIntents.get(banks) || [];
  list.push(Object.freeze({...intent})); bankingIntents.set(banks, list);
}
// Only stable identifiers/counts; never include account values in a grant target.
export function bankingRemovalPlan(before = [], after = []) {
  const removed = [];
  before = Array.isArray(before) ? before : [];
  after = Array.isArray(after) ? after : [];
  before.forEach((bank, index) => {
    const replacement = bank.bankId ? after.find(item => item.bankId === bank.bankId) : after[index];
    const id = bank.bankId || `legacy-bank-${index}`;
    if (!replacement) removed.push({bankId: id});
    else if ((bank.cards?.length || 0) > (replacement.cards?.length || 0))
      removed.push({bankId: id, cardsRemoved: bank.cards.length - (replacement.cards?.length || 0)});
  });
  return [...removed, ...(bankingIntents.get(after) || [])];
}
