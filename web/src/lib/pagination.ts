export function paginate<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push(items.slice(i, i + size));
  }
  return pages;
}

export interface PaginationPage {
  num: number;
  url: string;
  isCurrent: boolean;
}

export interface PaginationData {
  hasPagination: boolean;
  currentPage: number;
  totalPages: number;
  pages: PaginationPage[];
  prevPage: string | null;
  nextPage: string | null;
}

export function paginationData(
  currentPage: number,
  totalPages: number,
  baseUrl: string,
): PaginationData {
  if (totalPages <= 1) {
    return {
      hasPagination: false,
      pages: [],
      currentPage,
      totalPages,
      prevPage: null,
      nextPage: null,
    };
  }
  const pages: PaginationPage[] = Array.from({ length: totalPages }, (_, i) => ({
    num: i + 1,
    url: i === 0 ? baseUrl : `${baseUrl}page/${i + 1}/`,
    isCurrent: i + 1 === currentPage,
  }));
  return {
    hasPagination: true,
    currentPage,
    totalPages,
    pages,
    prevPage:
      currentPage > 1
        ? currentPage - 1 === 1
          ? baseUrl
          : `${baseUrl}page/${currentPage - 1}/`
        : null,
    nextPage: currentPage < totalPages ? `${baseUrl}page/${currentPage + 1}/` : null,
  };
}
