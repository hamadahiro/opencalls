// /search/ — the results page. The query lives in the address (/search/?q=…), so a search can be shared, reloaded and
// returned to with Back. The results are those of the address's query only: typing in the box changes the suggestions
// (search.js, as on every page), and Enter or a suggestion opens a new results page (owner, 2026-11-27).
// Finding, ordering and the quoted sentences are search-core.js; the cards are the site's own (shared.js, cards.js).
(function () {
  var input = document.getElementById('globalSearchInput');
  var clear = document.getElementById('globalSearchClear');
  var list = document.getElementById('searchResults');
  if (!input || !list || !window.SearchCore) return;

  var STEP = 30;
  var engine = null, groups = [], results = [];
  var page = Math.max(1, parseInt(new URLSearchParams(location.search).get('page'), 10) || 1);
  var TITLE = document.title;

  function now() { return new Date(); }

  function card(r) {
    var c = r.call;
    var title = SearchCore.highlight(c.title, groups) + (c.orgInTitle ? '' : ' · ' + SearchCore.highlight(c.org || '', groups));
    var tags = renderTags(c, { esc: esc });
    return '<div class="call-card"><h4 class="call-title"><a href="/' + c.slug + '/">' + title + '</a></h4>'
      + '<p class="call-description">' + cardDate(c, c, esc) + ' – ' + SearchCore.snippet(r, groups) + '</p>'
      + (tags ? '<div class="call-meta">' + tags + '</div>' : '') + '</div>';
  }

  // One page of the results, with the page links every list has (shared.js paginationHtml; owner, 2026-11-28: "everywhere
  // we have pagination"): 30 cards, pages at /search/?q=…&page=N.
  function showPage() {
    var count = Math.max(1, Math.ceil(results.length / STEP));
    if (page > count) page = count;
    var html = '';
    for (var i = (page - 1) * STEP; i < Math.min(results.length, page * STEP); i++) html += card(results[i]);
    var q = new URLSearchParams(location.search).get('q') || '';
    html += paginationHtml(function(k) { return '/search/?q=' + encodeURIComponent(q) + (k > 1 ? '&page=' + k : ''); }, page, count);
    list.insertAdjacentHTML('beforeend', html);
  }

  // Calls accepting submissions first, then closed ones; within each, the best match first (search-core's score), then
  // the soonest deadline for the first and the latest for the closed.
  function run(q) {
    q = q.trim();
    document.title = q ? q + (page > 1 ? ' – Page ' + page : '') + ' – ' + TITLE : TITLE;
    list.innerHTML = '';
    results = [];
    if (!q) return;
    // A misspelt word (no call has every word, and a correction finds them all): the results of the corrected words,
    // under "Did you mean …?", as search engines do (owner, 2026-11-27). Otherwise the typed words' own results.
    var out = engine.search(q), t = now(), corrected = null;
    if ((out.partial || !out.results.length) && out.suggestion) {
      var alt = engine.search(out.suggestion);
      if (alt.results.length && !alt.partial) { corrected = out.suggestion; out = alt; }
    }
    groups = out.groups;
    var open = [], past = [];
    out.results.forEach(function (r) {
      var call = processCall(r.row, t);
      var item = { call: call, row: r.row, doc: r.doc, score: r.score };
      (call.urgencyClass === 'closed' ? past : open).push(item);
    });
    open.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      if (a.call.deadline === 'Continuous') return b.call.deadline === 'Continuous' ? 0 : 1;
      if (b.call.deadline === 'Continuous') return -1;
      return a.call.deadlineDate - b.call.deadlineDate;
    });
    past.sort(function (a, b) { return b.score - a.score || b.call.deadlineDate - a.call.deadlineDate; });
    results = open.concat(past);
    if (corrected) list.innerHTML = '<p class="search-correction">Did you mean <a href="/search/?q=' + encodeURIComponent(corrected) + '">' + esc(corrected) + '</a>?</p>';
    if (!results.length) {
      var fix = out.suggestion ? '<a href="/search/?q=' + encodeURIComponent(out.suggestion) + '">Did you mean “' + esc(out.suggestion) + '”?</a>' : '';
      list.innerHTML = '<p class="empty-state">No calls match “' + esc(q) + '”.' + fix + '<a href="/browse/">Browse all calls</a></p>';
      return;
    }
    showPage();
  }

  var q = new URLSearchParams(location.search).get('q') || '';
  input.value = q;
  clear.classList.toggle('visible', q.length > 0);
  if (!q) input.focus();
  loadSearchIndex(function (rows) {
    engine = SearchCore.create(rows, { usStateNames: usStateNames, countryLongNames: countryLongNames, categoryLabel: categoryLabel, eligibilityLabel: eligibilityLabel });
    run(q);
  });
})();
