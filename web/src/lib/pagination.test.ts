import { describe, it, expect } from 'vitest';
import { paginate, paginationData } from './pagination';

describe('paginate', () => {
  it('splits an array into chunks of size N', () => {
    const items = Array.from({ length: 7 }, (_, i) => i);
    expect(paginate(items, 3)).toEqual([[0, 1, 2], [3, 4, 5], [6]]);
  });
  it('returns one page when items fit', () => {
    expect(paginate([1, 2], 10)).toEqual([[1, 2]]);
  });
  it('returns an empty-array page for empty input', () => {
    expect(paginate([], 10)).toEqual([[]]);
  });
});

describe('paginationData', () => {
  it('returns hasPagination=false when totalPages<=1', () => {
    const pd = paginationData(1, 1, '/category/dispensary/');
    expect(pd.hasPagination).toBe(false);
  });

  it('builds numbered pages with correct URLs', () => {
    const pd = paginationData(2, 3, '/category/dispensary/');
    expect(pd.hasPagination).toBe(true);
    expect(pd.pages.map(p => p.url)).toEqual([
      '/category/dispensary/',
      '/category/dispensary/page/2/',
      '/category/dispensary/page/3/',
    ]);
    expect(pd.pages[1].isCurrent).toBe(true);
    expect(pd.prevPage).toBe('/category/dispensary/');
    expect(pd.nextPage).toBe('/category/dispensary/page/3/');
  });

  it('prev on page 3 points to page/2/', () => {
    const pd = paginationData(3, 5, '/base/');
    expect(pd.prevPage).toBe('/base/page/2/');
  });

  it('next is null on the last page', () => {
    const pd = paginationData(5, 5, '/base/');
    expect(pd.nextPage).toBeNull();
  });
});
