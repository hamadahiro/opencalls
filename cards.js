const EMPTY_MESSAGES = ['Nothing here, for now.','No calls match this search.','Nothing came up this time.','No results, it seems.','No calls found for this.','Nothing fits this search.','No matches at the moment.','Nothing to show here.','No calls in this range.','Nothing here yet.'];
function emptyState() { return '<p class="empty-state">' + EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)] + '<a href="/browse/">Browse all calls &rarr;</a></p>'; }

// NOTE: `eligibilityLabel` is the single source of truth defined in
// generate-pages.js (ELIGIBILITY_LABEL) and injected into the
// ==AUTO-GENERATED== block below at build time. Do not redeclare it here.

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
  var now = new Date();
  var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  return calls.filter(function(c) { return c.deadline === 'Continuous' || c.deadline >= today; });
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
  var countryExpand = { USA: 'United States', UK: 'United Kingdom', UAE: 'United Arab Emirates' };
  var countryItems = Object.entries(countryCounts).map(function(e) {
    var display = countryExpand[e[0]] || e[0];
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
  var freeCount = relevant.filter(function(c) { return c.fee && c.fee.toLowerCase().startsWith('free'); }).length;
  var paidCount = relevant.filter(function(c) { return c.fee && !c.fee.toLowerCase().startsWith('free'); }).length;
  var feeItems = [
    { type: 'fee', value: 'free', label: 'Free', count: freeCount },
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
  'Eligibility': { href: '/eligibility/', text: 'All eligibility options' },
  'Locations': { href: '/locations/', text: 'All locations' },
  'Prize / Fee': { href: '/prize/', text: 'All fees and prizes' },
  'Categories': { href: '/categories/', text: 'All categories' },
  'Organizations': { href: '/organizations/', text: 'All organizations' }
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
      html += '<span style="color:var(--text-muted);">' + item.count + '</span>';
      html += '</div>';
    });
    if (SEARCH_BROWSE_LINKS[groupName]) {
      var link = SEARCH_BROWSE_LINKS[groupName];
      html += '<a href="' + link.href + '" style="display:block; padding:10px 20px; font-size:var(--fs-tag); color:var(--text-muted); text-decoration:none; letter-spacing:0.3px;">' + link.text + ' &rarr;</a>';
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

// NOTE: derivePrizeCategory + derivePrizeCategories are the single source of
// truth in generate-pages.js, injected into the ==AUTO-GENERATED== block below
// at build time. Do not redeclare them here (they used to drift out of sync).

// `prize` is split on " + " into one chip per part (renderer appends " prize").
// Use " + " ONLY to separate DISTINCT prizes. Never put a literal + inside one
// prize (e.g. "(1+ month)") or it breaks into garbage chips. Keep parts short
// (~<=30 chars) for mobile; drop dates/cities/parentheticals.
// Map chip selections to dedicated page URLs (avoids duplicate content with homepage)
function chipToUrl(type, value) {
  if (type === 'category' && categorySlug[value]) return '/' + categorySlug[value] + '/';
  if (type === 'eligibility') return '/eligibility/' + value + '/';
  if (type === 'prize') return '/prize/' + value + '/';
  if (type === 'fee') return value === 'free' ? '/fees/free/' : '/fees/entry-fee/';
  if (type === 'country') {
    var expand = {USA:'United States',UK:'United Kingdom',UAE:'United Arab Emirates'};
    var slug = (expand[value] || value).toLowerCase().replace(/\s+/g, '-');
    if (typeof countryPages !== 'undefined' && countryPages.includes(slug)) return '/' + slug + '/';
  }
  return null;
}

// ==AUTO-GENERATED-START== (do not edit manually)
const countryPages = ["united-kingdom","united-states","france","online","spain","italy","czech-republic","portugal","sweden","japan","hungary","ukraine","greece","germany","argentina","netherlands","morocco","canada","austria","northern-ireland","switzerland","south-africa","lithuania","singapore","denmark","india","brazil","ireland","australia","north-macedonia","iceland","croatia","estonia","romania","malaysia","russia","bosnia-and-herzegovina","finland","belgium","israel","united-arab-emirates","slovakia","mexico","albania","malta","norway","qatar","poland","spain-international-applicants","south-korea"];
const orgPages = [];
const statePages = {"GA":"united-states/georgia","AL":"united-states/alabama","IL":"united-states/illinois","NC":"united-states/north-carolina","CA":"united-states/california","OH":"united-states/ohio","FL":"united-states/florida","NY":"united-states/new-york","MO":"united-states/missouri","TX":"united-states/texas","OR":"united-states/oregon","TN":"united-states/tennessee","NM":"united-states/new-mexico","VT":"united-states/vermont","AZ":"united-states/arizona","PA":"united-states/pennsylvania","LA":"united-states/louisiana","SC":"united-states/south-carolina","MA":"united-states/massachusetts","VA":"united-states/virginia","UT":"united-states/utah","WY":"united-states/wyoming","MI":"united-states/michigan","NH":"united-states/new-hampshire","MN":"united-states/minnesota","KS":"united-states/kansas","MD":"united-states/maryland","DC":"united-states/washington-dc","AK":"united-states/alaska","RI":"united-states/rhode-island","IN":"united-states/indiana","CT":"united-states/connecticut","OK":"united-states/oklahoma","SD":"united-states/south-dakota","ME":"united-states/maine","WI":"united-states/wisconsin","WA":"united-states/washington","CO":"united-states/colorado"};
// ==AUTO-GENERATED-END==

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getLocationLink(location, country) {
  // For USA locations, link to state page if available
  if (country === 'USA' && typeof statePages !== 'undefined') {
    const parts = location.split(',');
    const state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
    if (state && statePages[state]) return '/' + statePages[state] + '/';
  }
  // Map abbreviated country names to their URL slugs
  const countrySlug = countrySlugs[country] || slugify(country);
  if (countryPages.includes(countrySlug)) return '/' + countrySlug + '/';
  return null;
}

// Central timezone logic — a call is open until the end of its deadline day (local time)
function processCall(call) {
  const now = new Date();
  const deadlineDate = call.deadline === 'Continuous' ? null : new Date(call.deadline + 'T00:00:00');
  const daysLeft = deadlineDate ? Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24)) : null;

  let urgencyClass = '';
  let urgencyText = '';
  if (call.deadline === 'Continuous') {
    urgencyText = 'Continuous';
    urgencyClass = 'rolling';
  } else if (daysLeft !== null && daysLeft < 0) {
    urgencyText = 'Closed';
    urgencyClass = 'closed';
  } else if (daysLeft !== null && daysLeft === 0) {
    urgencyText = 'Ending today';
    urgencyClass = 'ending';
  } else if (daysLeft !== null && daysLeft === 1) {
    urgencyText = 'Ending tomorrow';
    urgencyClass = 'ending';
  } else if (daysLeft !== null && daysLeft <= 14) {
    urgencyText = daysLeft + ' days left';
    urgencyClass = 'urgent';
  } else if (daysLeft !== null && daysLeft <= 30) {
    urgencyText = daysLeft + ' days left';
    urgencyClass = 'soon';
  } else if (deadlineDate) {
    urgencyText = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    urgencyClass = 'normal';
  }

  const deadlineSlug = deadlineDate ? ['january','february','march','april','may','june','july','august','september','october','november','december'][deadlineDate.getMonth()] + '-' + deadlineDate.getFullYear() : null;

  return { ...call, deadlineDate, daysLeft, urgencyClass, urgencyText, deadlineSlug };
}

