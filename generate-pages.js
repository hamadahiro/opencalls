const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Validate data before generating
const COUNTRY_ALIASES = { 'UK': 'United Kingdom', 'UAE': 'United Arab Emirates', 'US': 'United States', 'United States': 'USA' };
const VALID_CATEGORIES = ['photography', 'exhibition', 'grant', 'zine', 'residency', 'education'];
let hasErrors = false;

function err(msg) { console.error(`ERROR: ${msg}`); hasErrors = true; }
function isCallOpen(deadline) {
  if (deadline === 'Continuous') return true;
  const end = new Date(deadline + 'T00:00:00');
  end.setDate(end.getDate() + 1);
  return end > new Date();
}

data.calls.forEach((c, i) => {
  const label = c.title || `index ${i}`;

  // Required fields
  if (!c.title) err(`Call at index ${i} is missing title`);
  if (!c.org) err(`"${label}" is missing org`);
  if (!c.deadline) err(`"${label}" is missing deadline`);
  if (!c.url) err(`"${label}" is missing url`);
  if (!c.description) err(`"${label}" is missing description`);
  if (!c.location && c.location !== '') err(`"${label}" is missing location`);
  if (c.fee === undefined || c.fee === null) err(`"${label}" is missing fee`);
  if (!c.eligibility) err(`"${label}" is missing eligibility (use [] if open to all)`);

  // Deadline format: YYYY-MM-DD or "Continuous"
  if (c.deadline && c.deadline !== 'Continuous' && !/^\d{4}-\d{2}-\d{2}$/.test(c.deadline)) {
    err(`"${label}" has invalid deadline format: "${c.deadline}" — must be YYYY-MM-DD or "Continuous"`);
  }

  // Category is required and must be in list
  if (!c.category) {
    err(`"${label}" is missing category. Valid: ${VALID_CATEGORIES.join(', ')}`);
  } else if (!VALID_CATEGORIES.includes(c.category)) {
    err(`"${label}" has unknown category: "${c.category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
  }

  // Location format: "City, Country" or "City, State, USA" or "Online" or ""
  const loc = c.location || '';
  if (loc && loc !== 'Online') {
    const parts = loc.split(',').map(s => s.trim());
    if (parts.length < 2) {
      err(`"${label}" has invalid location format: "${loc}" — must be "City, Country" or "City, State, USA" or "Online"`);
    }
    const country = parts[parts.length - 1];
    if (COUNTRY_ALIASES[country]) {
      err(`"${label}" uses "${country}" — should be "${COUNTRY_ALIASES[country]}"`);
    }
    // US locations must use 2-letter state abbreviations, not full state names
    if (country === 'USA' && parts.length >= 3) {
      const state = parts[parts.length - 2];
      if (state.length > 2) {
        err(`"${label}" uses full state name "${state}" — must use 2-letter abbreviation (e.g. NY, CA, TX)`);
      }
    }
  }

  // Fee: reject "Check website" — if fee is unknown, leave it empty
  if (c.fee && /^check\s*(the\s*)?website$/i.test(c.fee.trim())) {
    err(`"${label}" has fee "Check website" — leave fee empty ("") if unknown`);
  }

  // Instagram format: must start with @ or be empty
  if (c.instagram && !c.instagram.startsWith('@')) {
    err(`"${label}" has invalid instagram: "${c.instagram}" — must start with @`);
  }

  // Eligibility tag format
  (c.eligibility || []).forEach(e => {
    if (e.length > 30 || /[^a-z0-9-]/.test(e)) {
      err(`"${label}" has invalid eligibility tag: "${e}" — lowercase alphanumeric and hyphens only`);
    }
  });

  // Prize: warn if has value but derives no category (might be missing a pattern)
  if (c.prize && c.prize !== '') {
    const pCats = derivePrizeCategories(c.prize);
    if (pCats.length === 0) {
      err(`"${label}" has prize "${c.prize}" that matches no prize category. Update derivePrizeCategories().`);
    }
  }
});
if (hasErrors) { console.error('\nFix errors above before generating.'); process.exit(1); }

// Auto-fill dateAdded for entries missing it, then write back
const dateAddedToday = new Date().toISOString();
let dateAddedCount = 0;
data.calls.forEach(c => {
  if (!c.dateAdded) { c.dateAdded = dateAddedToday; dateAddedCount++; }
});
if (dateAddedCount > 0) {
  fs.writeFileSync('data.json', JSON.stringify(data, null, 2) + '\n');
  console.log(`  Auto-filled dateAdded="${dateAddedToday}" on ${dateAddedCount} entries`);
}

const SITE = 'https://opencalls.monographica.com';
const YEAR = new Date().getFullYear();
const TITLE_SUFFIX = ' - Monographica';
const RESERVED = ['index', 'style', 'data', 'favicon', 'apple-touch-icon', 'og-image', 'bg', 'call-detail', 'cards', 'generate-pages', 'sitemap', 'CNAME', 'robots', '404', 'photography', 'exhibitions', 'grants', 'residencies', 'zines', 'education', 'categories', 'locations', 'organizations', 'free', 'paid', 'fees', 'prize', 'united-states', 'eligibility', 'browse', 'deadlines', 'submit', 'entry-fee'];
const MANUAL_FILES = ['index.html', '404.html'];
const _now = new Date();
const TODAY = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0') + '-' + String(_now.getDate()).padStart(2, '0');
const openCalls = data.calls.filter(c => c.deadline === 'Continuous' || c.deadline >= TODAY);
function isOpen(c) { return c.deadline === 'Continuous' || c.deadline >= TODAY; }

// Shared head snippets — change once, applies everywhere
const THEME_LIGHT = '#f5f2ed';
const THEME_DARK = '#151515';
const GA_SNIPPET = `<script src="/analytics.js"></script>`;
const PRELOAD = `<link rel="preload" href="/data.json" as="fetch" crossorigin>
  <link rel="alternate" type="application/rss+xml" title="Open Calls for Artists — Monographica" href="/feed.xml">`;
const ICONS = `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">`;
// Build BreadcrumbList JSON-LD from array of {name, url} items
function buildBreadcrumbJsonLd(items) {
  const list = [{ name: 'Home', url: SITE + '/' }, ...items];
  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": list.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      "item": item.url
    }))
  };
  return JSON.stringify(ld, null, 2);
}

function HEAD(opts) {
  const cssVersion = opts.cssVersion;
  const canonical = opts.canonical.endsWith('/') ? opts.canonical : opts.canonical + '/';
  const jsonLdBlocks = [];
  if (opts.jsonLd) jsonLdBlocks.push(opts.jsonLd);
  if (opts.breadcrumbs) jsonLdBlocks.push(buildBreadcrumbJsonLd(opts.breadcrumbs));
  const jsonLdHtml = jsonLdBlocks.map(ld => `<script type="application/ld+json">\n  ${ld}\n  </script>`).join('\n  ');
  return `${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">
  <title>${opts.title}${TITLE_SUFFIX}</title>
  <meta name="description" content="${opts.description}">
  ${opts.keywords ? `<meta name="keywords" content="${opts.keywords}">` : ''}
  <link rel="canonical" href="${canonical}">
  ${ICONS}
  <meta property="og:title" content="${opts.title}${TITLE_SUFFIX}">
  <meta property="og:description" content="${opts.description}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="${opts.ogType || 'website'}">
  <meta property="og:site_name" content="Monographica">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  ${jsonLdHtml}
  ${FONTS}
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">`;
}

// Shared header and footer
function buildHeader() {
  return `<header>
    <div class="header-inner">
      <a href="/" class="logo">Monographica</a>
      <nav>
        <a href="/" class="nav-link" data-nav="open">Open</a>
        <a href="/?view=past" class="nav-link" data-nav="closed">Closed</a>
        <a href="/?view=recent" class="nav-link" data-nav="recent">New</a>
        <a href="/browse/" class="nav-link nav-desktop" data-nav="browse">Browse</a>
        <a href="/submit/" class="nav-link nav-desktop" data-nav="submit">Submit</a>
      </nav>
      <button class="search-toggle" id="searchToggle" type="button" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" stroke-linejoin="miter"><circle cx="11" cy="11" r="8"/><line x1="17" y1="17" x2="21" y2="21"/></svg></button>
      <div class="hamburger-click-area" onclick="document.body.classList.toggle('show-responsive-nav')">
        <div class="hamburger"><i></i><i></i><i></i></div>
      </div>
    </div>
    <div class="mobile-nav">
      <a href="/" data-nav="open">Open</a>
      <a href="/?view=past" data-nav="closed">Closed</a>
      <a href="/?view=recent" data-nav="recent">New</a>
      <a href="/browse/" data-nav="browse">Browse</a>
      <a href="/submit/" data-nav="submit">Submit</a>
    </div>
  </header>
  <div class="global-search" id="globalSearchWrap">
    <button class="search-back" id="globalSearchBack" type="button" aria-label="Close search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="square" width="20" height="20"><path d="M15 19l-7-7 7-7"/></svg></button>
    <input type="text" class="search-bar" id="globalSearchInput" placeholder="Search calls and opportunities&hellip;" aria-label="Search open calls">
    <button class="search-clear" id="globalSearchClear" type="button" aria-label="Clear search">&times;</button>
    <div id="globalSearchDropdown" class="global-search-dropdown"></div>
  </div>
  <script>(function(){var p=location.pathname,s=location.search,n=p==='/'&&s.indexOf('view=past')!==-1?'closed':p==='/'?'open':p==='/browse/'||p==='/browse'?'browse':p==='/submit/'||p==='/submit'?'submit':'';document.querySelectorAll('[data-nav]').forEach(function(a){a.classList.toggle('active',a.getAttribute('data-nav')===n)});})()</script>`;
}
const HEADER = buildHeader();

const FOOTER = `<footer class="about-section" id="footer">
      <p class="disclaimer">Information is provided for convenience. Details may change. Always verify them on the official call website.</p>
      <p>&copy; ${YEAR} <a href="https://monographica.com">Monographica</a> &mdash; still making sense of things.</p>
    </footer>`;
function CARDS_SCRIPT(cssVersion) { return `<script src="/cards.js?v=${cssVersion}"></script>\n  <script src="/search.js?v=${cssVersion}"></script>`; }

function buildBreadcrumbs(section, sectionUrl) {
  const url = sectionUrl.endsWith('/') ? sectionUrl : sectionUrl + '/';
  return `<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="${url}">${section}</a></nav>`;
}

function buildHero(breadcrumbs, title, subtitle) {
  return `<section class="hero">
      ${breadcrumbs ? breadcrumbs + '\n      ' : ''}<h1>${title}</h1>
      <h2 class="subtitle">${subtitle}</h2>
    </section>`;
}

