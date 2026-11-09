// Public demonstrations remain deployable but are not part of the app shell.
export const OFFLINE_EXCLUDED_PREFIXES = Object.freeze(['ui-preview/']);

export function isOfflineExcluded(relativePath) {
  return OFFLINE_EXCLUDED_PREFIXES.some(prefix => relativePath.startsWith(prefix));
}
