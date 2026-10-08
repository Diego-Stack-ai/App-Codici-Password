import { readFile, writeFile } from 'node:fs/promises';

// Only replace a known generated section; preserve all manually maintained text.
export async function writeGeneratedDocSection(file, name, content) {
  if (!['files', 'pages'].includes(name)) throw new Error('Sezione generata non ammessa');
  const start = `<!-- generated:${name}:start -->`;
  const end = `<!-- generated:${name}:end -->`;
  const original = await readFile(file, 'utf8');
  if (original.split(start).length !== 2 || original.split(end).length !== 2)
    throw new Error(`Delimitatori mancanti o duplicati per ${name}`);
  const a = original.indexOf(start) + start.length;
  const b = original.indexOf(end);
  if (b < a) throw new Error('Delimitatori invertiti');
  const section = content.replace(/^# /gm, '### ').replace(/^## /gm, '#### ');
  await writeFile(file, original.slice(0, a) + '\n' + section.trim() + '\n' + original.slice(b), 'utf8');
}
