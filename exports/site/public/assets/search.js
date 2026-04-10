(function () {
  'use strict';

  var index = null;
  var loaded = false;
  var loading = false;

  var pageInput = document.getElementById('search-input');
  var pageResults = document.getElementById('search-results');
  var pageStatus = document.getElementById('search-status');

  var heroInput = document.getElementById('hero-search-input');
  var heroDropdown = document.getElementById('hero-search-results');

  var timer = null;

  function loadIndex(cb) {
    if (loaded) { if (cb) cb(); return; }
    if (loading) return;
    loading = true;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/search-index.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try { index = JSON.parse(xhr.responseText); } catch (e) { index = []; }
      }
      loaded = true;
      loading = false;
      if (cb) cb();
    };
    xhr.send();
  }

  function starsHtml(rating) {
    var r = rating || 0;
    var full = Math.floor(r);
    var decimal = r - full;
    var hasPartial = decimal > 0;
    var empty = 5 - full - (hasPartial ? 1 : 0);
    var s = '';
    for (var i = 0; i < full; i++) s += '\u2605';
    if (hasPartial) {
      var pct = Math.round(decimal * 100);
      s += '<span class="star-partial" style="--fill:' + pct + '%">\u2605</span>';
    }
    for (var j = 0; j < empty; j++) s += '<span class="star-empty">\u2605</span>';
    return s;
  }

  function findMatches(query, limit) {
    if (!index) return null;
    var q = query.toLowerCase().trim();
    if (q.length < 2) return [];

    var terms = q.split(/\s+/);
    var matches = [];

    for (var i = 0; i < index.length; i++) {
      var item = index[i];
      var haystack = (item.name + ' ' + item.city + ' ' + item.category + ' ' + (item.address || '')).toLowerCase();
      var hit = true;
      for (var t = 0; t < terms.length; t++) {
        if (haystack.indexOf(terms[t]) === -1) { hit = false; break; }
      }
      if (hit) matches.push(item);
      if (matches.length >= limit) break;
    }
    return matches;
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s || ''));
    return d.innerHTML;
  }

  function formatCategory(slug) {
    if (!slug) return '';
    return slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  // ── Search page (full results) ──────────────────────────────────────────
  function searchPage(query) {
    if (!index) {
      pageStatus.textContent = 'Loading search index...';
      return;
    }

    var q = query.trim();
    if (q.length < 2) {
      pageResults.innerHTML = '';
      pageStatus.textContent = '';
      return;
    }

    var matches = findMatches(q, 50);

    if (matches.length === 0) {
      pageResults.innerHTML = '<div class="notice"><p>No weed businesses found matching \u201c' + escapeHtml(query) + '\u201d. Try a different search term or <a href="/category/">browse by category</a>.</p></div>';
      pageStatus.textContent = '0 results';
      return;
    }

    var html = '';
    for (var m = 0; m < matches.length; m++) {
      var r = matches[m];
      html += '<a href="/listing/' + r.slug + '/" class="search-result-item">' +
        '<h3>' + escapeHtml(r.name) + '</h3>' +
        '<div class="search-result-meta">' +
        '<span class="stars">' + starsHtml(r.rating) + '</span>' +
        '<span>' + escapeHtml(r.city) + '</span>' +
        '<span class="badge">' + escapeHtml(r.category || '') + '</span>' +
        '</div></a>';
    }
    pageResults.innerHTML = html;
    pageStatus.textContent = matches.length + (matches.length >= 50 ? '+' : '') + ' results';
  }

  // ── Homepage hero dropdown ──────────────────────────────────────────────
  function searchHero(query) {
    var q = query.trim();
    if (q.length < 2 || !index) {
      heroDropdown.classList.remove('active');
      heroDropdown.innerHTML = '';
      return;
    }

    var matches = findMatches(q, 8);

    if (matches === null) {
      heroDropdown.innerHTML = '<div class="hero-dd-status">Loading...</div>';
      heroDropdown.classList.add('active');
      return;
    }

    if (matches.length === 0) {
      heroDropdown.innerHTML = '<div class="hero-dd-status">No results for \u201c' + escapeHtml(q) + '\u201d</div>';
      heroDropdown.classList.add('active');
      return;
    }

    var html = '';
    for (var m = 0; m < matches.length; m++) {
      var r = matches[m];
      var ratingStr = (r.rating || 0).toFixed(1);
      html += '<a href="/listing/' + r.slug + '/" class="hero-dd-item">' +
        '<div>' +
          '<div class="hero-dd-name">' + escapeHtml(r.name) + '</div>' +
          '<div class="hero-dd-meta">' +
            '<span>' + escapeHtml(r.city) + '</span>' +
            '<span>' + escapeHtml(r.category || '') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="hero-dd-right">' +
          '<div class="hero-dd-rating">' + ratingStr + '</div>' +
          '<div class="hero-dd-stars">' + starsHtml(r.rating) + '</div>' +
        '</div>' +
      '</a>';
    }
    html += '<a href="/search/?q=' + encodeURIComponent(q) + '" class="hero-dd-all">See all results &rarr;</a>';
    heroDropdown.innerHTML = html;
    heroDropdown.classList.add('active');
  }

  // ── Bind search page ───────────────────────────────────────────────────
  if (pageInput) {
    pageInput.addEventListener('focus', function () { loadIndex(); });
    pageInput.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { searchPage(pageInput.value); }, 200);
    });

    var params = new URLSearchParams(window.location.search);
    var q = params.get('q');
    if (q) {
      pageInput.value = q;
      loadIndex(function () { searchPage(q); });
    }
  }

  // ── Bind homepage hero ─────────────────────────────────────────────────
  if (heroInput && heroDropdown) {
    heroInput.addEventListener('focus', function () { loadIndex(); });
    heroInput.addEventListener('input', function () {
      clearTimeout(timer);
      var val = heroInput.value;
      timer = setTimeout(function () {
        if (!loaded) {
          loadIndex(function () { searchHero(val); });
        } else {
          searchHero(val);
        }
      }, 200);
    });

    document.addEventListener('click', function (e) {
      if (!heroInput.contains(e.target) && !heroDropdown.contains(e.target)) {
        heroDropdown.classList.remove('active');
      }
    });

    heroInput.addEventListener('focus', function () {
      if (heroInput.value.trim().length >= 2 && heroDropdown.innerHTML) {
        heroDropdown.classList.add('active');
      }
    });
  }
})();
