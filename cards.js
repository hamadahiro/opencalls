const EMPTY_MESSAGES = ['Nothing here, for now.','No calls match this search.','Nothing came up this time.','No results, it seems.','No calls found for this.','Nothing fits this search.','No matches at the moment.','Nothing to show here.','No calls in this range.','Nothing here yet.'];
function emptyState() { return '<p class="empty-state">' + EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)] + '<a href="/browse/">Browse all calls</a></p>'; }

// NOTE: `eligibilityLabel` is defined once in shared.js, which every page loads
// before this file. Do not redeclare it here.

// === Search suggestions while typing (owner, 2026-11-28: "disable it completely but add live search suggestions like
// google as i type") ===
// Shared by the home page's search and search.js (every other page). Nothing while the box is empty; while typing, up to
// 7 completions — search-core.js completer over window.SEARCH_SUGGEST, the calls' own words, names and places, built with
// the search index — the completed part strong, and no dropdown when there are none. Every row opens /search/ for it.
var searchCompleter = null;
function buildSearchSuggestions(allCalls, query) {
  var q = (query || '').trim();
  if (!q || !window.SearchCore || !window.SEARCH_SUGGEST) return {};
  if (!searchCompleter) searchCompleter = SearchCore.completer(window.SEARCH_SUGGEST, allCalls, { categoryLabel: categoryLabel });
  // Only the completions, never the typed words again (owner, 2026-11-28); 7 rows fit the dropdown without scrolling.
  // None: no dropdown — Enter searches what is typed.
  var items = searchCompleter(q, 7).map(function(p) { return { type: 'q', value: p, label: p, html: SearchCore.completionHtml(p, q) }; });
  return items.length ? { Suggestions: items } : {};
}

function renderSearchDropdown(dropdownEl, wrapEl, groups, onSelect) {
  var keys = Object.keys(groups);
  if (!keys.length) {
    dropdownEl.style.display = 'none';
    wrapEl.classList.remove('has-suggestions');
    return;
  }
  var html = '';
  keys.forEach(function(groupName) {
    groups[groupName].forEach(function(item) {
      html += '<div class="search-suggestion" style="padding:10px 20px; cursor:pointer; font-size:var(--fs-tag); color:var(--text); display:flex; justify-content:space-between; align-items:center;" data-type="' + item.type + '" data-value="' + esc(item.value) + '" data-label="' + esc(item.label) + '">';
      html += '<span>' + (item.html || esc(item.label)) + '</span>';
      html += '</div>';
    });
  });
  dropdownEl.innerHTML = html;
  dropdownEl.style.display = 'block';
  wrapEl.classList.add('has-suggestions');
  // Guard against the focus/tap that opened the dropdown also landing on a
  // suggestion (mobile fast-tap); re-enable clicks shortly after.
  dropdownEl.style.pointerEvents = 'none';
  setTimeout(function() { dropdownEl.style.pointerEvents = ''; }, 300);
  dropdownEl.querySelectorAll('.search-suggestion').forEach(function(el) {
    if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {   // touch screens: no sticky highlight
      el.addEventListener('mouseenter', function() { el.style.background = 'var(--card-bg)'; });
      el.addEventListener('mouseleave', function() { el.style.background = ''; });
    }
    el.addEventListener('mousedown', function(e) {
      e.preventDefault();
      onSelect(el.dataset.type, el.dataset.value, el.dataset.label);
    });
  });
}

// NOTE: derivePrizeCategory + derivePrizeCategories are defined once in shared.js.
// Do not redeclare them here (they used to drift out of sync).

// Map chip selections to dedicated page URLs (avoids duplicate content with homepage)
function chipToUrl(type, value) {
  if (type === 'q') return '/search/?q=' + encodeURIComponent(value);
  if (type === 'category' && categorySlug[value]) return '/' + categorySlug[value] + '/';
  if (type === 'eligibility') return '/eligibility/' + value + '/';
  if (type === 'jury') return '/jury/' + value + '/';
  if (type === 'prize') return '/prize/' + value + '/';
  if (type === 'fee') return value === 'free' ? '/fees/free/' : value === 'free-entry' ? '/fees/free-entry/' : '/fees/entry-fee/';
  if (type === 'country') {
    var slug = (countryLongNames[value] || value).toLowerCase().replace(/\s+/g, '-');
    if (typeof countryPages !== 'undefined' && countryPages.includes(slug)) return '/' + slug + '/';
  }
  return null;
}

// ==AUTO-GENERATED-START== (do not edit manually)
const countryPages = ["online","united-states","united-kingdom","qatar","italy","poland","bulgaria","spain","france","germany","japan","northern-ireland","canada","greece","singapore","sweden","netherlands","norway","czech-republic","portugal","hungary","ukraine","argentina","morocco","austria","switzerland","south-africa","lithuania","denmark","india","brazil","ireland","australia","north-macedonia","iceland","croatia","estonia","romania","malaysia","russia","bosnia-and-herzegovina","finland","belgium","israel","united-arab-emirates","slovakia","mexico","albania","malta","south-korea","cyprus","china","turkey","hong-kong","belarus","philippines","taiwan","serbia","tunisia","monaco","new-zealand","nepal","latvia","nigeria","slovenia","indonesia","luxembourg"];
const SEARCH_INDEX_VERSION = '3a4f539d20';
// ==AUTO-GENERATED-END==

// Search data, loaded once on first use: /search-index.js sets
// window.SEARCH_CALLS (the fields search needs, built by generate-pages.js).
// No page loads data.json. Callbacks queue while the script is in flight.
var searchIndexWaiters = null;
function loadSearchIndex(cb) {
  if (window.SEARCH_CALLS) { cb(window.SEARCH_CALLS); return; }
  if (searchIndexWaiters) { searchIndexWaiters.push(cb); return; }
  searchIndexWaiters = [cb];
  var s = document.createElement('script');
  s.src = '/search-index.js?v=' + SEARCH_INDEX_VERSION;
  s.onload = function() {
    var waiting = searchIndexWaiters;
    searchIndexWaiters = null;
    waiting.forEach(function(f) { f(window.SEARCH_CALLS || []); });
  };
  s.onerror = function() { searchIndexWaiters = null; };
  document.head.appendChild(s);
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Central timezone logic — a call is open until the end of its deadline day
// (local time). Urgency class/label/slug come from the shared computeUrgency()
// in shared.js (the single contract the server static render also uses).
function processCall(call, now) {
  return { ...call, ...computeUrgency(call, now || new Date()) };
}

function renderCard(call, titleTag) {
  titleTag = titleTag || 'h4';
  return `
    <div class="call-card">
      <${titleTag} class="call-title"><a href="/${call.slug || slugify(call.title)}/">${esc(call.title)}${!call.orgInTitle ? ' · ' + esc(call.org) : ''}</a></${titleTag}>
      ${renderCardBody(call, { esc: esc, urgency: call })}
    </div>`;
}
