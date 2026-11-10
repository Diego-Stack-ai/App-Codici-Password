import {createRequire} from 'node:module';
import {FRAME_ROUTES} from '../../Frontend/public/assets/js/modules/core/vault-frame-policy.mjs';
const require = createRequire(import.meta.url);
const mm = require('minimatch');
const matchesGlob = typeof mm === 'function' ? mm : mm.minimatch;
export const FRAME_CHILD_PATHS = Object.freeze(Object.keys(FRAME_ROUTES).map(name => `/${name}.html`).sort());
export const FRAME_SHELL_PATH = '/app.html';
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// The extra separator represents superstatic's Windows-internal normalization.
// It does not broaden an HTTP filename, nested path, suffix or trailing slash.
const literal = char => char === '/' ? '[\\\\/]' : escape(char);
export function exactPathRegex(paths) {
  return `^(?:${paths.map(path => Array.from(path, literal).join('')).join('|')})$`;
}
export function exceptExactPathRegex(paths) {
  const root = {children: new Map(), terminal: false};
  for (const path of paths) {let node = root; for (const char of path) {if (!node.children.has(char)) node.children.set(char, {children: new Map(), terminal: false}); node = node.children.get(char);} node.terminal = true;}
  const compile = node => {
    const branches = node.terminal ? [] : [''];
    const keys = [...node.children.keys()];
    if (!keys.length) branches.push('[\\s\\S]+');
    else {
      const excluded = keys.map(char => char === '/' ? '\\\\/' : char.replace(/[\\\]\^-]/g, '\\$&')).join('');
      branches.push(`[^${excluded}][\\s\\S]*`);
      for (const [char, child] of node.children) branches.push(literal(char) + compile(child));
    }
    return `(?:${branches.join('|')})`;
  };
  return '^' + compile(root) + '$';
}
export function headerMatches(rule, pathname) {
  return rule.regex ? new RegExp(rule.regex, 'u').test(pathname) : matchesGlob(pathname, rule.source);
}
// Production Hosting matches existing files after decoding ASCII unreserved
// characters. Keep the review's conservative exceptions (including encoded
// dots) literal. This is an HTTP-header model, never the Vault route allowlist.
// Do not URL-parse here: that would normalize dot segments before these fences.
export function normalizeHostingPathname(pathname, publicPaths = []) {
  if (typeof pathname !== 'string' || /%(?:2f|5c|2e)/i.test(pathname)) return pathname;
  const candidate = pathname.replace(/%([0-9a-f]{2})/gi, (encoded, hex) => {
    const char = String.fromCharCode(parseInt(hex, 16));
    return /^[A-Za-z0-9_~-]$/.test(char) ? char : encoded;
  });
  // Residual escapes include malformed, reserved, non-ASCII and double encoding.
  if (candidate.includes('%')) return pathname;
  const files = publicPaths instanceof Set ? publicPaths : new Set(publicPaths);
  return files.has(candidate) ? candidate : pathname;
}
export function effectiveHostingHeaders(hosting, pathname, {strictSecurity = true, publicPaths = []} = {}) {
  const matchedPathname = normalizeHostingPathname(pathname, publicPaths);
  const headers = new Map(), seen = new Map();
  for (const rule of hosting.headers || []) if (headerMatches(rule, matchedPathname)) for (const header of rule.headers || []) {
    const key = header.key.toLowerCase(); seen.set(key, (seen.get(key) || 0) + 1); headers.set(key, header.value);
  }
  if (strictSecurity) for (const key of ['content-security-policy', 'x-frame-options', 'permissions-policy']) {
    if ((seen.get(key) || 0) !== 1) throw Error(`Ambiguous Hosting security header ${key}: ${pathname}`);
  }
  return Object.fromEntries(headers);
}
export function frameHeaderProfile(pathname) {
  return pathname === FRAME_SHELL_PATH ? 'shell' : FRAME_CHILD_PATHS.includes(pathname) ? 'child' : 'default';
}
export function buildFrameHostingHeaders(hosting) {
  const original = effectiveHostingHeaders(hosting, '/', {strictSecurity: false});
  const baseline = original['content-security-policy'], permission = original['permissions-policy'];
  if (!baseline || !permission) throw Error('Missing baseline Hosting security headers');
  const security = new Set(['content-security-policy','x-frame-options','permissions-policy','x-content-type-options','referrer-policy']);
  const common = hosting.headers.map(rule => ({...rule, headers: rule.headers.filter(header => !security.has(header.key.toLowerCase()))}))
    .filter(rule => rule.headers.length);
  const additional = ', publickey-credentials-get=(self), publickey-credentials-create=(self)';
  const profile = (regex, xfo, csp, permissions) => ({regex, headers: [
    {key: 'X-Frame-Options', value: xfo}, {key: 'Content-Security-Policy', value: csp}, {key: 'Permissions-Policy', value: permissions},
    ...['X-Content-Type-Options','Referrer-Policy'].filter(key => original[key.toLowerCase()]).map(key => ({key, value: original[key.toLowerCase()]}))]});
  const paths = [FRAME_SHELL_PATH, ...FRAME_CHILD_PATHS];
  return [...common,
    profile(exceptExactPathRegex(paths), 'DENY', baseline, permission),
    profile(exactPathRegex([FRAME_SHELL_PATH]), 'DENY', baseline.replace('frame-src ', "frame-src 'self' "), permission + additional),
    profile(exactPathRegex(FRAME_CHILD_PATHS), 'SAMEORIGIN', baseline.replace("frame-ancestors 'none'", "frame-ancestors 'self'"), permission + additional)];
}
