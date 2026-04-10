import 'dotenv/config';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBsonFile } from './lib/parse-bson';
import { mergePlaceRaws } from './lib/merge-placeraws';
import { fetchAllCovers } from './lib/fetch-photos';
import { buildCities, buildCategories, buildSearchIndex } from './lib/aggregate';
import { writeOutputs } from './lib/write-outputs';
import { effectiveCategory } from '../src/lib/effective-category';
import { stateCitySlug } from '../src/lib/slugs';
import { rankSort } from '../src/lib/ranking';
import type { Business } from '../src/lib/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');

const BSON_DUMP_DIR = resolve(WEB_ROOT, process.env.BSON_DUMP_DIR || '../exports/db-export');
const DATA_DIR = resolve(WEB_ROOT, 'src/data');
const PUBLIC_DIR = resolve(WEB_ROOT, 'public');
const IMAGES_DIR = resolve(PUBLIC_DIR, 'images');

async function main() {
  console.log(`[import] reading BSON from ${BSON_DUMP_DIR}`);

  // Stage 1: parse
  const rawBusinesses = await parseBsonFile<Business>(resolve(BSON_DUMP_DIR, 'businesses.bson'));
  const placeRaws = await parseBsonFile<{ placeId: string; data: any }>(
    resolve(BSON_DUMP_DIR, 'placeraws.bson'),
  );
  console.log(`[import] parsed ${rawBusinesses.length} businesses, ${placeRaws.length} placeraws`);

  // Stage 2: filter
  const beforeFilter = rawBusinesses.length;
  const operational = rawBusinesses.filter(b => b.businessStatus === 'OPERATIONAL');
  console.log(`[import] ${operational.length} OPERATIONAL (${beforeFilter - operational.length} dropped)`);

  // Stage 3: merge placeraws
  const merged = mergePlaceRaws(operational, placeRaws);

  // Stage 4: derive category + stateCitySlug
  const derived = merged.map(b => {
    let scSlug: string | null = null;
    if (b.state && b.city) {
      try {
        scSlug = stateCitySlug(b.state, b.city);
      } catch {
        scSlug = null;
      }
    }
    return {
      ...b,
      category: effectiveCategory(b),
      stateCitySlug: scSlug,
    } as Business;
  });

  // Stage 5: photo scrape
  const coverMap = await fetchAllCovers(
    derived.map(b => ({ placeId: b.placeId, website: b.website })),
    IMAGES_DIR,
  );
  for (const b of derived) {
    b.coverPhoto = coverMap.get(b.placeId) ?? null;
  }

  // Stage 6: canonical sort
  derived.sort(rankSort);

  // Stage 7: aggregates
  const cities = buildCities(derived);
  const categories = buildCategories(derived);
  const searchIndex = buildSearchIndex(derived);
  console.log(`[import] aggregated ${cities.length} cities, ${categories.length} categories`);

  // Stage 8: write outputs
  await writeOutputs({
    businesses: derived,
    cities,
    categories,
    searchIndex,
    dataDir: DATA_DIR,
    publicDir: PUBLIC_DIR,
  });

  const withPhoto = derived.filter(b => b.coverPhoto).length;
  console.log('');
  console.log(`✓ Imported ${derived.length} businesses (${beforeFilter - operational.length} dropped — not OPERATIONAL)`);
  console.log(`✓ ${withPhoto} have a cover photo, ${derived.length - withPhoto} fell back to gradient`);
  console.log(`✓ ${cities.length} cities, ${categories.length} categories`);
  console.log(`✓ Outputs written to src/data/ + public/`);
}

main().catch(err => {
  console.error('[import] fatal:', err);
  process.exit(1);
});
