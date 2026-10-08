// Decode UTF-8 once, after bounded byte collection. A network chunk boundary
// is not a character boundary. Invalid UTF-8 must not become replacement text.
export async function readBoundedJsonRequest(request, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw Error('BODY_LIMIT');
  const chunks = []; let size = 0, bytes;
  try {
    for await (const chunk of request) {
      if (!(chunk instanceof Uint8Array)) throw Error('INVALID_BODY');
      size += chunk.byteLength;
      if (size > maxBytes) throw Error('BODY_LIMIT');
      chunks.push(Buffer.from(chunk));
    }
    bytes = Buffer.concat(chunks, size);
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
  } finally {bytes?.fill(0); for (const chunk of chunks) chunk.fill(0);}
}
