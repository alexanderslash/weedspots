import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Business, CityAggregate, CategoryAggregate, SearchIndexEntry } from '../../src/lib/types';

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

export async function writeOutputs(opts: {
  businesses: Business[];
  cities: CityAggregate[];
  categories: CategoryAggregate[];
  searchIndex: SearchIndexEntry[];
  dataDir: string;      // web/src/data
  publicDir: string;    // web/public
}): Promise<void> {
  await writeJson(`${opts.dataDir}/businesses.json`, opts.businesses);
  await writeJson(`${opts.dataDir}/cities.json`, opts.cities);
  await writeJson(`${opts.dataDir}/categories.json`, opts.categories);
  await writeJson(`${opts.publicDir}/search-index.json`, opts.searchIndex);
}