// Maps a free-text requirements string to a single browse bucket slug.
// Keep in sync with deriveRequirementBucket() in generate-pages.js.
function renderCard(call, titleTag) {
  titleTag = titleTag || 'h4';
  return `
    <div class="call-card">
      <${titleTag} class="call-title"><a href="/${call.slug || slugify(call.title)}/">${esc(call.title)}${!call.orgInTitle ? ' · ' + esc(call.org) : ''}</a></${titleTag}>
      <div class="call-meta">${renderTags(call, { esc: esc, urgency: call, locationLink: getLocationLink })}</div>
      <p class="call-description">${esc(call.summary || call.description)}</p>
    </div>`;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function renderCallList(calls, container, opts) {
  opts = opts || {};
  const open = calls.filter(c => c.urgencyClass !== 'closed');
  const closed = calls.filter(c => c.urgencyClass === 'closed');

  // Sort open ascending
  open.sort((a, b) => {
    if (a.deadline === 'Continuous' && b.deadline === 'Continuous') return 0;
    if (a.deadline === 'Continuous') return 1;
    if (b.deadline === 'Continuous') return -1;
    return a.deadlineDate - b.deadlineDate;
  });

  // Build one big HTML string and assign to innerHTML once at the end.
  // Calling insertAdjacentHTML in a loop forces the browser to re-parse and
  // mutate the DOM N times, which on mobile turns a 600-card render into
  // ~1 second of main-thread block (visible as keystroke lag during search).
  // One innerHTML assignment is typically 5-10x faster.
  let html = '';

  if (opts.skipSections) {
    const all = [...open, ...closed];
    all.forEach(call => { html += renderCard(call, 'h4'); });
    container.innerHTML = html || emptyState();
    return;
  }

  // Ending Today / Ending Tomorrow sections
  const specialSlugs = new Set();
  const endingToday = open.filter(c => c.daysLeft !== null && c.daysLeft === 0);
  if (endingToday.length >= 1) {
    html += '<h3 class="section-header">Ending Today</h3>';
    endingToday.forEach(call => {
      html += renderCard(call, 'h4');
      specialSlugs.add(call.slug || slugify(call.title));
    });
  }
  const endingTomorrow = open.filter(c => c.daysLeft !== null && c.daysLeft === 1);
  if (endingTomorrow.length >= 1) {
    html += '<h3 class="section-header">Ending Tomorrow</h3>';
    endingTomorrow.forEach(call => {
      html += renderCard(call, 'h4');
      specialSlugs.add(call.slug || slugify(call.title));
    });
  }

  // Open month sections (skip Today/Tomorrow items)
  let currentSection = '';
  open.filter(c => !specialSlugs.has(c.slug || slugify(c.title))).forEach(call => {
    const section = call.deadline === 'Continuous' ? 'Continuous' : monthNames[call.deadlineDate.getMonth()] + ' ' + call.deadlineDate.getFullYear();
    if (section !== currentSection) {
      currentSection = section;
      html += '<h3 class="section-header">' + section + '</h3>';
    }
    html += renderCard(call, 'h4');
  });

  // Past sections (newest first)
  if (closed.length) {
    closed.sort((a, b) => b.deadlineDate - a.deadlineDate);
    const pastSlugs = new Set();

    // Yesterday section
    const yesterday = closed.filter(c => c.daysLeft !== null && c.daysLeft === -1);
    if (yesterday.length >= 1) {
      html += '<h3 class="section-header">Ended Yesterday</h3>';
      yesterday.forEach(call => {
        html += renderCard(call, 'h4');
        pastSlugs.add(call.slug || slugify(call.title));
      });
    }

    // Remaining past calls
    const rest = closed.filter(c => !pastSlugs.has(c.slug || slugify(c.title)));
    if (rest.length) {
      html += '<h3 class="section-header">Past</h3>';
      rest.forEach(call => {
        html += renderCard(call, 'h4');
      });
    }
  }

  container.innerHTML = html || emptyState();
}
