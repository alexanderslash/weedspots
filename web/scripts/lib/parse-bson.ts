import { readFile } from 'node:fs/promises';
import { deserialize } from 'bson';

/**
 * Parse a mongodump-format BSON file into an array of objects.
 * BSON files from mongodump are a concatenation of length-prefixed documents.
 */
export async function parseBsonFile<T = Record<string, unknown>>(path: string): Promise<T[]> {
  const buf = await readFile(path);
  const out: T[] = [];
  let offset = 0;
  while (offset < buf.length) {
    // First 4 bytes of each BSON doc are the doc length (little-endian int32).
    const docLen = buf.readInt32LE(offset);
    if (docLen <= 0 || offset + docLen > buf.length) {
      throw new Error(
        `Corrupt BSON at offset ${offset}: docLen=${docLen}, file size=${buf.length}`,
      );
    }
    const slice = buf.subarray(offset, offset + docLen);
    out.push(deserialize(slice) as T);
    offset += docLen;
  }
  return out;
}
