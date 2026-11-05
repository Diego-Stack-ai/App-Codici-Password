import { open, readFile } from 'node:fs/promises';

async function writeInPlace(file, text) {
  const data = Buffer.from(text, 'utf8');
  const handle = await open(file, 'r+');
  try {
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < data.length;) {
      const length = Math.min(chunkSize, data.length - offset);
      const { bytesWritten } = await handle.write(data, offset, length, offset);
      if (!bytesWritten) throw new Error(`Scrittura interrotta per ${file}`);
      offset += bytesWritten;
    }
    await handle.truncate(data.length);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

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
  const next = original.slice(0, a) + '\n' + section.trim() + '\n' + original.slice(b);
  const normalized = value => value.replaceAll('\r\n', '\n');
  if (normalized(next) === normalized(original)) return false;

  // OneDrive può restituire EBADF quando writeFile invia un documento grande in
  // un'unica operazione e può vietare la sostituzione del placeholder con rename.
  // Scritture posizionali limitate mantengono invece stabile il file cloud locale.
  try {
    await writeInPlace(file, next);
  } catch (error) {
    try { await writeInPlace(file, original); } catch { /* preserva l'errore iniziale */ }
    throw error;
  }
  return true;
}
