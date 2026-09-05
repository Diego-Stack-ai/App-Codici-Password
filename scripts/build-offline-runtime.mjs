import { build } from 'esbuild';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'Frontend', 'public');
const jsDir = path.join(publicDir, 'assets', 'js');
const vendorDir = path.join(jsDir, 'vendor');
const packageByModule = {
  'firebase-app': 'firebase/app',
  'firebase-app-check': 'firebase/app-check',
  'firebase-auth': 'firebase/auth',
  'firebase-firestore': 'firebase/firestore',
  'firebase-functions': 'firebase/functions',
  'firebase-messaging': 'firebase/messaging',
  'firebase-storage': 'firebase/storage'
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return entry.isFile() ? [fullPath] : [];
  }));
  return nested.flat();
}

const sourceFiles = (await walk(jsDir))
  .filter(file => file.endsWith('.js'))
  .filter(file => !file.startsWith(vendorDir));
const requestedExports = new Map();
const requestedNames = new Set();

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  const importPattern = /import\s*\{([^}]+)\}\s*from\s*["']\/assets\/js\/vendor\/firebase-runtime\.js["']/g;
  for (const match of source.matchAll(importPattern)) {
    for (const part of match[1].split(',')) {
      const importedName = part.trim().split(/\s+as\s+/)[0];
      if (importedName) requestedNames.add(importedName);
    }
  }
}

const ownerByExport = new Map();
for (const [moduleName, packageName] of Object.entries(packageByModule)) {
  const packageExports = await import(packageName);
  for (const name of requestedNames) {
    if (!(name in packageExports)) continue;
    const previousOwner = ownerByExport.get(name);
    if (!previousOwner) {
      ownerByExport.set(name, moduleName);
      const names = requestedExports.get(moduleName) || new Set();
      names.add(name);
      requestedExports.set(moduleName, names);
    }
  }
}
const missingExports = [...requestedNames].filter(name => !ownerByExport.has(name));
if (missingExports.length) throw new Error(`Export Firebase non trovati: ${missingExports.join(', ')}`);

const browserEntry = [...requestedExports]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([moduleName, names]) => {
    const packageName = packageByModule[moduleName];
    if (!packageName) throw new Error(`Modulo Firebase non gestito: ${moduleName}`);
    const packageSubpath = packageName.slice('firebase/'.length);
    const resolvedPackage = path.join(root, 'node_modules', 'firebase', packageSubpath, 'dist', 'index.mjs').replaceAll('\\', '/');
    return `export { ${[...names].sort().join(', ')} } from ${JSON.stringify(resolvedPackage)};`;
  })
  .join('\n');

await mkdir(vendorDir, { recursive: true });
await build({
  absWorkingDir: root,
  nodePaths: [path.join(root, 'node_modules')],
  stdin: { contents: browserEntry, resolveDir: root, sourcefile: 'firebase-runtime-entry.js' },
  outfile: path.join(vendorDir, 'firebase-runtime.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome100', 'edge100', 'firefox100', 'safari15'],
  minify: true,
  legalComments: 'none'
});

await build({
  absWorkingDir: root,
  nodePaths: [path.join(root, 'node_modules')],
  stdin: {
    contents: `import firebase from ${JSON.stringify(path.join(root, 'node_modules/firebase/compat/app/dist/index.mjs').replaceAll('\\', '/'))}; import ${JSON.stringify(path.join(root, 'node_modules/firebase/compat/messaging/dist/index.mjs').replaceAll('\\', '/'))}; globalThis.firebase = firebase;`,
    resolveDir: root,
    sourcefile: 'firebase-sw-runtime-entry.js'
  },
  outfile: path.join(vendorDir, 'firebase-sw-runtime.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome100', 'edge100', 'firefox100', 'safari15'],
  minify: true,
  legalComments: 'none'
});

const cacheableExtensions = new Set(['.html', '.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.woff2']);
const publicFiles = await walk(publicDir);
const offlineAssets = publicFiles
  .filter(file => cacheableExtensions.has(path.extname(file).toLowerCase()))
  .filter(file => path.basename(file) !== 'sw.js')
  .map(file => path.relative(publicDir, file).replaceAll('\\', '/'))
  .sort();
await writeFile(
  path.join(publicDir, 'offline-assets.js'),
  `self.__OFFLINE_ASSETS = ${JSON.stringify(offlineAssets, null, 2)};\n`,
  'utf8'
);

console.log(`Runtime Firebase offline creato con ${ownerByExport.size} export e ${offlineAssets.length} risorse.`);
