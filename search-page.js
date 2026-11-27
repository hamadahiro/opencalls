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
  var engine = null, groups = [], results = [], openCount = 0, shown = 0;
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

  function showMore() {
    var more = document.getElementById('moreResults');
    if (more) more.parentNode.removeChild(more);
    var end = Math.min(results.length, shown + STEP), html = '';
    for (var i = shown; i < end; i++) {
      if (i === 0 && openCount) html += '<h2 class="section-header">Accepting submissions (' + openCount + ')</h2>';
      if (i === openCount) {
        if (i === 0) html += '<h2 class="section-header">Accepting submissions (0)</h2>';
        html += '<h2 class="section-header">Closed (' + (results.length - openCount) + ')</h2>';
      }
      html += card(results[i]);
    }
    shown = end;
    if (shown < results.length) {
      html += '<p class="list-more" id="moreResults"><button type="button" class="more-results">Show more results (' + (results.length - shown) + ' left)</button></p>';
    }
    list.insertAdjacentHTML('beforeend', html);
    var btn = document.querySelector('#moreResults button');
    if (btn) btn.addEventListener('click', showMore);
  }

  // Calls accepting submissions first, then closed ones; within each, the best match first (search-core's score), then
  // the soonest deadline for the first and the latest for the closed.
  function run(q) {
    q = q.trim();
    document.title = q ? q + ' – ' + TITLE : TITLE;
    list.innerHTML = '';
    results = []; openCount = 0; shown = 0;
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
    openCount = open.length;
    if (corrected) list.innerHTML = '<p class="search-correction">Did you mean <a href="/search/?q=' + encodeURIComponent(corrected) + '">' + esc(corrected) + '</a>?</p>';
    if (!results.length) {
      var fix = out.suggestion ? '<a href="/search/?q=' + encodeURIComponent(out.suggestion) + '">Did you mean “' + esc(out.suggestion) + '”?</a>' : '';
      list.innerHTML = '<p class="empty-state">No calls match “' + esc(q) + '”.' + fix + '<a href="/browse/">Browse all calls</a></p>';
      return;
    }
    showMore();
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
