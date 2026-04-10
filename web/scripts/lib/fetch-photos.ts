import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { extractOgImage } from './og-image';

const USER_AGENT = 'weedspots-bot/1.0 (+https://weedspots.io)';
const FETCH_TIMEOUT_MS = 10_000;
const HTML_BODY_CAP_BYTES = 2 * 1024 * 1024;   // 2 MB
const IMAGE_BODY_CAP_BYTES = 5 * 1024 * 1024;  // 5 MB
const CONCURRENCY = 4;

export interface PhotoFetchResult {
  placeId: string;
  coverPhoto: string | null;
  status: 'success' | 'cached' | 'skipped' | 'failed' | 'no-website';
  reason?: string;
}

async function fetchWithCap(url: string, cap: number, accept: string): Promise<{ bytes: Buffer; contentType: string; finalUrl: string }> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: accept },
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const contentType = res.headers.get('content-type') || '';
    const reader = res.body?.getReader();
    if (!reader) throw new Error('no body');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > cap) throw new Error(`body exceeds ${cap} bytes`);
        chunks.push(value);
      }
    }
    return { bytes: Buffer.concat(chunks), contentType, finalUrl: res.url };
  } finally {
    clearTimeout(to);
  }
}

async function fetchOneCover(placeId: string, website: string, outDir: string): Promise<PhotoFetchResult> {
  const target = join(outDir, `${placeId}.webp`);
  const skipMarker = join(outDir, `${placeId}.skip`);

  if (existsSync(target)) {
    return { placeId, coverPhoto: `/images/${placeId}.webp`, status: 'cached' };
  }
  if (existsSync(skipMarker)) {
    return { placeId, coverPhoto: null, status: 'skipped' };
  }

  try {
    const html = await fetchWithCap(website, HTML_BODY_CAP_BYTES, 'text/html');
    if (!html.contentType.toLowerCase().includes('text/html')) {
      throw new Error(`non-html content-type: ${html.contentType}`);
    }
    const imageUrl = extractOgImage(html.bytes.toString('utf8'), html.finalUrl);
    if (!imageUrl) throw new Error('no og:image found');

    const img = await fetchWithCap(imageUrl, IMAGE_BODY_CAP_BYTES, 'image/*');
    await sharp(img.bytes)
      .rotate()
      .resize({ width: 800, height: 600, fit: 'cover', withoutEnlargement: false })
      .webp({ quality: 80 })
      .toFile(target);

    return { placeId, coverPhoto: `/images/${placeId}.webp`, status: 'success' };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // Record failure so reruns don't retry this source every time.
    await writeFile(skipMarker, '').catch(() => {});
    return { placeId, coverPhoto: null, status: 'failed', reason };
  }
}

export async function fetchAllCovers(
  businesses: Array<{ placeId: string; website?: string }>,
  outDir: string,
): Promise<Map<string, string | null>> {
  await mkdir(outDir, { recursive: true });
  const limit = pLimit(CONCURRENCY);
  const results = new Map<string, string | null>();

  let done = 0;
  let ok = 0;
  let cached = 0;
  let skipped = 0;
  let failed = 0;
  let noSite = 0;

  const tasks = businesses.map(b => limit(async () => {
    let res: PhotoFetchResult;
    if (!b.website) {
      res = { placeId: b.placeId, coverPhoto: null, status: 'no-website' };
      noSite++;
    } else {
      res = await fetchOneCover(b.placeId, b.website, outDir);
      if (res.status === 'success') ok++;
      else if (res.status === 'cached') cached++;
      else if (res.status === 'skipped') skipped++;
      else if (res.status === 'failed') {
        failed++;
        console.warn(`[warn] photo ${b.placeId} (${b.website}): ${res.reason}`);
      }
    }
    results.set(b.placeId, res.coverPhoto);
    done++;
    if (done % 100 === 0) {
      console.log(`[photos] ${done}/${businesses.length} (ok=${ok} cached=${cached} skipped=${skipped} failed=${failed} no-site=${noSite})`);
    }
  }));

  await Promise.all(tasks);
  console.log(`[photos] done: ok=${ok} cached=${cached} skipped=${skipped} failed=${failed} no-site=${noSite}`);
  return results;
}