// Track generated files for cleanup at the end
const generatedFiles = new Set();
function writeGenerated(filepath, content) {
  const dir = path.dirname(filepath);
  if (dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, content);
  generatedFiles.add(filepath);
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeJsStr(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3c').replace(/>/g, '\\x3e').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
}

function getCountry(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function jsonStr(str) {
  return JSON.stringify(str).slice(1, -1);
}

function formatDeadline(deadline) {
  if (deadline === 'Continuous') return 'Continuous';
  const d = new Date(deadline + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function metaDescription(call) {
  const desc = call.description;
  const deadline = call.deadline === 'Continuous' ? 'Rolling deadline.' : `Deadline: ${formatDeadline(call.deadline)}.`;
  const maxLen = 157 - deadline.length - 1;
  const first = desc.split('. ').slice(0, 2).join('. ');
  const trimmed = first.length > maxLen ? first.substring(0, maxLen - 3) + '...' : (first.endsWith('.') ? first : first + '.');
  return escapeHtml(trimmed + ' ' + deadline);
}

// Pre-render static call list for SEO (Google sees content without JS)
function buildStaticCallList(calls) {
  if (!calls.length) return '';
  const sorted = calls.slice().sort((a, b) => {
    const aOpen = isOpen(a), bOpen = isOpen(b);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (a.deadline === 'Continuous') return 1;
    if (b.deadline === 'Continuous') return -1;
    return a.deadline.localeCompare(b.deadline);
  });
  let html = '';
  sorted.forEach(c => {
    const slug = c.slug || slugify(c.title);
    const title = c.orgInTitle ? escapeHtml(c.title) : escapeHtml(c.title) + ' &middot; ' + escapeHtml(c.org);
    const dl = formatDeadline(c.deadline);
    const desc = escapeHtml(c.summary || c.description).substring(0, 160);
    html += `      <div class="static-call-item"><h3><a href="/${slug}/">${title}</a></h3><p>${escapeHtml(dl)}${c.fee ? ' · ' + escapeHtml(c.fee) : ''}</p><p>${desc}</p></div>\n`;
  });
  return html;
}

// === Helpers ported from cards.js / call-detail.js so detail pages can pre-render
// the same content into static HTML (Google reads without JS). The browser JS
// later replaces this with identical content — no visual change for users. ===

const SHORT_COUNTRY = {
  'United Kingdom': 'UK',
  'United States': 'US',
  'United Arab Emirates': 'UAE',
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'BiH',
  'North Macedonia': 'N. Macedonia'
};

function shortenLocation(loc) {
  if (!loc) return loc;
  let s = loc.replace(/,\s*USA$/, '');
  for (const [full, sh] of Object.entries(SHORT_COUNTRY)) s = s.replace(full, sh);
  return s;
}

const ELIGIBILITY_LABEL = {
  'women': 'Women', 'united-states': 'US only', 'europe': 'Europe only', 'italy': 'Italy only',
  'emerging': 'Emerging artists', 'under-30': 'Under 30', 'under-35': 'Under 35', 'under-40': 'Under 40',
  'lgbtq': 'LGBTQ+', 'analog-photography': 'Analog only', 'alternative-process': 'Alternative process',
  'professional': 'Professional only', 'membership-required': 'Membership required',
  'puerto-rico': 'Puerto Rico focus', 'latin-america': 'Latin America', 'asian-american': 'Asian American focus',
  'south-asian': 'South Asian focus', 'african-diaspora': 'African diaspora focus', 'black': 'Black artists',
  'neurodivergent-disabled': 'Neurodivergent & disabled', 'portugal': 'Portugal only', 'taiwan': 'Taiwan only',
  'morocco': 'Morocco only', 'non-european': 'Non-European only', 'australia': 'Australia only',
  'canada': 'Canada only', 'ireland': 'Ireland only', 'switzerland': 'Switzerland only',
  'caribbean': 'Caribbean focus', 'nordic': 'Nordic only', 'germany': 'Germany only', 'malta': 'Malta only',
  '10-18': 'Ages 10–18', 'mid-atlantic-us': 'Mid-Atlantic US', 'alaska': 'Alaska only',
  'gulf-coast': 'Gulf Coast only', 'spain': 'Spain only', 'india': 'India only',
  '16-plus': '16+', '18-plus': '18+', '21-plus': '21+', '25-plus': '25+',
  'student': 'Students', 'ukraine': 'Ukraine only', 'flinta': 'FLINTA', 'global-south': 'Global South', 'france': 'France only',
  'tri-state': 'NY/NJ/CT only', 'wana': 'WANA region only'
};

function splitPrizeParts(prize) {
  if (!prize) return [];
  return prize.split(/\s*\+\s*/).map(s => { s = s.trim(); return s.charAt(0).toUpperCase() + s.slice(1); }).filter(Boolean);
}

function tagHtml(str, minLen) {
  minLen = minLen || 25;
  if (!str || str.length <= minLen) return escapeHtml(str || '');
  const words = str.split(' ');
  if (words.length <= 2) return escapeHtml(str);
  const splitAt = Math.ceil(words.length * 0.6);
  const front = words.slice(0, splitAt).join(' ');
  const back = words.slice(splitAt).join(' ');
  return `<span class="tag-front">${escapeHtml(front)}</span> <span class="tag-back">${escapeHtml(back)}</span>`;
}

// These get filled in once detail-page data is precomputed at the top of the script
let PRECOMPUTED_COUNTRY_PAGES = new Set();
let PRECOMPUTED_ORG_PAGES = new Set();
let PRECOMPUTED_STATE_PAGES = {};

function getStaticLocationLink(location, country) {
  if (country === 'USA') {
    const parts = location.split(',');
    const state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
    if (state && PRECOMPUTED_STATE_PAGES[state]) return '/' + PRECOMPUTED_STATE_PAGES[state] + '/';
  }
  const countrySlugs = { 'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates' };
  const countrySlug = countrySlugs[country] || slugify(country || '');
  if (PRECOMPUTED_COUNTRY_PAGES.has(countrySlug)) return '/' + countrySlug + '/';
  return null;
}

// Mirrors the prize block call-detail.js writes into #detailPrize
function buildStaticPrizeBlock(call) {
  if (!call.prize) return '';
  const parts = splitPrizeParts(call.prize);
  const label = parts.length > 1 ? 'Prizes' : 'Prize';
  const tags = parts.map(part => {
    const cat = derivePrizeCategory(part);
    const href = cat ? '/prize/' + cat + '/' : '/prize/';
    return `<a href="${href}" class="meta-tag meta-tag-link call-prize">${escapeHtml(part)} prize</a>`;
  }).join(' ');
  return `<div class="call-detail-prize"><span class="call-detail-prize-label"><a href="/prize/">${label}</a></span> ${tags}</div>`;
}

// Mirrors renderInfoGrid() in cards.js — produces the deadline/fee/prize/location/etc. table
function buildStaticInfoGrid(call) {
  function infoRow(label, value) {
    return `<div class="info-row"><span class="info-label">${label}</span><span class="dots"></span><span class="info-value">${value}</span></div>`;
  }
  function infoVal(str) { return tagHtml(str, 20); }
  function infoLink(href, str) { const h = href.endsWith('/') ? href : href + '/'; return `<a href="${h}" title="${escapeHtml(str)}">${infoVal(str)}</a>`; }

  const rows = [];

  // Deadline
  const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
    new Date(call.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let dlSlug = null;
  if (call.deadline !== 'Continuous') {
    const d = new Date(call.deadline + 'T00:00:00');
    dlSlug = ['january','february','march','april','may','june','july','august','september','october','november','december'][d.getMonth()] + '-' + d.getFullYear();
  }
  rows.push(infoRow('<a href="/deadlines/">Deadline</a>', dlSlug ? infoLink('/deadlines/' + dlSlug, deadlineText) : infoVal(deadlineText)));

  // Results date
  if (call.resultsDate) {
    const resultsPast = (function(s) {
      const months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
      const clean = s.replace(/^[~≈]/, '').replace(/^(After|Early|Mid-?|Late|End of)\s*/i, '');
      const my = clean.match(/([A-Za-z]+)[\s\d,]+(\d{4})/);
      if (!my) return false;
      const mi = months[my[1].toLowerCase()];
      if (mi === undefined) return false;
      const yr = parseInt(my[2]);
      const dm = clean.match(/(\d{1,2})[,\s-]/);
      const day = dm ? parseInt(dm[1]) : new Date(yr, mi + 1, 0).getDate();
      return new Date(yr, mi, day, 23, 59) < new Date();
    })(call.resultsDate);
    rows.push(infoRow('Results', escapeHtml(call.resultsDate) + (resultsPast ? ' (announced)' : '')));
  }

  // Fee
  if (call.fee) {
    const feeHtml = call.fee.toLowerCase().startsWith('free')
      ? infoLink('/fees/free', call.fee)
      : infoLink('/fees/entry-fee', call.fee);
    rows.push(infoRow('<a href="/fees/">Entry fee</a>', feeHtml));
  }

  // Eligibility
  if (call.eligibility && call.eligibility.length) {
    const eligHtml = call.eligibility.map(e => {
      const label = ELIGIBILITY_LABEL[e] || e;
      return infoLink('/eligibility/' + e, label);
    }).join(', ');
    rows.push(infoRow('<a href="/eligibility/">Eligibility</a>', eligHtml));
  }

  // Location
  if (call.location) {
    const country = getCountry(call.location);
    const locLink = getStaticLocationLink(call.location, country);
    const locShort = shortenLocation(call.location);
    const locHtml = locLink ? infoLink(locLink, locShort) : infoVal(locShort);
    rows.push(infoRow('<a href="/locations/">Location</a>', locHtml));
  }

  // Requirements
  if (call.requirements) rows.push(infoRow('Requirements', infoVal(call.requirements)));

  // AI policy (only if specified)
  if (call.ai && call.ai !== 'Not specified') rows.push(infoRow('AI policy', infoVal(call.ai)));

  // Submit via
  if (call.submitVia) {
    const open = isCallOpen(call.deadline);
    const label = infoVal(call.submitVia);
    if (!open) {
      rows.push(infoRow('Submit via', label));
    } else if (call.email) {
      rows.push(infoRow('Submit via', `<a href="mailto:${escapeHtml(call.email)}" target="_blank" rel="nofollow noopener">${label}</a>`));
    } else if (call.submitUrl) {
      rows.push(infoRow('Submit via', `<a href="${escapeHtml(call.submitUrl)}" target="_blank" rel="nofollow noopener">${label}</a>`));
    } else {
      rows.push(infoRow('Submit via', label));
    }
  }

  return rows.join('');
}

// Mirrors scoreSimilarity() + loadSimilar() in call-detail.js — pre-renders the
// "More like this" block so internal links are visible to Google.
function scoreSimilarityStatic(current, other) {
  let score = 0;
  const curElig = current.eligibility || [];
  const othElig = other.eligibility || [];
  curElig.forEach(t => { if (othElig.includes(t)) score += 5; });
  if (current.category === other.category) score += 4; else score -= 3;
  const curCountry = getCountry(current.location);
  const othCountry = getCountry(other.location);
  if (curCountry === 'USA' && othCountry === 'USA') {
    const curParts = (current.location || '').split(',');
    const othParts = (other.location || '').split(',');
    const curState = curParts.length >= 3 ? curParts[curParts.length - 2].trim() : '';
    const othState = othParts.length >= 3 ? othParts[othParts.length - 2].trim() : '';
    if (curState && curState === othState) score += 3; else score += 2;
  } else if (curCountry && curCountry === othCountry) {
    score += 2;
  }
  const curFree = current.fee && current.fee.toLowerCase().startsWith('free');
  const othFree = other.fee && other.fee.toLowerCase().startsWith('free');
  if (curFree && othFree) score += 1;
  if (!curFree && !othFree) score += 1;
  if (current.deadline !== 'Continuous' && other.deadline !== 'Continuous' && current.deadline && other.deadline) {
    const curDate = new Date(current.deadline + 'T00:00:00');
    const othDate = new Date(other.deadline + 'T00:00:00');
    const diff = Math.abs(curDate - othDate) / (1000 * 60 * 60 * 24);
    if (diff <= 30) score += 1;
  }
  if (current.org === other.org) score += 2;
  return score;
}

function buildStaticSimilarCalls(call, allCalls) {
  const currentSlug = call.slug || slugify(call.title);
  const candidates = allCalls
    .filter(c => (c.slug || slugify(c.title)) !== currentSlug)
    .filter(c => isCallOpen(c.deadline));
  const scored = candidates.map(c => ({ call: c, score: scoreSimilarityStatic(call, c) }));
  scored.sort((a, b) => b.score - a.score);
  const curElig = call.eligibility || [];
  const hasEligibility = curElig.length > 0;
  const top = scored.filter(s => {
    if (s.score < 5) return false;
    if (hasEligibility) {
      const othElig = s.call.eligibility || [];
      const sharedElig = curElig.some(t => othElig.includes(t));
      const sameCategory = s.call.category === call.category;
      if (!sharedElig && !sameCategory) return false;
    }
    return true;
  }).slice(0, 6);
  if (top.length < 2) return '';

  let html = '<h2 class="section-header">More like this</h2>';
  top.forEach(s => {
    const c = s.call;
    const slug = c.slug || slugify(c.title);
    const title = c.orgInTitle ? escapeHtml(c.title) : escapeHtml(c.title) + ' &middot; ' + escapeHtml(c.org);
    const desc = escapeHtml(c.summary || c.description || '').substring(0, 160);
    html += `<div class="call-card"><h3 class="call-title"><a href="/${slug}/">${title}</a></h3><p class="call-description">${desc}</p></div>`;
  });
  return html;
}

function buildKeywords(call) {
  const words = [call.title, call.org, categoryLabel(call.category), 'open call', 'call for entries'];
  if (call.location && call.location !== 'Online') words.push(call.location);
  if (call.category === 'photography') words.push('photography competition', 'photo contest');
  if (call.category === 'grant') words.push('artist grant', 'photography grant');
  if (call.category === 'residency') words.push('artist residency');
  if (call.category === 'exhibition') words.push('art exhibition');
  if (call.category === 'zine') words.push('photobook', 'zine submission');
  words.push('open calls for artists', 'photography submissions');
  return words.join(', ');
}

function derivePrizeCategory(text) {
  const p = text.toLowerCase();
  if (/[$€£¥]|chf\b|sek\b|aud\b|twd\b|rub\b|nok\b|aed\b|stipend|budget|gear|payment|voucher/.test(p)) return 'cash';
  if (/fellowship/.test(p)) return 'fellowship';
  if (/residency|accommodation|apartment|housing|studio/.test(p)) return 'residency';
  if (/publication|photobook|catalog|print edition|contributor|book/.test(p)) return 'publication';
  if (/exhibition/.test(p)) return 'exhibition';
  return null;
}

function derivePrizeCategories(prize) {
  if (!prize) return [];
  const seen = {};
  return prize.split(/\s*\+\s*/).map(s => s.trim()).filter(Boolean).map(part => derivePrizeCategory(part)).filter(c => {
    if (!c || seen[c]) return false;
    seen[c] = true;
    return true;
  });
}

function categoryLabel(cat) {
  const labels = {
    'photography': 'Photography', 'exhibition': 'Exhibition', 'grant': 'Grant',
    'zine': 'Zines & Books', 'residency': 'Residency', 'education': 'Education'
  };
  return labels[cat] || cat;
}


// Compute countries for landing pages (including Online)
const countryCounts = {};
data.calls.forEach(call => {
  const country = getCountry(call.location);
  if (country) {
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  }
});

// Compute orgs for landing pages
const orgCounts = {};
data.calls.forEach(call => { orgCounts[call.org] = (orgCounts[call.org] || 0) + 1; });

function buildJsonLd(call) {
  const pageUrl = `${SITE}/${call.slug || slugify(call.title)}/`;
  const submitUrl = call.submitUrl || call.url || pageUrl;
  const ld = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": call.title,
    "description": call.description,
    "url": submitUrl,
    "organizer": {
      "@type": "Organization",
      "name": call.org
    },
    "location": {
      "@type": "Place",
      "name": call.location || "Online"
    },
    "endDate": call.deadline === 'Continuous' ? undefined : call.deadline,
    "isAccessibleForFree": call.fee ? call.fee.toLowerCase().startsWith('free') : undefined
  };
  if (call.dateAdded) {
    const start = call.dateAdded.split('T')[0];
    ld.startDate = (ld.endDate && start > ld.endDate) ? ld.endDate : start;
  }
  // Clean undefined values
  Object.keys(ld).forEach(k => { if (ld[k] === undefined) delete ld[k]; });
  return JSON.stringify(ld, null, 2).replace(/</g, '\\u003c');
}

function generatePage(call, cssVersion) {
  const slug = call.slug || slugify(call.title);
  const desc = metaDescription(call);
  const country = getCountry(call.location);
  const metaTitle = call.orgInTitle ? escapeHtml(call.title) : escapeHtml(call.title) + ' · ' + escapeHtml(call.org);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: metaTitle, description: desc, keywords: escapeHtml(buildKeywords(call)), canonical: `${SITE}/${slug}`, ogType: 'article', jsonLd: buildJsonLd(call), breadcrumbs: [{ name: categoryLabel(call.category), url: `${SITE}/${call.category === 'zine' ? 'zines' : call.category === 'exhibition' ? 'exhibitions' : call.category === 'residency' ? 'residencies' : call.category === 'grant' ? 'grants' : call.category}/` }, { name: call.title, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${HEADER}

  <main>
    <section class="call-detail">
      <nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/${{'photography':'photography','exhibition':'exhibitions','grant':'grants','zine':'zines','residency':'residencies','education':'education'}[call.category] || call.category}/">${escapeHtml({'photography':'Photography','exhibition':'Exhibition','grant':'Grant','zine':'Zines & Books','residency':'Residency','education':'Education'}[call.category] || call.category)} open call</a></nav>
      <h1 class="call-detail-title">${escapeHtml(call.title)}</h1>

      <div id="detailPrize">${buildStaticPrizeBlock(call)}</div>

${call.prose && call.prose.length
  ? call.prose.map(p => `      <p class="call-detail-description">${escapeHtml(p)}</p>`).join('\n')
  : `      <p class="call-detail-description">${escapeHtml(call.description)}</p>`}
${call.winners && call.winners.length ? `
      <div class="call-detail-jury">
        <p class="call-detail-description">Winners: ${call.winners.map(w => escapeHtml(w)).join(' &middot; ')}</p>
      </div>
` : ''}
      <div class="call-detail-info" id="detailInfo">${buildStaticInfoGrid(call)}</div>
${call.jury && call.jury.length ? `
      <div class="call-detail-jury">
        <p class="call-detail-description">Jury: ${call.jury.map(j => escapeHtml(j)).join(' · ')}</p>
      </div>
` : ''}
      <div class="call-detail-jury">
        <p class="call-detail-description">Organized by <a href="/${slugify(call.org)}/">${escapeHtml(call.org)}</a></p>
      </div>
      <div class="call-detail-actions" id="detailActions">
${isCallOpen(call.deadline) ? `        <a href="${escapeHtml(call.url)}" target="_blank" rel="nofollow noopener" class="call-detail-btn call-detail-apply" id="applyBtn">Go to submission &rarr;</a>
${call.deadline !== 'Continuous' ? `        <a href="#" class="call-detail-btn call-detail-calendar" id="calBtn" onclick="downloadICS(event)">Add to calendar</a>` : ''}` : `        <span class="call-detail-btn call-detail-apply" style="opacity:0.4;pointer-events:none;cursor:default">Submissions closed</span>`}
      </div>
${call.instagram ? `      <div class="call-detail-jury"><a class="breadcrumbs" href="https://instagram.com/${escapeHtml(call.instagram.replace('@', ''))}" target="_blank" rel="nofollow noopener">${escapeHtml(call.instagram)}</a></div>` : ''}
    </section>

    <section class="related-calls">
      <div id="similarCalls">${buildStaticSimilarCalls(call, data.calls)}</div>
    </section>

    ${FOOTER}
  </main>

  <script>
    const CURRENT_SLUG = '${slug}';
    const CURRENT_CALL = ${JSON.stringify({ prize: call.prize || '', category: call.category, org: call.org, location: call.location || '', fee: call.fee || '', deadline: call.deadline, resultsDate: call.resultsDate || '', instagram: call.instagram || '', eligibility: call.eligibility || [], jury: call.jury || [], submitVia: call.submitVia || '', submitUrl: call.submitUrl || '', email: call.email || '', ai: call.ai || '', requirements: call.requirements || '' }).replace(/</g, '\\u003c')};
${isCallOpen(call.deadline) && call.deadline !== 'Continuous' ? `    function downloadICS(e) {
      e.preventDefault();
      function icsE(s){return s.replace(/\\\\/g,'\\\\\\\\').replace(/;/g,'\\\\;').replace(/,/g,'\\\\,').replace(/\\n/g,'\\\\n');}
      var d = '${call.deadline}'.replace(/-/g, '');
      var nd = new Date('${call.deadline}T00:00:00'); nd.setDate(nd.getDate() + 1); var de = String(nd.getFullYear()) + String(nd.getMonth()+1).padStart(2,'0') + String(nd.getDate()).padStart(2,'0');
      var t = '${safeJsStr(call.title)}';
      var u = '${safeJsStr(call.url)}';
      var o = '${safeJsStr(call.org)}';
      var dl = new Date('${call.deadline}T00:00:00').toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
      var desc = 'Open call by ' + icsE(o) + '\\\\n\\\\nDeadline: ' + icsE(dl)${call.prize ? ` + '\\\\nPrize: ' + icsE('${safeJsStr(call.prize)}')` : ''}${call.fee ? ` + '\\\\nEntry fee: ' + icsE('${safeJsStr(call.fee)}')` : ''};
      var ics = 'BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nPRODID:-//Monographica//Open Calls//EN\\r\\nBEGIN:VEVENT\\r\\nDTSTART;VALUE=DATE:' + d + '\\r\\nDTEND;VALUE=DATE:' + de + '\\r\\nSUMMARY:' + icsE(t) + ' - Deadline\\r\\nDESCRIPTION:' + desc + '\\r\\nURL:' + u + '\\r\\nBEGIN:VALARM\\r\\nTRIGGER:-P1D\\r\\nACTION:DISPLAY\\r\\nDESCRIPTION:Deadline tomorrow: ' + icsE(t) + '\\r\\nEND:VALARM\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR';
      var blob = new Blob([ics], {type: 'text/calendar'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = CURRENT_SLUG + '.ics';
      a.click();
    }` : ''}
  </script>
  ${CARDS_SCRIPT(cssVersion)}
  <script src="/call-detail.js"></script>

</body>
</html>`;
}

// Get CSS version from index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');
const cssVersionMatch = indexHtml.match(/style\.css\?v=([^"]+)/);
const cssVersion = cssVersionMatch ? cssVersionMatch[1] : '20260317b';

// Track slugs to detect collisions
const slugMap = {};
const sitemapEntries = [];
const createdCountrySlugs = [];
const createdOrgSlugs = [];
let generated = 0;
let skipped = 0;

// --- Precompute country/state/org slug sets so detail pages can pre-render
//     correct internal links to landing pages (must run BEFORE generatePage). ---
{
  const usStateNames = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};
  const stateNameToAbbr = {};
  Object.entries(usStateNames).forEach(([abbr, name]) => { stateNameToAbbr[name] = abbr; });
  const countrySlugFor = { 'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates' };

  data.calls.forEach(c => {
    const country = getCountry(c.location);
    if (country) PRECOMPUTED_COUNTRY_PAGES.add(countrySlugFor[country] || slugify(country));
    if (c.org) PRECOMPUTED_ORG_PAGES.add(slugify(c.org));
    if (c.location && c.location.endsWith('USA')) {
      const parts = c.location.split(',');
      let st = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
      if (st && stateNameToAbbr[st]) st = stateNameToAbbr[st];
      if (st && usStateNames[st]) PRECOMPUTED_STATE_PAGES[st] = 'united-states/' + slugify(usStateNames[st]);
    }
  });
}

data.calls.forEach(call => {
  const slug = call.slug || slugify(call.title);

  if (RESERVED.includes(slug)) {
    console.warn(`SKIPPED (reserved name): ${slug} — "${call.title}"`);
    skipped++;
    return;
  }

  if (slugMap[slug]) {
    console.warn(`SKIPPED (duplicate slug): ${slug} — "${call.title}" collides with "${slugMap[slug]}"`);
    skipped++;
    return;
  }

  slugMap[slug] = call.title;
  const html = generatePage(call, cssVersion);
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  generated++;
});

// === Category landing pages ===
const categories = {
  'photography': { title: 'Photography Open Calls', desc: 'Competitions, awards, and call for entries for photographers worldwide. Submit your work to juried exhibitions, contests, and portfolio reviews.', keywords: 'photography open calls, call for entries photography, photo competitions, photography submissions, photography awards, photography grants, photography contests' },
  'exhibition': { title: 'Exhibition Open Calls', desc: 'Call for entries for group and solo exhibitions worldwide. Gallery shows, curated exhibitions, and art fair opportunities for visual artists.', keywords: 'exhibition open calls, call for entries exhibition, art exhibition submissions, gallery open call, group exhibition, art show submissions' },
  'grant': { title: 'Grants for Photographers & Visual Artists', desc: 'Funding opportunities for photographers and visual artists. Project grants, production funds, and artist support programs — apply now.', keywords: 'photography grants, artist grants, call for entries grants, art funding, project grants for photographers, artist funding opportunities' },
  'residency': { title: 'Artist Residencies for Photographers', desc: 'Residency programs for photographers and visual artists worldwide. Studio residencies, international programs, and creative retreats.', keywords: 'artist residency, photography residency, call for entries residency, art residency programs, international artist residency' },
  'zine': { title: 'Zine & Photobook Open Calls', desc: 'Submit to photobook prizes, zine publications, and dummy awards. Publishing opportunities for photographers and visual artists.', keywords: 'photobook open call, call for entries photobook, zine submissions, photography publications, dummy award, photo book prize' },
  'education': { title: 'Photography Workshops & Education', desc: 'Workshops, masterclasses, mentoring programs, and educational opportunities for photographers and visual artists worldwide.', keywords: 'photography workshops, photography masterclass, call for entries education, photography mentoring, photography education, artist development' }
};

Object.entries(categories).forEach(([cat, info]) => {
  const catSlug = cat === 'zine' ? 'zines' : cat === 'exhibition' ? 'exhibitions' : cat === 'residency' ? 'residencies' : cat === 'grant' ? 'grants' : cat;
  const slug = catSlug;
  const catCalls = data.calls.filter(c => c.category === cat);
  const count = catCalls.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${info.title} ${YEAR}`, description: escapeHtml(info.desc), keywords: escapeHtml(info.keywords + ', ' + YEAR), canonical: `${SITE}/${slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${info.title} ${YEAR}`, "description": info.desc, "url": `${SITE}/${slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Categories', url: `${SITE}/categories/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero(buildBreadcrumbs('Categories', '/categories'), info.title, escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(catCalls)}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.category === '${cat}').map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Category page: ${slug} (${count} calls)`);
});

// === Special filter pages (Free, Prize) ===
const filterPages = [
  {
    slug: 'fees/free',
    feeKey: 'free',
    title: 'Free Open Calls for Artists',
    desc: 'Open calls with no entry fee. Free exhibitions, grants, residencies, and submissions for photographers and visual artists.',
    keywords: 'free open calls, free photography competitions, no fee art submissions, free call for entries, free exhibitions',
    filterJs: `c.fee && c.fee.toLowerCase().startsWith('free')`
  },
  {
    slug: 'fees/entry-fee',
    feeKey: 'entry-fee',
    title: 'Open Calls with Entry Fees',
    desc: 'Open calls with entry fees. Competitions, exhibitions, and submissions for photographers and visual artists.',
    keywords: 'open calls entry fee, photography competition entry fee, call for entries with fee, photography submissions with fee',
    filterJs: `c.fee && !c.fee.toLowerCase().startsWith('free')`
  }
];

const feeFilters = {
  'free': c => c.fee && c.fee.toLowerCase().startsWith('free'),
  'entry-fee': c => c.fee && !c.fee.toLowerCase().startsWith('free')
};

filterPages.forEach(fp => {
  const fpCalls = data.calls.filter(feeFilters[fp.feeKey]);
  const count = fpCalls.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${fp.title} ${YEAR}`, description: escapeHtml(fp.desc), keywords: `${escapeHtml(fp.keywords)}, ${YEAR}`, canonical: `${SITE}/${fp.slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${fp.title} ${YEAR}`, "description": fp.desc, "url": `${SITE}/${fp.slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Fees', url: `${SITE}/fees/` }, { name: fp.title, url: `${SITE}/${fp.slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/fees/">Fees</a></nav>', fp.title, escapeHtml(fp.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(fpCalls)}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => ${fp.filterJs}).map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

  writeGenerated(`${fp.slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${fp.slug}`);
  console.log(`  Filter page: ${fp.slug} (${count} calls)`);
});

// === Fees index page ===
const freeCount = openCalls.filter(feeFilters['free']).length;
const paidCount = openCalls.filter(feeFilters['entry-fee']).length;
const feesIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Entry Fee ${YEAR}`, description: 'Browse open calls by entry fee. Find free open calls with no submission fee, or paid competitions for photographers and visual artists.', keywords: `free open calls, paid open calls, no fee photography competitions, entry fee, call for entries free, ${YEAR}`, canonical: `${SITE}/fees`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `Open Calls by Entry Fee ${YEAR}`, "description": "Browse open calls by entry fee.", "url": `${SITE}/fees/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Fees', 'Browse open calls by entry fee. Find free submissions or paid competitions.')}

    <section class="index-list" id="indexList">
      <a href="/fees/free/" class="index-item">
        <span class="index-item-name">Free to Enter</span>
        <span class="dots"></span>
        <span class="index-item-count">${freeCount}</span>
      </a>
      <a href="/fees/entry-fee/" class="index-item">
        <span class="index-item-name">Entry Fee</span>
        <span class="dots"></span>
        <span class="index-item-count">${paidCount}</span>
      </a>
    </section>

    <p class="browse-more"><a href="/browse/">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

writeGenerated('fees/index.html', feesIndexHtml);
sitemapEntries.push(`${SITE}/fees`);
console.log(`  Fees index page`);

// === Eligibility pages ===
const eligibilityGroups = {
  'women': { short: 'Women', title: 'Open Calls for Women Photographers', desc: 'Open calls, grants, and awards exclusively for women, nonbinary, and gender-diverse photographers and visual artists.' },
  'united-states': { short: 'United States', title: 'US-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in the United States. Exhibitions, grants, residencies, and competitions for US-based artists.' },
  'europe': { short: 'Europe', title: 'Europe-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in Europe. Exhibitions, grants, residencies, and competitions for European artists.' },
  'italy': { short: 'Italy', title: 'Italy-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in Italy. Exhibitions, grants, residencies, and competitions for Italian artists.' },
  'emerging': { short: 'Emerging Artists', title: 'Open Calls for Emerging Artists', desc: 'Open calls, grants, and awards specifically for emerging, early-career, and student photographers and visual artists.' },
  'under-30': { short: 'Under 30', title: 'Open Calls for Under 30', desc: 'Open calls with age restrictions for photographers and artists under 30. Grants, exhibitions, awards, and emerging talent opportunities.' },
  'under-35': { short: 'Under 35', title: 'Open Calls for Under 35', desc: 'Open calls with age restrictions for photographers and artists under 35. Grants, exhibitions, awards, and emerging talent opportunities.' },
  'under-40': { short: 'Under 40', title: 'Open Calls for Under 40', desc: 'Open calls with age restrictions for photographers and artists under 40. Grants, exhibitions, awards, and mid-career opportunities.' },
  'lgbtq': { short: 'LGBTQ+', title: 'LGBTQ+ Open Calls', desc: 'Open calls, exhibitions, and awards for LGBTQ+ photographers and visual artists. Queer-focused grants, residencies, and competitions.' },
  'analog-photography': { short: 'Analog & Film', title: 'Analog & Film Photography Open Calls', desc: 'Open calls exclusively for analog, film, and non-digital photography. Exhibitions, awards, and publications for film and darkroom photographers.' },
  'alternative-process': { short: 'Alternative Process', title: 'Alternative Process Open Calls', desc: 'Open calls for alternative and historic photographic processes — cyanotype, anthotype, wet plate, and more.' },
  'professional': { short: 'Professional', title: 'Professional Photographers Only', desc: 'Open calls restricted to professional photographers. Juried exhibitions, industry awards, and competitions requiring professional credentials.' },
  'membership-required': { short: 'Membership Required', title: 'Membership Required', desc: 'Open calls that require membership or subscription to the organizing body. Exhibitions and awards from photography societies and associations.' },
  'puerto-rico': { short: 'Puerto Rico', title: 'Puerto Rico Focus', desc: 'Open calls for projects related to Puerto Rico and its diaspora. Exhibitions, grants, and awards celebrating Puerto Rican art and culture.' },
  'asian-american': { short: 'Asian American', title: 'Asian American Focus', desc: 'Open calls for projects exploring Asian American identity and experience. Exhibitions, grants, and awards for Asian American photographers.' },
  'south-asian': { short: 'South Asian', title: 'South Asian Focus', desc: 'Open calls for projects related to South Asian art and culture. Exhibitions, grants, and awards for South Asian photographers and artists.' },
  'african-diaspora': { short: 'African Diaspora', title: 'African Diaspora Focus', desc: 'Open calls for projects by or about African and diaspora artists. Exhibitions, grants, and awards celebrating African diaspora photography.' },
  'black': { short: 'Black Artists', title: 'Open Calls for Black Artists', desc: 'Open calls, exhibitions, and awards for Black photographers and visual artists. Grants, residencies, and competitions celebrating Black artistry.' },
  'neurodivergent-disabled': { short: 'Neurodivergent & Disabled', title: 'Open Calls for Neurodivergent & Disabled Artists', desc: 'Open calls, publications, and awards for neurodivergent, disabled, and chronically ill photographers and visual artists.' },
  'portugal': { short: 'Portugal', title: 'Portugal-Only Open Calls', desc: 'Open calls restricted to photographers and artists who are Portuguese citizens or residents of Portugal.' },
  'taiwan': { short: 'Taiwan', title: 'Taiwan-Only Open Calls', desc: 'Open calls restricted to photographers and artists who are Taiwanese nationals or residents of Taiwan.' },
  'latin-america': { short: 'Latin America', title: 'Latin America Focus', desc: 'Open calls for Latin American artists or projects connected to Latin America. Exhibitions, grants, and awards for Latin American photographers.' },
  'morocco': { short: 'Morocco', title: 'Morocco-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in Morocco. Exhibitions, grants, and residencies for Moroccan artists.' },
  'non-european': { short: 'Non-European', title: 'Non-European Artists Only', desc: 'Open calls restricted to artists from outside Europe — Africa, the Americas, Asia, and Oceania. Exhibitions, grants, and residencies.' },
  'australia': { short: 'Australia', title: 'Australia-Only Open Calls', desc: 'Open calls restricted to photographers and artists who are Australian citizens or permanent residents.' },
  'canada': { short: 'Canada', title: 'Canada-Only Open Calls', desc: 'Open calls restricted to photographers and artists who are Canadian citizens or permanent residents.' },
  'ireland': { short: 'Ireland', title: 'Ireland-Only Open Calls', desc: 'Open calls restricted to photographers and artists resident on the island of Ireland. Exhibitions, grants, and residencies for Irish artists.' },
  'switzerland': { short: 'Switzerland', title: 'Switzerland-Only Open Calls', desc: 'Open calls restricted to photographers and artists with Swiss citizenship or based in Switzerland.' },
  'caribbean': { short: 'Caribbean', title: 'Caribbean Focus', desc: 'Open calls for Caribbean artists or projects connected to the Caribbean. Exhibitions, grants, and awards for Caribbean photographers and visual artists.' },
  'nordic': { short: 'Nordic', title: 'Nordic-Only Open Calls', desc: 'Open calls restricted to citizens or residents of Nordic countries (Denmark, Finland, Iceland, Norway, Sweden).' },
  'germany': { short: 'Germany', title: 'Germany-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in Germany.' },
  'malta': { short: 'Malta', title: 'Malta-Only Open Calls', desc: 'Open calls restricted to photographers and artists who are Maltese nationals or based in Malta.' },
  '10-18': { short: 'Ages 10–18', title: 'Open Calls for Ages 10–18', desc: 'Open calls for young photographers ages 10 to 18. Photography competitions, exhibitions, and awards for young and teen artists.' },
  'mid-atlantic-us': { short: 'Mid-Atlantic US', title: 'Mid-Atlantic US Open Calls', desc: 'Open calls restricted to photographers in the Mid-Atlantic region — Maryland, Virginia, West Virginia, Pennsylvania, and Washington DC.' },
  'new-york-state': { short: 'New York State', title: 'New York State Open Calls', desc: 'Open calls restricted to photographers and artists residing in New York State (outside New York City). Grants, exhibitions, and awards for NYS-based artists.' },
  'alaska': { short: 'Alaska', title: 'Alaska-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Alaska.' },
  'bay-area': { short: 'Bay Area', title: 'Bay Area Open Calls', desc: 'Open calls restricted to photographers and artists based in the San Francisco Bay Area.' },
  'chicago-area': { short: 'Chicago Area', title: 'Chicago Area Open Calls', desc: 'Open calls restricted to photographers and artists based in the Chicago metropolitan area.' },
  'los-angeles': { short: 'Los Angeles', title: 'Los Angeles Open Calls', desc: 'Open calls restricted to photographers and artists based in the greater Los Angeles area.' },
  'tri-state': { short: 'Tri-State', title: 'Tri-State (NY/NJ/CT) Open Calls', desc: 'Open calls restricted to photographers, artists, and curators based in the New York tri-state area — New York, New Jersey, and Connecticut.' },
  'wana': { short: 'WANA Region', title: 'WANA Region Open Calls', desc: 'Open calls restricted to photographers and artists residing in the Western Asia and North Africa (WANA) region.' },
  'gulf-coast': { short: 'Gulf Coast', title: 'Gulf Coast Open Calls', desc: 'Open calls restricted to photographers and artists residing in US Gulf Coast states (Texas, Louisiana, Mississippi, Alabama, Georgia, Florida).' },
  'spain': { short: 'Spain', title: 'Spain-Only Open Calls', desc: 'Open calls restricted to photographers and artists born or based in Spain.' },
  'india': { short: 'India', title: 'India-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in India.' },
  '16-plus': { short: '16+', title: 'Open Calls Requiring 16+', desc: 'Open calls restricted to photographers and artists aged 16 or older. Exhibitions, grants, competitions, and awards with a 16+ age requirement.' },
  '18-plus': { short: '18+', title: 'Open Calls Requiring 18+', desc: 'Open calls restricted to photographers and artists aged 18 or older. Exhibitions, grants, competitions, and awards with an 18+ age requirement.' },
  '21-plus': { short: '21+', title: 'Open Calls Requiring 21+', desc: 'Open calls restricted to photographers and artists aged 21 or older. Exhibitions, grants, competitions, and awards with a 21+ age requirement.' },
  '25-plus': { short: '25+', title: 'Open Calls Requiring 25+', desc: 'Open calls restricted to photographers and artists aged 25 or older. Exhibitions, grants, competitions, and awards with a 25+ age requirement.' },
  '45-plus': { short: '45+', title: 'Open Calls for Artists 45+', desc: 'Open calls restricted to photographers and artists aged 45 or older. Residencies, grants, and awards for mature and established artists.' },
  'student': { short: 'Students', title: 'Open Calls for Students', desc: 'Open calls, prizes, and awards specifically for student photographers currently enrolled in a degree programme.' },
  'ukraine': { short: 'Ukraine', title: 'Ukraine-Only Open Calls', desc: 'Open calls restricted to Ukrainian or Ukraine-based photographers and artists. Exhibitions, grants, workshops, and awards for Ukrainian artists.' },
  'flinta': { short: 'FLINTA', title: 'Open Calls for FLINTA Artists', desc: 'Open calls for FLINTA (female, lesbian, inter, non-binary, trans, agender) photographers and visual artists. Grants, exhibitions, and awards.' },
  'global-south': { short: 'Global South', title: 'Global South Open Calls', desc: 'Open calls for photographers and artists from the Global South — Africa, the Caribbean, Southeast Asia, Latin America, and the Middle East.' },
  'france': { short: 'France', title: 'France-Only Open Calls', desc: 'Open calls restricted to photographers and artists who are French nationals or based in France.' },
  'mid-career': { short: 'Mid-Career', title: 'Open Calls for Mid-Career Artists', desc: 'Open calls restricted to mid-career photographers and artists with significant professional experience and exhibition history.' },
  'united-kingdom': { short: 'United Kingdom', title: 'UK-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in the United Kingdom.' },
  'kazakhstan': { short: 'Kazakhstan', title: 'Kazakhstan-Only Open Calls', desc: 'Open calls restricted to photographers and artists from Kazakhstan.' }
};

// Collect which eligibility tags actually exist in data
const eligibilityTags = {};
data.calls.forEach(c => {
  (c.eligibility || []).forEach(tag => {
    eligibilityTags[tag] = (eligibilityTags[tag] || 0) + 1;
  });
});
const openEligibilityTags = {};
openCalls.forEach(c => {
  (c.eligibility || []).forEach(tag => {
    openEligibilityTags[tag] = (openEligibilityTags[tag] || 0) + 1;
  });
});

// Validate all eligibility tags have a config entry in generate-pages.js AND cards.js
const cardsSource = fs.readFileSync('cards.js', 'utf8');
Object.keys(eligibilityTags).forEach(tag => {
  if (!eligibilityGroups[tag]) {
    console.error(`ERROR: Eligibility tag "${tag}" has no entry in eligibilityGroups (generate-pages.js). Add label, title, and desc.`);
    hasErrors = true;
  }
  if (!cardsSource.includes(`'${tag}'`)) {
    console.error(`ERROR: Eligibility tag "${tag}" has no entry in eligibilityLabel (cards.js). Add a display label.`);
    hasErrors = true;
  }
});
if (hasErrors) { console.error('Fix errors above before generating.'); process.exit(1); }

const eligibilityPageSlugs = [];
Object.entries(eligibilityGroups).forEach(([tag, info]) => {
  const count = eligibilityTags[tag] || 0;
  const slug = `eligibility/${tag}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(info.title)} ${YEAR}`, description: escapeHtml(info.desc), keywords: `${escapeHtml(info.short)} open calls, ${escapeHtml(info.short)} photography, call for entries ${escapeHtml(info.short)}, ${YEAR}`, canonical: `${SITE}/${slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${info.title} ${YEAR}`, "description": info.desc, "url": `${SITE}/${slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Eligibility', url: `${SITE}/eligibility/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/eligibility/">Eligibility</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => c.eligibility && c.eligibility.includes(tag)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.eligibility && c.eligibility.includes('${tag}')).map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

  eligibilityPageSlugs.push(tag);
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Eligibility page: ${tag} (${count} calls)`);
});

// Eligibility index page
const eligibilityOrder = [
  { heading: 'Who Can Apply', tags: ['women', 'flinta', 'black', 'lgbtq', 'neurodivergent-disabled', 'emerging', 'mid-career', 'student', 'professional', 'under-30', 'under-35', 'under-40', '16-plus', '18-plus', '21-plus', '25-plus', '45-plus', '10-18'] },
  { heading: 'Where', tags: ['united-states', 'new-york-state', 'alaska', 'bay-area', 'chicago-area', 'los-angeles', 'tri-state', 'gulf-coast', 'mid-atlantic-us', 'canada', 'europe', 'australia', 'france', 'germany', 'india', 'ireland', 'italy', 'kazakhstan', 'malta', 'morocco', 'nordic', 'portugal', 'spain', 'switzerland', 'taiwan', 'ukraine', 'united-kingdom', 'non-european', 'wana'] },
  { heading: 'Medium', tags: ['analog-photography', 'alternative-process'] },
  { heading: 'Focus', tags: ['african-diaspora', 'asian-american', 'caribbean', 'global-south', 'latin-america', 'puerto-rico', 'south-asian'] },
  { heading: 'Other', tags: ['membership-required'] }
];

// Validate all used eligibility tags appear in eligibilityOrder
const allOrderedTags = new Set(eligibilityOrder.flatMap(g => g.tags));
Object.keys(eligibilityTags).forEach(tag => {
  if (!allOrderedTags.has(tag)) {
    console.error(`ERROR: Eligibility tag "${tag}" exists in data but is not listed in eligibilityOrder. Add it to a group.`);
    process.exit(1);
  }
});

function buildEligibilityIndexItems() {
  let html = '';
  eligibilityOrder.forEach(group => {
    const activeTags = group.tags.filter(t => eligibilityTags[t]);
    if (!activeTags.length) return;
    activeTags.sort((a, b) => (openEligibilityTags[b] || 0) - (openEligibilityTags[a] || 0));
    html += `<h3 class="section-header">${escapeHtml(group.heading)}</h3>\n`;
    activeTags.forEach(tag => {
      const info = eligibilityGroups[tag];
      const count = openEligibilityTags[tag] || 0;
      html += `      <a href="/eligibility/${tag}/" class="index-item">
          <span class="index-item-name">${escapeHtml(info.short)}</span>
          <span class="dots"></span>
          <span class="index-item-count">${count}</span>
        </a>\n`;
    });
  });
  return html;
}

if (eligibilityPageSlugs.length) {
  const eligIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Eligibility ${YEAR}`, description: 'Browse open calls by eligibility. Find calls for women, emerging artists, LGBTQ+ photographers, regional restrictions, analog photography, and more.', keywords: `open calls eligibility, women photographers, emerging artists, LGBTQ photographers, photography residency eligibility, call for entries eligibility, ${YEAR}`, canonical: `${SITE}/eligibility`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `Open Calls by Eligibility ${YEAR}`, "description": "Browse open calls by eligibility.", "url": `${SITE}/eligibility/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Eligibility', 'Browse open calls by eligibility. Find calls for women, emerging artists, LGBTQ+ photographers, regional restrictions, analog photography, and more.')}

    <section class="index-list" id="indexList">
      ${buildEligibilityIndexItems()}
    </section>

    <p class="browse-more"><a href="/browse/">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

  writeGenerated('eligibility/index.html', eligIndexHtml);
  sitemapEntries.push(`${SITE}/eligibility`);
  console.log(`  Eligibility index page (${eligibilityPageSlugs.length} groups)`);
}

// === Prize category pages ===
const prizeGroups = {
  'cash': { short: 'Cash Prize', title: 'Open Calls with Cash Prizes', desc: 'Open calls offering cash awards, grants, and monetary prizes for photographers and visual artists. Browse competitions with cash prizes and apply today.' },
  'exhibition': { short: 'Exhibition', title: 'Open Calls with Exhibition Prizes', desc: 'Open calls where the prize includes an exhibition — solo shows, group exhibitions, and gallery opportunities for photographers and visual artists worldwide.' },
  'publication': { short: 'Publication', title: 'Open Calls with Publication Prizes', desc: 'Open calls where the prize includes publication — photobooks, catalogs, magazine features, and print editions for photographers and visual artists.' },
  'residency': { short: 'Residency', title: 'Open Calls with Residency Prizes', desc: 'Open calls where the prize includes an artist residency, studio access, or accommodation. Find residency opportunities for photographers and visual artists.' },
  'fellowship': { short: 'Fellowship', title: 'Open Calls with Fellowship Prizes', desc: 'Open calls offering fellowships for photographers and visual artists. Funded fellowships, mentoring programs, and professional development opportunities.' }
};

const prizeCatTags = {};
data.calls.forEach(c => {
  derivePrizeCategories(c.prize).forEach(tag => {
    prizeCatTags[tag] = (prizeCatTags[tag] || 0) + 1;
  });
});
const openPrizeCatTags = {};
openCalls.forEach(c => {
  derivePrizeCategories(c.prize).forEach(tag => {
    openPrizeCatTags[tag] = (openPrizeCatTags[tag] || 0) + 1;
  });
});

const prizeCatPageSlugs = [];
Object.entries(prizeCatTags).forEach(([tag, count]) => {
  const info = prizeGroups[tag];
  if (!info) return;
  const slug = `prize/${tag}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(info.title)} ${YEAR}`, description: escapeHtml(info.desc), keywords: `${escapeHtml(info.short)} open calls, photography ${escapeHtml(info.short.toLowerCase())} prize, call for entries ${escapeHtml(info.short.toLowerCase())}, art ${escapeHtml(info.short.toLowerCase())} award, ${YEAR}`, canonical: `${SITE}/${slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${info.title} ${YEAR}`, "description": info.desc, "url": `${SITE}/${slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Prizes', url: `${SITE}/prize/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/prize/">Prizes</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => derivePrizeCategories(c.prize).includes(tag)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    function derivePrizeCats(prize) {
      if (!prize) return [];
      var seen = {};
      return prize.split(/\\s*\\+\\s*/).map(function(s){return s.trim()}).filter(Boolean).map(function(t){
        var p = t.toLowerCase();
        if (/[$€£¥]|chf\\b|sek\\b|aud\\b|twd\\b|rub\\b|stipend|budget|gear|payment|voucher/.test(p)) return 'cash';
        if (/fellowship/.test(p)) return 'fellowship';
        if (/residency|accommodation|apartment|housing|studio/.test(p)) return 'residency';
        if (/publication|photobook|catalog|print edition|contributor|book/.test(p)) return 'publication';
        if (/exhibition/.test(p)) return 'exhibition';
        return null;
      }).filter(function(c){ if(!c||seen[c])return false; seen[c]=true; return true; });
    }
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => derivePrizeCats(c.prize).includes('${tag}')).map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

  prizeCatPageSlugs.push(tag);
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Prize page: ${tag} (${count} calls)`);
});

// Prize index page
const prizeOrder = ['cash', 'exhibition', 'publication', 'residency', 'fellowship'];

function buildPrizeIndexItems() {
  let html = '';
  prizeOrder.filter(t => openPrizeCatTags[t]).forEach(tag => {
    const info = prizeGroups[tag];
    html += `      <a href="/prize/${tag}/" class="index-item">
        <span class="index-item-name">${escapeHtml(info.short)}</span>
        <span class="dots"></span>
        <span class="index-item-count">${openPrizeCatTags[tag]}</span>
      </a>\n`;
  });
  return html;
}

if (prizeCatPageSlugs.length) {
  const prizeIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Prize Type ${YEAR}`, description: 'Browse open calls by prize type. Find calls with cash prizes, exhibitions, publications, residencies, and fellowships.', keywords: `open calls prizes, photography awards, cash prizes photographers, exhibition prizes, publication prizes, residency prizes, photography competitions, ${YEAR}`, canonical: `${SITE}/prize`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `Open Calls by Prize Type ${YEAR}`, "description": "Browse open calls by prize type.", "url": `${SITE}/prize/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Prizes', 'Browse open calls by prize type. Find calls with cash prizes, exhibitions, publications, residencies, and fellowships.')}

    <section class="index-list" id="indexList">
      ${buildPrizeIndexItems()}
    </section>

    <p class="browse-more"><a href="/browse/">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

  writeGenerated('prize/index.html', prizeIndexHtml);
  sitemapEntries.push(`${SITE}/prize`);
  console.log(`  Prize index page (${prizeCatPageSlugs.length} groups)`);
}

// === Country landing pages ===
const countryNames = {
  'USA': 'the United States', 'UK': 'the United Kingdom', 'UAE': 'the United Arab Emirates', 'Netherlands': 'the Netherlands'
};
const countrySlugs = {
  'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates'
};

Object.entries(countryCounts)
  .forEach(([country, count]) => {
    const fullName = countryNames[country] || country;
    const countrySlug = countrySlugs[country] || slugify(country);
    const slug = countrySlug;
    const isOnline = country === 'Online';
    const title = isOnline ? 'Online Open Calls for Artists' : `Open Calls for Artists in ${fullName}`;
    const desc = isOnline
      ? 'Online open calls, competitions, and submissions for photographers and visual artists. No travel required — apply from anywhere.'
      : `Find open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullName}. Browse and apply today.`;
    const keywords = isOnline
      ? 'online open calls, online photography competitions, remote art submissions, virtual exhibitions, online call for entries, photography contests online'
      : `open calls ${fullName}, call for entries ${fullName}, photography opportunities ${fullName}, art exhibitions ${fullName}, photography grants ${fullName}, artist residency ${fullName}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(title)} ${YEAR}`, description: escapeHtml(desc), keywords: escapeHtml(keywords), canonical: `${SITE}/${slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${title} ${YEAR}`, "description": desc, "url": `${SITE}/${slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Locations', url: `${SITE}/locations/` }, { name: country, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero(buildBreadcrumbs('Locations', '/locations'), escapeHtml(title), escapeHtml(desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => getCountry(c.location) === country))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
${country === 'USA' ? `
      // State index for USA
      const stateNames = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};
      const nameToAbbr = {};
      Object.entries(stateNames).forEach(([abbr, name]) => { nameToAbbr[name] = abbr; });
      const _n = new Date(); const today = _n.getFullYear() + '-' + String(_n.getMonth()+1).padStart(2,'0') + '-' + String(_n.getDate()).padStart(2,'0');
      const counts = {};
      data.calls.filter(c => c.location && c.location.endsWith('USA') && (c.deadline === 'Continuous' || c.deadline >= today)).forEach(c => {
        const parts = c.location.split(',');
        let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
        if (state && nameToAbbr[state]) state = nameToAbbr[state];
        if (state) counts[state] = (counts[state] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => {
        const nameA = (stateNames[a[0]] || a[0]).toLowerCase();
        const nameB = (stateNames[b[0]] || b[0]).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      const container = document.getElementById('callsList');
      container.className = 'index-list';
      let html = '';
      sorted.forEach(([state, count]) => {
        const fullName = stateNames[state] || state;
        html += '<a href="/united-states/' + slugify(fullName) + '/" class="index-item">' +
          '<span class="index-item-name">' + esc(fullName) + '</span>' +
          '<span class="dots"></span>' +
          '<span class="index-item-count">' + count + '</span></a>';
      });
      container.innerHTML = html;
` : `
      const calls = data.calls.filter(c => getCountryFromLocation(c.location) === '${country.replace(/'/g, "\\'")}').map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
`}
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

    slugMap[slug] = `country: ${fullName}`;
    createdCountrySlugs.push(slug);
    writeGenerated(`${slug}/index.html`, html);
    sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Country page: ${slug} (${count} calls)`);
  });

// === US State landing pages ===
const usStateNames = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};

// Build reverse lookup: full state name → abbreviation
const stateNameToAbbr = {};
Object.entries(usStateNames).forEach(([abbr, name]) => { stateNameToAbbr[name] = abbr; });

const stateCounts = {};
data.calls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
  const parts = c.location.split(',');
  let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
  // Normalize full state names to abbreviations to prevent duplicate pages
  if (state && stateNameToAbbr[state]) state = stateNameToAbbr[state];
  if (state) stateCounts[state] = (stateCounts[state] || 0) + 1;
});

Object.entries(stateCounts).forEach(([state, count]) => {
  const fullStateName = usStateNames[state] || state;
  const stateSlug = slugify(fullStateName);
  const slug = `united-states/${stateSlug}`;
  const title = `Open Calls for Artists in ${fullStateName}`;
  const desc = `Find open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullStateName}. Browse and apply today.`;
  const keywords = `open calls ${fullStateName}, call for entries ${fullStateName}, photography opportunities ${fullStateName}, art exhibitions ${fullStateName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(title)} ${YEAR}`, description: escapeHtml(desc), keywords: `${escapeHtml(keywords)}, ${YEAR}`, canonical: `${SITE}/${slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${title} ${YEAR}`, "description": desc, "url": `${SITE}/${slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Locations', url: `${SITE}/locations/` }, { name: 'United States', url: `${SITE}/united-states/` }, { name: state, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/locations/">Locations</a> / <a href="/united-states/">United States</a></nav>', escapeHtml(title), escapeHtml(desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => c.location && (c.location.includes(', ' + state + ',') || c.location.includes(', ' + state + ', USA'))))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.location && (c.location.includes(', ${state},') || c.location.includes(', ${state}, USA'))).map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

  slugMap[slug] = `state: ${fullStateName}`;
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  State page: ${slug} (${count} calls)`);
});

// === Org landing pages ===
Object.entries(orgCounts)
  .forEach(([org, count]) => {
    const orgSlug = slugify(org);
    const slug = orgSlug;
    const title = `${org} - Open Calls`;
    const desc = `Open calls and submission opportunities from ${org}. Browse exhibitions, grants, residencies, and more for photographers and visual artists.`;
    const keywords = `${org} open call, ${org} call for entries, ${org} submissions, ${org} photography, ${org} exhibition, ${org} artists`;

    // Check for slug collision with reserved system pages or call/country pages
    if (RESERVED.includes(slug)) {
      console.error(`  ERROR: Org page "${slug}" collides with reserved system page. Rename the org.`);
      hasErrors = true;
      return;
    }
    if (slugMap[slug]) {
      console.error(`  ERROR: Org page "${slug}" collides with call "${slugMap[slug]}". Rename the call title (e.g. add year).`);
      hasErrors = true;
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: escapeHtml(title), description: escapeHtml(desc), keywords: escapeHtml(keywords), canonical: `${SITE}/${slug}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `${org} - Open Calls`, "description": desc, "url": `${SITE}/${slug}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Organizations', url: `${SITE}/organizations/` }, { name: org, url: `${SITE}/${slug}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero(buildBreadcrumbs('Organizations', '/organizations'), escapeHtml(org), escapeHtml(desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => c.org === org))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.org === '${org.replace(/'/g, "\\'")}').map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

    slugMap[slug] = `org: ${org}`;
    createdOrgSlugs.push(slug);
    writeGenerated(`${slug}/index.html`, html);
    sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Org page: ${slug} (${count} calls)`);
  });

if (hasErrors) { console.error('\nFix errors above before generating.'); process.exit(1); }

// === Deadline month pages ===
const MONTH_NAMES = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MONTH_LABELS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Group all non-Continuous calls by month
const monthGroups = {};
data.calls.filter(c => c.deadline !== 'Continuous').forEach(c => {
  const d = new Date(c.deadline + 'T00:00:00');
  const key = `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
  if (!monthGroups[key]) monthGroups[key] = { month: d.getMonth(), year: d.getFullYear(), calls: [] };
  monthGroups[key].calls.push(c);
});

// Sort months chronologically
const sortedMonths = Object.keys(monthGroups).sort((a, b) => {
  const ga = monthGroups[a], gb = monthGroups[b];
  return (ga.year - gb.year) || (ga.month - gb.month);
});

sortedMonths.forEach(key => {
  const g = monthGroups[key];
  const label = `${MONTH_LABELS[g.month]} ${g.year}`;
  const count = g.calls.length;
  const openCount = g.calls.filter(isOpen).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls — ${label}`, description: `${count} open calls for artists with deadlines in ${label}. Photography competitions, exhibitions, grants, and residencies.`, keywords: `open calls ${label.toLowerCase()}, photography deadlines ${label.toLowerCase()}, call for entries ${label.toLowerCase()}`, canonical: `${SITE}/deadlines/${key}`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `Open Calls — ${label}`, "description": `Open calls with deadlines in ${label}.`, "url": `${SITE}/deadlines/${key}/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), breadcrumbs: [{ name: 'Deadlines', url: `${SITE}/deadlines/` }, { name: label, url: `${SITE}/deadlines/${key}/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/deadlines/">Deadlines</a></nav>', label, `${count} call${count !== 1 ? 's' : ''} with deadlines in ${label}${openCount > 0 && openCount < count ? ` — ${openCount} still open` : openCount === 0 ? ' — all closed' : ''}.`)}

    <section class="calls-list" id="callsList">
${buildStaticCallList(g.calls)}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.deadline !== 'Continuous' && c.deadline.startsWith('${g.year}-${String(g.month + 1).padStart(2, '0')}')).map(processCall);
      calls.sort((a, b) => a.deadlineDate - b.deadlineDate);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'), { skipSections: true });
    } catch (e) {}
    }
    loadFiltered();
  </script>

</body>
</html>`;

  writeGenerated(`deadlines/${key}/index.html`, html);
  sitemapEntries.push(`${SITE}/deadlines/${key}`);
  console.log(`  Deadline page: ${label} (${count} calls)`);
});

// === Deadlines index page ===
const currentMonth = new Date().getMonth();
const currentYear = new Date().getFullYear();

const currentMonths = sortedMonths.filter(k => monthGroups[k].month === currentMonth && monthGroups[k].year === currentYear);
const futureMonths = sortedMonths.filter(k => {
  const g = monthGroups[k];
  return (g.year > currentYear) || (g.year === currentYear && g.month > currentMonth);
});
const pastMonths = sortedMonths.filter(k => {
  const g = monthGroups[k];
  return (g.year < currentYear) || (g.year === currentYear && g.month < currentMonth);
}).reverse();

function deadlineItem(key, sectionLabel) {
  const g = monthGroups[key];
  const label = `${MONTH_LABELS[g.month]} ${g.year}`;
  const openCount = g.calls.filter(isOpen).length;
  return `      <a href="/deadlines/${key}/" class="index-item">
        <span class="index-item-name">${label}</span>
        <span class="dots"></span>
        <span class="index-item-count">${openCount > 0 ? openCount : g.calls.length}</span>
      </a>`;
}

const deadlinesIndexItems = [
  ...currentMonths.map(k => deadlineItem(k)),
  ...(futureMonths.length ? [`      <h3 class="section-header">Upcoming</h3>`] : []),
  ...futureMonths.map(k => deadlineItem(k)),
  ...(pastMonths.length ? [`      <h3 class="section-header">Past</h3>`] : []),
  ...pastMonths.map(k => deadlineItem(k))
].join('\n');

const deadlinesIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Deadline ${YEAR}`, description: 'Browse open calls by deadline month. Find photography competitions, exhibitions, grants, and residencies organized by submission deadline.', keywords: `open calls by deadline, photography deadlines, call for entries by month, submission deadlines ${YEAR}`, canonical: `${SITE}/deadlines`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `Open Calls by Deadline ${YEAR}`, "description": "Browse open calls by deadline month.", "url": `${SITE}/deadlines/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Deadlines', 'Browse open calls by deadline month — upcoming and past.')}

    <section class="index-list" id="indexList">
${deadlinesIndexItems}
    </section>

    <p class="browse-more"><a href="/browse/">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

writeGenerated('deadlines/index.html', deadlinesIndexHtml);
sitemapEntries.push(`${SITE}/deadlines`);
console.log(`  Deadlines index page (${sortedMonths.length} months)`);

// === Submit page ===
const submitHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: 'Submit an Open Call', description: 'Know an open call we should list? Submit it here. We review every suggestion.', keywords: 'submit open call, suggest call for entries, photography open call submission', canonical: `${SITE}/submit`, cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Submit a call', 'Paste a link — add details if you have them.')}

    <section class="submit-form">
      <form id="submitForm">
        <h3 class="section-header">Where to apply</h3>
        <input class="search-bar" type="text" name="url" id="url" placeholder="https://" required>

        <label for="category">Category</label>
        <select class="search-bar" name="category" id="category" required>
          <option value="">Choose category</option>
          <option value="photography">Photography</option>
          <option value="exhibition">Exhibition</option>
          <option value="grant">Grant</option>
          <option value="residency">Residency</option>
          <option value="zine">Zine / Book</option>
          <option value="education">Education</option>
        </select>

        <details class="submit-details">
          <summary>Add details</summary>

          <label for="deadline">Deadline</label>
          <input class="search-bar" type="text" name="deadline" id="deadline" placeholder="April 15, 2026">

          <label for="fee">Entry fee</label>
          <input class="search-bar" type="text" name="fee" id="fee" placeholder="Free, $25, €10">

          <label for="prize">Prize</label>
          <input class="search-bar" type="text" name="prize" id="prize" placeholder="$5,000, Exhibition, Publication">

          <label for="location">Location</label>
          <input class="search-bar" type="text" name="location" id="location" placeholder="Berlin, Germany or Online">

          <label for="eligibility">Eligibility</label>
          <input class="search-bar" type="text" name="eligibility" id="eligibility" placeholder="International, 18+">

          <label for="org">Organization</label>
          <input class="search-bar" type="text" name="org" id="org" placeholder="Organization name">

          <label for="instagram">Instagram</label>
          <input class="search-bar" type="text" name="instagram" id="instagram" placeholder="@handle">

          <label for="description">Description <span class="char-count" id="charCount">0 / 250</span></label>
          <textarea class="search-bar" name="description" id="description" rows="5" maxlength="250" oninput="document.getElementById('charCount').textContent=this.value.length+' / 250'"></textarea>

        </details>

        <button type="submit" class="call-detail-btn call-detail-apply" id="submitBtn">Submit</button>
      </form>
      <div id="submitThanks" style="display:none">
        <a href="/submit/" class="call-detail-btn call-detail-apply" onclick="location.reload();return false;">Submit another</a>
      </div>
      <script>
        document.getElementById('submitForm').addEventListener('submit', function(e) {
          e.preventDefault();
          var btn = document.getElementById('submitBtn');
          btn.textContent = 'Submitting...';
          btn.style.opacity = '0.5';
          fetch('https://formspree.io/f/xkoqaveq', {
            method: 'POST',
            body: new FormData(this),
            headers: { 'Accept': 'application/json' }
          }).then(function(r) {
            if (r.ok) {
              document.getElementById('submitForm').style.display = 'none';
              document.getElementById('submitThanks').style.display = '';
              document.querySelector('.hero h1').textContent = 'Thanks for submitting';
              document.querySelector('.hero .subtitle').textContent = "I'll take a look and add it if it fits.";
            } else {
              btn.textContent = 'Something went wrong, try again';
              btn.style.opacity = '1';
            }
          }).catch(function() {
            btn.textContent = 'Something went wrong, try again';
            btn.style.opacity = '1';
          });
        });
      </script>
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

writeGenerated('submit/index.html', submitHtml);
sitemapEntries.push(`${SITE}/submit`);
console.log('  Submit page');

// === Browse directory page (auto-generated hub linking all sections) ===
function midTruncateHtml(str, minLen) {
  minLen = minLen || 25;
  if (!str || str.length <= minLen) return escapeHtml(str);
  const words = str.split(' ');
  if (words.length <= 2) return escapeHtml(str);
  const splitAt = Math.ceil(words.length * 0.6);
  const front = words.slice(0, splitAt).join(' ');
  const back = words.slice(splitAt).join(' ');
  return `<span class="tag-front">${escapeHtml(front)}</span><span class="tag-back">${escapeHtml(back)}</span>`;
}

function buildBrowseSection(heading, items, headingLink) {
  if (!items.length) return '';
  const headingHtml = headingLink ? `<a href="${headingLink}">${escapeHtml(heading)}</a>` : escapeHtml(heading);
  let html = `<h3 class="section-header">${headingHtml}</h3>\n`;
  // Show items with open calls first, then items with 0 open (so Google can discover all pages)
  const sorted = [...items].sort((a, b) => b.count - a.count);
  sorted.forEach(({ label, href, count }) => {
    html += `      <a href="${href}" class="index-item">
        <span class="index-item-name">${midTruncateHtml(label)}</span>
        <span class="dots"></span>
        <span class="index-item-count">${count}</span>
      </a>\n`;
  });
  return html;
}

const browseCategoryLabels = {
  'photography': 'Photography', 'exhibition': 'Exhibitions', 'grant': 'Grants',
  'residency': 'Residencies', 'zine': 'Zines & Books', 'education': 'Education'
};
const browseCategories = Object.entries(categories).map(([cat]) => {
  const catSlug = cat === 'zine' ? 'zines' : cat === 'exhibition' ? 'exhibitions' : cat === 'residency' ? 'residencies' : cat === 'grant' ? 'grants' : cat;
  return { label: browseCategoryLabels[cat] || cat, href: `/${catSlug}/`, count: openCalls.filter(c => c.category === cat).length };
}).sort((a, b) => b.count - a.count);

const browseFees = [
  { label: 'Free to Enter', href: '/fees/free/', count: openCalls.filter(feeFilters['free']).length },
  { label: 'Entry Fee', href: '/fees/entry-fee/', count: openCalls.filter(feeFilters['entry-fee']).length }
];
const browsePrizes = [];
prizeOrder.filter(t => prizeCatTags[t]).forEach(tag => {
  browsePrizes.push({ label: prizeGroups[tag].short, href: `/prize/${tag}/`, count: openPrizeCatTags[tag] || 0 });
});

const openCountryCounts = {};
openCalls.forEach(c => { const country = getCountry(c.location); if (country) openCountryCounts[country] = (openCountryCounts[country] || 0) + 1; });
const browseCountries = Object.entries(countryCounts)
  .map(([country]) => {
    const countrySlug = countrySlugs[country] || slugify(country);
    const label = countryNames[country] ? countryNames[country].replace(/^the /, '') : country;
    return { label, href: `/${countrySlug}/`, count: openCountryCounts[country] || 0 };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const openStateCounts = {};
openCalls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
  const parts = c.location.split(',');
  let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
  if (state && stateNameToAbbr[state]) state = stateNameToAbbr[state];
  if (state) openStateCounts[state] = (openStateCounts[state] || 0) + 1;
});
const browseStates = Object.entries(stateCounts)
  .sort((a, b) => {
    const nameA = (usStateNames[a[0]] || a[0]).toLowerCase();
    const nameB = (usStateNames[b[0]] || b[0]).toLowerCase();
    return nameA.localeCompare(nameB);
  })
  .map(([state]) => {
    const fullName = usStateNames[state] || state;
    return { label: fullName, href: `/united-states/${slugify(fullName)}/`, count: openStateCounts[state] || 0 };
  });

const browseEligibility = [];
eligibilityOrder.forEach(group => {
  group.tags.filter(t => eligibilityTags[t]).forEach(tag => {
    const info = eligibilityGroups[tag];
    browseEligibility.push({ label: info.short, href: `/eligibility/${tag}/`, count: openEligibilityTags[tag] || 0 });
  });
});
browseEligibility.sort((a, b) => b.count - a.count);

const openOrgCounts = {};
openCalls.forEach(c => { openOrgCounts[c.org] = (openOrgCounts[c.org] || 0) + 1; });
const browseOrgs = Object.entries(orgCounts)
  .filter(([org]) => createdOrgSlugs.includes(slugify(org)))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([org]) => ({ label: org, href: `/${slugify(org)}/`, count: openOrgCounts[org] || 0 }));

const browseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Browse All Open Calls ${YEAR}`, description: 'Browse open calls for photographers and visual artists by category, location, eligibility, and organization. Find exhibitions, grants, residencies, and competitions worldwide.', keywords: `open calls for artists, photography open calls, call for entries, art exhibitions, photography grants, artist residency, browse open calls ${YEAR}`, canonical: `${SITE}/browse`, jsonLd: JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": `Browse All Open Calls ${YEAR}`, "description": "Browse open calls for photographers and visual artists by category, location, eligibility, and organization.", "url": `${SITE}/browse/`, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2), cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Browse All Open Calls', 'Explore open calls by category, location, eligibility, and organization.')}

    <section class="index-list">
${buildBrowseSection('Categories', browseCategories, '/categories/')}
${buildBrowseSection('Fees', browseFees, '/fees/')}
${buildBrowseSection('Prizes', browsePrizes, '/prize/')}
${buildBrowseSection('Locations', browseCountries, '/locations/')}
${buildBrowseSection('US States', browseStates, '/united-states/')}
${buildBrowseSection('Eligibility', browseEligibility, '/eligibility/')}
${buildBrowseSection('Deadlines', sortedMonths.filter(k => monthGroups[k].calls.some(isOpen)).map(k => { const g = monthGroups[k]; return { label: `${MONTH_LABELS[g.month]} ${g.year}`, href: `/deadlines/${k}/`, count: g.calls.filter(isOpen).length }; }), '/deadlines/')}
${buildBrowseSection('Organizations', browseOrgs, '/organizations/')}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

writeGenerated('browse/index.html', browseHtml);
sitemapEntries.push(`${SITE}/browse`);
console.log(`  Browse directory page`);

// Add index pages to sitemap
sitemapEntries.push(`${SITE}/categories`);
sitemapEntries.push(`${SITE}/locations`);
sitemapEntries.push(`${SITE}/organizations`);

// Build state pages map for cards.js
const statePageMap = {};
Object.keys(stateCounts).forEach(state => {
  const fullName = usStateNames[state] || state;
  statePageMap[state] = 'united-states/' + slugify(fullName);
});

// Update page lists in cards.js (between markers) — only include actually created pages
const pageListsBlock = `// ==AUTO-GENERATED-START== (do not edit manually)
const countryPages = ${JSON.stringify(createdCountrySlugs)};
const orgPages = ${JSON.stringify(createdOrgSlugs)};
const statePages = ${JSON.stringify(statePageMap)};
// ==AUTO-GENERATED-END==`;
let cardsJs = fs.readFileSync('cards.js', 'utf8');
cardsJs = cardsJs.replace(
  /\/\/ ==AUTO-GENERATED-START==[\s\S]*?\/\/ ==AUTO-GENERATED-END==/,
  pageListsBlock
);
fs.writeFileSync('cards.js', cardsJs);

// Generate sitemap.xml
const today = new Date().toISOString().split('T')[0];
const allUrls = [`${SITE}/`, ...sitemapEntries.map(u => u.endsWith('/') ? u : u + '/')];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemapXml);

