import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../scripts/audit-static-references.mjs', import.meta.url), 'utf8');
const line = source.split('\n').find(line => line.includes('matchAll') && line.includes('import|export'));
assert.ok(line);
const collect = text => {
  const references = [];
  vm.runInNewContext(line, {text, references, path: {dirname: () => '.'}, file: 'fixture.js'});
  return references.map(item => item.value);
};
test('audit retains named/default/namespace/re-export/dynamic and side-effect imports', () => {
  for (const declaration of ["import {x} from './missing.js'", "import x from './missing.js'",
    "import * as x from './missing.js'", "export {x} from './missing.js'", "export * from './missing.js'",
    "import( './missing.js')", "import './missing.js'", "import x, {y as z} from './missing.js'"]) {
    assert.deepEqual(collect(declaration), ['./missing.js']);
  }
});
test('ordinary from text in compiled dependencies is not a module reference', () => {
  assert.deepEqual(collect('new U("from"),new U("else")'), []);
});
