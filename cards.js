const EMPTY_MESSAGES = ['Nothing here, for now.','No calls match this search.','Nothing came up this time.','No results, it seems.','No calls found for this.','Nothing fits this search.','No matches at the moment.','Nothing to show here.','No calls in this range.','Nothing here yet.'];
function emptyState() { return '<p class="empty-state">' + EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)] + '<a href="/browse/">Browse all calls</a></p>'; }

// NOTE: `eligibilityLabel` is defined once in shared.js, which every page loads
// before this file. Do not redeclare it here.

// === Shared search suggestion logic ===
// Both the home page's inline search and search.js (used on every other page)
// call into this so per-row counts, sort order, and group composition stay
// consistent. Fixing a bug here fixes it everywhere — no more "I changed
// search.js but the home page still shows wrong numbers."
//
// `opts.excludeChips`: array of { type, value } already active on the page
//   (home page uses chips; others don't — pass [] or omit).
// `opts.skipCategoriesOnFocus`: when true and the query is empty, omit the
//   Categories group from the result (home page has category buttons above the
//   search bar so categories there would be redundant).
function getOpenCallsFromArray(calls) {
  return calls.filter(function(c) { return isCallOpen(c.deadline); });
}
function buildSearchSuggestions(allCalls, query, opts) {
  opts = opts || {};
  var excludeChips = opts.excludeChips || [];
  var skipCategoriesOnFocus = !!opts.skipCategoriesOnFocus;
  var relevant = getOpenCallsFromArray(allCalls);
  var q = (query || '').toLowerCase().trim();
  var groups = {};
  function notExcluded(type, value) {
    return !excludeChips.some(function(ch) { return ch.type === type && ch.value === value; });
  }

  // Categories
  var catCounts = {};
  relevant.forEach(function(c) { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
  var catItems = Object.entries(categoryLabel).map(function(e) {
    return { type: 'category', value: e[0], label: e[1], count: catCounts[e[0]] || 0 };
  }).filter(function(item) {
    return item.count > 0 && (!q || item.label.toLowerCase().includes(q)) && notExcluded(item.type, item.value);
  }).sort(function(a, b) { return b.count - a.count; });
  if (catItems.length) groups['Categories'] = catItems.slice(0, 5);

  // Countries
  var countryCounts = {};
  relevant.forEach(function(c) {
    if (!c.location) return;
    var parts = c.location.split(',');
    var country = parts[parts.length - 1].trim();
    if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
  });
  var countryItems = Object.entries(countryCounts).map(function(e) {
    var display = countryLongNames[e[0]] || e[0];
    return { type: 'country', value: e[0], label: display, count: e[1] };
  }).filter(function(item) {
    return (!q || item.label.toLowerCase().includes(q)) && notExcluded(item.type, item.value);
  }).sort(function(a, b) { return b.count - a.count; });
  if (countryItems.length) groups['Locations'] = countryItems.slice(0, 6);

  // Eligibility
  var eligCounts = {};
  relevant.forEach(function(c) { if (c.eligibility) c.eligibility.forEach(function(e) { eligCounts[e] = (eligCounts[e] || 0) + 1; }); });
  var eligItems = Object.entries(eligibilityLabel).map(function(e) {
    return { type: 'eligibility', value: e[0], label: e[1], count: eligCounts[e[0]] || 0 };
  }).filter(function(item) {
    return item.count > 0 && (!q || item.label.toLowerCase().includes(q)) && notExcluded(item.type, item.value);
  }).sort(function(a, b) { return b.count - a.count; });
  if (eligItems.length) groups['Eligibility'] = eligItems.slice(0, 5);

  // Prizes
  var prizeCounts = {};
  relevant.forEach(function(c) {
    if (!c.prize) return;
    derivePrizeCategories(c.prize).forEach(function(pc) { prizeCounts[pc] = (prizeCounts[pc] || 0) + 1; });
  });
  var prizeItems = Object.entries(prizeCategoryLabel).map(function(e) {
    return { type: 'prize', value: e[0], label: e[1], count: prizeCounts[e[0]] || 0 };
  }).filter(function(item) {
    return item.count > 0 && (!q || item.label.toLowerCase().includes(q)) && notExcluded(item.type, item.value);
  }).sort(function(a, b) { return b.count - a.count; });
  if (prizeItems.length) groups['Prizes'] = prizeItems.slice(0, 5);

  // Fees
  // The three fee kinds, read by feeKind() in shared.js (the fee pages and chips read the same).
  var freeCount = relevant.filter(function(c) { return feeKind(c) === 'free'; }).length;
  var freeEntryCount = relevant.filter(function(c) { return feeKind(c) === 'free-entry'; }).length;
  var paidCount = relevant.filter(function(c) { return feeKind(c) === 'entry'; }).length;
  var feeItems = [
    { type: 'fee', value: 'free', label: 'Free', count: freeCount },
    { type: 'fee', value: 'free-entry', label: 'Free entry*', count: freeEntryCount },
    { type: 'fee', value: 'paid', label: 'Paid', count: paidCount }
  ].filter(function(item) {
    return item.count > 0 && (!q || item.label.toLowerCase().includes(q)) && notExcluded(item.type, item.value);
  });
  if (feeItems.length) groups['Fees'] = feeItems;

  // Organizations — only when typing
  if (q) {
    var orgCounts = {};
    relevant.forEach(function(c) { orgCounts[c.org] = (orgCounts[c.org] || 0) + 1; });
    var orgItems = Object.entries(orgCounts).map(function(e) {
      return { type: 'org', value: e[0], label: e[0], count: e[1] };
    }).filter(function(item) {
      return item.label.toLowerCase().includes(q) && notExcluded(item.type, item.value);
    }).sort(function(a, b) { return b.count - a.count; });
    if (orgItems.length) groups['Organizations'] = orgItems.slice(0, 5);
  }

  // Merge Prizes + Fees into one display group
  var pf = [];
  if (groups['Fees']) pf = pf.concat(groups['Fees']);
  if (groups['Prizes']) pf = pf.concat(groups['Prizes']);
  delete groups['Fees'];
  delete groups['Prizes'];
  if (pf.length) groups['Prize / Fee'] = pf.slice(0, 5);

  // Jury — only while typing, and last: the people who have a juror page (window.SEARCH_JURY: label, slug, other
  // spellings). Same match as Organizations: the name, or another spelling of it, contains the typed text. The rows
  // carry no count: the page they open says "N calls, M open." for the calls that name the person, while the list
  // under the search box counts every call whose text holds the typed words; two numbers for one name would differ.
  if (q && window.SEARCH_JURY) {
    var juryItems = window.SEARCH_JURY.filter(function(p) {
      return p[0].toLowerCase().includes(q) || (p[2] || []).some(function(n) { return n.toLowerCase().includes(q); });
    }).map(function(p) {
      return { type: 'jury', value: p[1], label: p[0], starts: p[0].toLowerCase().indexOf(q) === 0 };
    }).filter(function(item) { return notExcluded(item.type, item.value); })
      .sort(function(a, b) { return (b.starts - a.starts) || a.label.localeCompare(b.label); });
    if (juryItems.length) groups['Jury'] = juryItems.slice(0, 5);
  }

  // Home page strips Categories on focus (empty query) because category
  // buttons already sit above the search bar.
  if (!q && skipCategoriesOnFocus) {
    var limited = {};
    if (groups['Eligibility']) limited['Eligibility'] = groups['Eligibility'];
    if (groups['Locations']) limited['Locations'] = groups['Locations'];
    if (groups['Prize / Fee']) limited['Prize / Fee'] = groups['Prize / Fee'];
    return limited;
  }
  return groups;
}

// Browse-all links appended under each suggestion group.
var SEARCH_BROWSE_LINKS = {
  'Eligibility': { href: '/eligibility/', text: 'See all eligibility options' },
  'Locations': { href: '/locations/', text: 'See all locations' },
  'Prize / Fee': { href: '/prize/', text: 'See all fees and prizes' },
  'Categories': { href: '/categories/', text: 'See all categories' },
  'Organizations': { href: '/organizations/', text: 'See all organizations' },
  // No index page to see them all: the same muted line, as a label, tells these rows are people, not organizations.
  'Jury': { text: 'Jury members' }
};

// Shared search-dropdown renderer — single source of truth for the suggestion
// markup, browse links, and hover/select wiring. Used by both the home page
// (index.html inline script) and detail/category pages (search.js). The only
// per-page difference is the action on select: `onSelect(type, value, label)`
// — home adds a filter chip in place, other pages navigate to the listing.
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
      html += '<span>' + esc(item.label) + '</span>';
      if (item.count !== undefined) html += '<span style="color:var(--text-muted);">' + item.count + '</span>';
      html += '</div>';
    });
    if (SEARCH_BROWSE_LINKS[groupName]) {
      var link = SEARCH_BROWSE_LINKS[groupName];
      if (link.href) html += '<a href="' + link.href + '" style="display:block; padding:10px 20px; font-size:var(--fs-tag); color:var(--text-muted); text-decoration:none; letter-spacing:0.3px;">' + link.text + '</a>';
      else html += '<div class="search-group-label" style="display:block; padding:10px 20px; font-size:var(--fs-tag); color:var(--text-muted); letter-spacing:0.3px;">' + link.text + '</div>';
    }
  });
  dropdownEl.innerHTML = html;
  dropdownEl.style.display = 'block';
  wrapEl.classList.add('has-suggestions');
  // Guard against the focus/tap that opened the dropdown also landing on a
  // suggestion (mobile fast-tap); re-enable clicks shortly after.
  dropdownEl.style.pointerEvents = 'none';
  setTimeout(function() { dropdownEl.style.pointerEvents = ''; }, 300);
  dropdownEl.querySelectorAll('.search-suggestion').forEach(function(el) {
    el.addEventListener('mouseenter', function() { el.style.background = 'var(--card-bg)'; });
    el.addEventListener('mouseleave', function() { el.style.background = ''; });
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
const SEARCH_INDEX_VERSION = 'cf8a56c6d7';
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