// Generate RSS feed
const now = new Date();
const rssCalls = openCalls
  .slice()
  .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
  .slice(0, 50);

const rssItems = rssCalls.map(call => {
  const slug = call.slug || slugify(call.title);
  const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
    new Date(call.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const desc = `${escapeHtml(call.description)} — Deadline: ${deadlineText}. Fee: ${escapeHtml(call.fee || 'See website')}. Prize: ${escapeHtml(call.prize || 'None listed')}.`;
  return `  <item>
    <title>${call.orgInTitle ? escapeHtml(call.title) : escapeHtml(call.title) + ' · ' + escapeHtml(call.org)}</title>
    <link>${SITE}/${slug}/</link>
    <guid>${SITE}/${slug}/</guid>
    <description>${desc}</description>
    <category>${escapeHtml(call.category)}</category>
    <pubDate>${new Date(call.dateAdded.includes('T') ? call.dateAdded : call.dateAdded + 'T00:00:00Z').toUTCString()}</pubDate>
  </item>`;
}).join('\n');

const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Open Calls for Artists — Monographica</title>
  <link>${SITE}</link>
  <description>Curated list of open calls for photographers and visual artists. Exhibitions, grants, residencies, and publications worldwide.</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
</channel>
</rss>`;

fs.writeFileSync('feed.xml', rssXml);

// Generate index pages for categories, countries, organizations
const indexPages = [
  { src: 'categories/index.html', fallback: 'categories.html' },
  { src: 'locations/index.html', fallback: 'locations.html' },
  { src: 'organizations/index.html', fallback: 'organizations.html' }
];
indexPages.forEach(({ src, fallback }) => {
  // Read from new location if exists, else from old location
  const readFrom = fs.existsSync(src) ? src : (fs.existsSync(fallback) ? fallback : null);
  if (readFrom) {
    let html = fs.readFileSync(readFrom, 'utf8');
    // Sync CSS and JS versions
    html = html.replace(/href="[^"]*style\.css\?v=[^"]+"/g, `href="/style.css?v=${cssVersion}"`);
    html = html.replace(/src="\/cards\.js\?v=[^"]+"/g, `src="/cards.js?v=${cssVersion}"`);
    html = html.replace(/src="\/search\.js\?v=[^"]+"/g, `src="/search.js?v=${cssVersion}"`);
    // favicon.ico + favicon.png links are already correct in templates
    if (!html.includes('og:site_name')) {
      html = html.replace(/<meta name="twitter:card"/, '<meta property="og:site_name" content="Monographica">\n  <meta name="twitter:card"');
    }
    html = html.replace(/og-image\.jpg/g, 'og-image.png');
    html = html.replace(/Open Calls for Artists \d{4}/g, `Open Calls for Artists ${YEAR}`);
    html = html.replace(/photography grants \d{4}/g, `photography grants ${YEAR}`);
    html = html.replace(/&copy; \d{4} HH/g, `&copy; ${YEAR} HH`);
    html = html.replace(/(<title>[^<]+?)(\s*[-\u2014\u2013]\s*Monographica)?(\s*-\s*Monographica)?<\/title>/g, (m, content) => {
      const clean = content.replace(/\s*[-\u2014\u2013]\s*Monographica$/, '');
      return `${clean}${TITLE_SUFFIX}</title>`;
    });
    html = html.replace(/(og:title"\s+content="[^"]+?)(\s*[-\u2014\u2013]\s*Monographica)?(\s*-\s*Monographica)?"/g, (m, content) => {
      const clean = content.replace(/\s*[-\u2014\u2013]\s*Monographica$/, '');
      return `${clean}${TITLE_SUFFIX}"`;
    });
    // Ensure canonical and og:url have trailing slashes
    html = html.replace(/(rel="canonical" href="[^"]*[^/])"/g, '$1/"');
    html = html.replace(/(og:url"\s+content="[^"]*[^/])"/g, '$1/"');
    html = html.replace(/<footer class="about-section"[\s\S]*?<\/footer>/, FOOTER);
    // Strip all existing global-search blocks and duplicate nav scripts before re-injecting
    html = html.replace(/\s*<div class="global-search"[\s\S]*?<\/div>\s*<\/div>/g, '');
    html = html.replace(/(\s*<script>\(function\(\)\{var p=location[\s\S]*?<\/script>)+/g, '');
    html = html.replace(/<header>[\s\S]*?<\/header>/, buildHeader());
    // Inject cards.js + search.js if not already present
    if (!html.includes('cards.js')) {
      html = html.replace('</body>', `\n  ${CARDS_SCRIPT(cssVersion)}\n\n</body>`);
    }
    const dir = path.dirname(src);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(src, html);
    generatedFiles.add(src);
  }
});

// Update manual HTML files: CSS version, year, and title suffix
const manualFiles = ['index.html', '404.html'];
manualFiles.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  // Sync CSS and JS versions
  html = html.replace(/href="[^"]*style\.css\?v=[^"]+"/g, `href="/style.css?v=${cssVersion}"`);
  html = html.replace(/src="\/cards\.js\?v=[^"]+"/g, `src="/cards.js?v=${cssVersion}"`);
  html = html.replace(/src="\/search\.js\?v=[^"]+"/g, `src="/search.js?v=${cssVersion}"`);
  // Update year everywhere (titles, keywords, footer)
  html = html.replace(/Open Calls for Artists \d{4}/g, `Open Calls for Artists ${YEAR}`);
  html = html.replace(/photography grants \d{4}/g, `photography grants ${YEAR}`);
  html = html.replace(/&copy; \d{4} HH/g, `&copy; ${YEAR} HH`);
  // Ensure title suffix — remove any existing then re-add (handle both hyphen and em dash)
  html = html.replace(/(<title>[^<]+?)(\s*[-\u2014\u2013]\s*Monographica)?(\s*-\s*Monographica)?<\/title>/g, (m, content) => {
    const clean = content.replace(/\s*[-\u2014\u2013]\s*Monographica$/, '');
    return `${clean}${TITLE_SUFFIX}</title>`;
  });
  html = html.replace(/(og:title"\s+content="[^"]+?)(\s*[-\u2014\u2013]\s*Monographica)?(\s*-\s*Monographica)?"/g, (m, content) => {
    const clean = content.replace(/\s*[-\u2014\u2013]\s*Monographica$/, '');
    return `${clean}${TITLE_SUFFIX}"`;
  });
  // Update header (skip index.html which has its own nav with data-view attributes)
  if (file !== 'index.html') {
    html = html.replace(/<header>[\s\S]*?<\/header>(\s*<div class="global-search"[\s\S]*?<\/div>\s*<script>\(function\(\)\{var p=location[\s\S]*?<\/script>)*/, HEADER);
  }
  // Update footer
  html = html.replace(/<footer class="about-section"[\s\S]*?<\/footer>/, FOOTER);
  // Inject cards.js + search.js for 404 (skip index.html which has its own)
  if (file !== 'index.html' && !html.includes('cards.js')) {
    html = html.replace('</body>', `\n  ${CARDS_SCRIPT(cssVersion)}\n\n</body>`);
  }
  fs.writeFileSync(file, html);
});

// === Inject static content into manual hub pages (SEO: Google must see content without JS) ===

// 1. HOME PAGE — inject full call list
{
  let html = fs.readFileSync('index.html', 'utf8');
  const staticCalls = buildStaticCallList(openCalls);
  html = html.replace(
    /<!-- STATIC-CALLS-START -->[\s\S]*?<!-- STATIC-CALLS-END -->/,
    `<!-- STATIC-CALLS-START -->\n${staticCalls}      <!-- STATIC-CALLS-END -->`
  );
  fs.writeFileSync('index.html', html);
  console.log(`  Home page: injected ${openCalls.length} static call cards`);
}

// 2. CATEGORIES INDEX — inject category links with open-call counts
{
  const catSlugs = { photography: 'photography', exhibition: 'exhibitions', grant: 'grants', zine: 'zines', residency: 'residencies', education: 'education' };
  const catLabels = { photography: 'Photography', exhibition: 'Exhibitions', grant: 'Grants', zine: 'Zines & Books', residency: 'Residencies', education: 'Education' };
  let items = '';
  Object.entries(catSlugs).forEach(([cat, slug]) => {
    const count = openCalls.filter(c => c.category === cat).length;
    items += `      <a href="/${slug}/" class="index-item"><span class="index-item-name">${catLabels[cat]}</span><span class="dots"></span><span class="index-item-count">${count}</span></a>\n`;
  });
  let html = fs.readFileSync('categories/index.html', 'utf8');
  html = html.replace(
    /<!-- STATIC-INDEX-START -->[\s\S]*?<!-- STATIC-INDEX-END -->/,
    `<!-- STATIC-INDEX-START -->\n${items}      <!-- STATIC-INDEX-END -->`
  );
  fs.writeFileSync('categories/index.html', html);
  console.log(`  Categories page: injected 6 category links`);
}

// 3. LOCATIONS INDEX — inject country links with open-call counts
{
  const countryCountsOpen = {};
  const countrySlugMap = { 'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates' };
  const countryDisplayNames = { 'USA': 'United States', 'UK': 'United Kingdom', 'UAE': 'United Arab Emirates' };
  openCalls.forEach(c => {
    const country = getCountry(c.location);
    if (country) countryCountsOpen[country] = (countryCountsOpen[country] || 0) + 1;
  });
  const sorted = Object.entries(countryCountsOpen).sort((a, b) => b[1] - a[1]);
  let items = '';
  sorted.forEach(([country, count]) => {
    const slug = countrySlugMap[country] || slugify(country);
    const display = countryDisplayNames[country] || country;
    items += `      <a href="/${slug}/" class="index-item"><span class="index-item-name">${escapeHtml(display)}</span><span class="dots"></span><span class="index-item-count">${count}</span></a>\n`;
  });
  let html = fs.readFileSync('locations/index.html', 'utf8');
  html = html.replace(
    /<!-- STATIC-INDEX-START -->[\s\S]*?<!-- STATIC-INDEX-END -->/,
    `<!-- STATIC-INDEX-START -->\n${items}      <!-- STATIC-INDEX-END -->`
  );
  fs.writeFileSync('locations/index.html', html);
  console.log(`  Locations page: injected ${sorted.length} country links`);
}

// 4. ORGANIZATIONS INDEX — inject org links with total call counts
{
  const orgCountsAll = {};
  data.calls.forEach(c => { orgCountsAll[c.org] = (orgCountsAll[c.org] || 0) + 1; });
  const sorted = Object.entries(orgCountsAll).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let items = '';
  sorted.forEach(([org, count]) => {
    const slug = slugify(org);
    items += `      <a href="/${slug}/" class="index-item"><span class="index-item-name">${escapeHtml(org)}</span><span class="dots"></span><span class="index-item-count">${count}</span></a>\n`;
  });
  let html = fs.readFileSync('organizations/index.html', 'utf8');
  html = html.replace(
    /<!-- STATIC-INDEX-START -->[\s\S]*?<!-- STATIC-INDEX-END -->/,
    `<!-- STATIC-INDEX-START -->\n${items}      <!-- STATIC-INDEX-END -->`
  );
  fs.writeFileSync('organizations/index.html', html);
  console.log(`  Organizations page: injected ${sorted.length} org links`);
}

// Warn about stale HTML files (never auto-delete — pages may be indexed/bookmarked)
// Fix noindex on stale pages — Google flags these as "Excluded by noindex tag"
const staleFiles = [];
function findStale(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(item => {
    if (item.startsWith('.')) return;
    const fp = path.join(dir, item);
    if (fs.statSync(fp).isDirectory()) {
      findStale(fp);
    } else if (fp.endsWith('.html') && !generatedFiles.has(fp) && !MANUAL_FILES.includes(fp)) {
      staleFiles.push(fp);
    }
  });
}
findStale('.');
let fixedMeta = 0;
staleFiles.forEach(f => {
  let html = fs.readFileSync(f, 'utf8');
  let changed = false;

  // Ensure stale pages have noindex. Replace any existing robots tag to avoid duplicates.
  if (html.includes('<meta name="robots" content="noindex">')) {
    // Already has noindex — but might also have a conflicting "index, follow" tag
    if (html.includes('<meta name="robots" content="index, follow">')) {
      html = html.replace(/\s*<meta name="robots" content="index, follow">/g, '');
      changed = true;
    }
  } else {
    // Replace existing "index, follow" with noindex, or insert noindex if neither exists
    if (html.includes('<meta name="robots" content="index, follow">')) {
      html = html.replace('<meta name="robots" content="index, follow">', '<meta name="robots" content="noindex">');
    } else {
      html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <meta name="robots" content="noindex">');
    }
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(f, html);
    fixedMeta++;
  }
});
if (fixedMeta > 0) {
  console.log(`  Fixed meta robots on ${fixedMeta} stale page(s)`);
}
if (staleFiles.length) {
  console.warn(`\n⚠️  ${staleFiles.length} HTML file(s) not generated this run (NOT deleted — review manually):`);
  staleFiles.forEach(f => console.warn(`   ${f}`));
  console.warn('');
}

console.log(`Generated ${generated} pages, skipped ${skipped}, sitemap has ${allUrls.length} URLs`);
