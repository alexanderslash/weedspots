'use strict';

function categorySlug(label) {
  return String(label || 'Other')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function categoryIcon(label) {
  const lower = String(label || '').toLowerCase();

  if (lower.includes('cannabis') || lower.includes('weed') || lower.includes('dispensary')) return '&#127807;';
  if (lower.includes('smoke') || lower.includes('tobacco') || lower.includes('cigar') || lower.includes('hookah')) return '&#128684;';
  if (lower.includes('vapor') || lower.includes('vape')) return '&#9729;';
  if (lower.includes('delivery')) return '&#128666;';
  if (lower.includes('clinic') || lower.includes('medical') || lower.includes('doctor') || lower.includes('pharmacy')) return '&#9877;';
  if (lower.includes('wellness') || lower.includes('health')) return '&#10024;';
  if (lower.includes('farm') || lower.includes('herb') || lower.includes('garden') || lower.includes('grow')) return '&#127793;';
  if (lower.includes('store') || lower.includes('shop')) return '&#127978;';
  return '&#128204;';
}

function categoryMeta(dbCategory) {
  const display = dbCategory || 'Other';
  return {
    display,
    icon: categoryIcon(display),
    slug: categorySlug(display),
  };
}

function starsHtml(rating) {
  const r = rating || 0;
  const full = Math.floor(r);
  const decimal = r - full;
  const hasPartial = decimal > 0;
  const empty = 5 - full - (hasPartial ? 1 : 0);
  let s = '';
  for (let i = 0; i < full; i++) s += '&#9733;';
  if (hasPartial) {
    const pct = Math.round(decimal * 100);
    s += `<span class="star-partial" style="--fill:${pct}%">&#9733;</span>`;
  }
  for (let j = 0; j < empty; j++) s += '<span class="star-empty">&#9733;</span>';
  return s;
}

function citySlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function truncate(str, len) {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.slice(0, len).replace(/\s+\S*$/, '') + '...';
}

function businessStatusDisplay(status) {
  const map = { OPERATIONAL: 'Open', CLOSED_TEMPORARILY: 'Temporarily Closed', CLOSED_PERMANENTLY: 'Permanently Closed' };
  return map[status] || status || 'Open';
}

function websiteDisplay(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function encodeURIComp(str) {
  return encodeURIComponent(str || '');
}

function paginationData(currentPage, totalPages, baseUrl) {
  if (totalPages <= 1) return { hasPagination: false };
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push({
      num: i,
      url: i === 1 ? baseUrl : `${baseUrl}page/${i}/`,
      isCurrent: i === currentPage,
    });
  }
  return {
    hasPagination: true,
    currentPage,
    totalPages,
    pages,
    prevPage: currentPage > 1 ? (currentPage - 1 === 1 ? baseUrl : `${baseUrl}page/${currentPage - 1}/`) : null,
    nextPage: currentPage < totalPages ? `${baseUrl}page/${currentPage + 1}/` : null,
  };
}

module.exports = {
  categorySlug,
  categoryMeta,
  starsHtml,
  citySlug,
  truncate,
  businessStatusDisplay,
  websiteDisplay,
  encodeURIComp,
  paginationData,
};
