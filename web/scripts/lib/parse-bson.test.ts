import { describe, it, expect } from 'vitest';
import { parseBsonFile } from './parse-bson';
import { resolve } from 'node:path';

const DUMP = resolve(__dirname, '../../../exports/db-export');

describe('parseBsonFile (integration)', () => {
  it('parses businesses.bson into a non-empty array with placeId fields', async () => {
    const docs = await parseBsonFile<{ placeId: string; name: string }>(
      resolve(DUMP, 'businesses.bson'),
    );
    expect(docs.length).toBeGreaterThan(1000);
    expect(docs[0]).toHaveProperty('placeId');
    expect(docs[0]).toHaveProperty('name');
  });

  it('parses placeraws.bson into a non-empty array', async () => {
    const docs = await parseBsonFile<{ placeId: string }>(
      resolve(DUMP, 'placeraws.bson'),
    );
    expect(docs.length).toBeGreaterThan(1000);
    expect(docs[0]).toHaveProperty('placeId');
  });
});
