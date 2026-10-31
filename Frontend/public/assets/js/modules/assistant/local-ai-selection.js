const LEGACY_KEY = 'codex.local-ai.selected.v1';
const SELECTED_KEY = 'codex.local-ai.selected.v2';
const ADVANCED_TIER_KEY = 'codex.local-ai.advanced-tier.v1';
const DESKTOP32_RAM_CONFIRMATION_KEY = 'codex.local-ai.desktop32-ram-confirmed.v1';

export function readSelectedLocalAi(storage = globalThis.localStorage) {
    const selected = storage?.getItem?.(SELECTED_KEY);
    if (selected === 'A1' || selected === 'A2') return selected;
    const legacy = storage?.getItem?.(LEGACY_KEY);
    // La vecchia AI.2 diventa AI.1. La vecchia AI.3 non viene mai
    // riattivata automaticamente: il pacchetto resta conservato ma si
    // riparte dal livello locale prudente.
    const migrated = legacy === 'A2' ? 'A1' : 'A1';
    storage?.setItem?.(SELECTED_KEY, migrated);
    return migrated;
}

export function writeSelectedLocalAi(level, storage = globalThis.localStorage) {
    if (level !== 'A1' && level !== 'A2') throw new TypeError('LOCAL_AI_SELECTED_LEVEL');
    storage?.setItem?.(SELECTED_KEY, level);
}

export function readSelectedAdvancedTier(storage = globalThis.localStorage) {
    const tier = storage?.getItem?.(ADVANCED_TIER_KEY);
    if (tier !== 'desktop32') storage?.setItem?.(ADVANCED_TIER_KEY, 'desktop32');
    return 'desktop32';
}

export function writeSelectedAdvancedTier(tier, storage = globalThis.localStorage) {
    if (tier !== 'desktop32') throw new TypeError('LOCAL_AI_ADVANCED_TIER');
    storage?.setItem?.(ADVANCED_TIER_KEY, tier);
}

export function readDesktop32RamConfirmation(storage = globalThis.localStorage) {
    return storage?.getItem?.(DESKTOP32_RAM_CONFIRMATION_KEY) === 'true';
}

export function writeDesktop32RamConfirmation(confirmed, storage = globalThis.localStorage) {
    if (typeof confirmed !== 'boolean') throw new TypeError('LOCAL_AI_DESKTOP32_RAM_CONFIRMATION');
    storage?.setItem?.(DESKTOP32_RAM_CONFIRMATION_KEY, String(confirmed));
}

export { SELECTED_KEY as LOCAL_AI_SELECTED_KEY, ADVANCED_TIER_KEY as LOCAL_AI_ADVANCED_TIER_KEY,
    DESKTOP32_RAM_CONFIRMATION_KEY as LOCAL_AI_DESKTOP32_RAM_CONFIRMATION_KEY };
