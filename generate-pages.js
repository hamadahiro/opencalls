const fs = require('fs');
const path = require('path');

// Single source of truth for pure logic + data maps shared with the browser
// (cards.js). Defined once in shared.js; never re-declare these here.
const shared = require('./shared.js');
const {
  categoryLabel, categorySlug, prizeCategoryLabel, shortCountry, countrySlugs, eligibilityLabel,
  usStateNames, stateNameToAbbr,
  PIN_SVG, PRIZE_SVG,
  isCallOpen, computeUrgency, slugify, shortenLocation, splitPrizeParts, derivePrizeCategory, derivePrizeCategories,
  deriveRequirementBucket, shortenFee, feeChip, submitViaLink, submitViaLabel,
  getCountry, tagHtml, renderTags, renderInfoGrid, buildPrizeBlock,
  isFree, getState, scoreSimilarity,
  isValidEmail, isValidHttpUrl, submitViaIsPlatform
} = shared;

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));

// Organizer emails are kept OUT of the public data.json (it's served as a
// downloadable file). They live in the PRIVATE, gitignored contacts store.
// Hydrate call.email here in memory so the on-page "Submit via" mailto: links
// still render for submit-by-email calls. If the store is absent (e.g. a fresh
// public checkout), mailto simply falls back to the call's website — no crash.
try {
  const contacts = JSON.parse(fs.readFileSync('scripts/outreach/contacts.json', 'utf8'));
  let hydrated = 0;
  for (const c of data.calls) {
    if (!c.email && c.slug && contacts[c.slug] && contacts[c.slug].email) {
      c.email = contacts[c.slug].email;
      hydrated++;
    }
  }
  console.log(`  Hydrated ${hydrated} email(s) from private contacts store (for mailto links)`);
} catch (e) {
  console.warn('  contacts.json not found — mailto links will fall back to website');
}

// Per-call verification timestamps written by scripts/verify-batch.js.
// Used to render "Verified by Monographica on [date]" on every detail page
// and to set JSON-LD dateModified — real evidence of human curation, not
// filler. Missing file is non-fatal (some envs may not have run verify yet).
let verifyState = { entries: {} };
try {
  verifyState = JSON.parse(fs.readFileSync('scripts/verify-state.json', 'utf8'));
} catch (e) {
  console.warn('  verify-state.json not found — skipping verification timestamps');
}
function getVerifiedAt(slug) {
  const entry = verifyState.entries && verifyState.entries[slug];
  return entry ? entry.at : null;
}
// Linkify the FIRST mention of the org name in a block of prose. Subsequent
// mentions stay as plain text — this avoids the over-linking pattern Google
// flags as low-quality. Instagram handles are NOT linked here (see step 2).
// State tracking is per-call (the linkifyState object) so the first mention
// across the WHOLE prose array gets linked, not the first mention per paragraph.
// During the product-reset index test PRECOMPUTED_ORG_PAGES is left empty, so
// org pages stay available from the explicit "Organized by" line without extra
// prose links from every generated detail page.
function makeLinkifyState() {
  return { orgLinked: false, handlesLinked: {} };
}
function linkifyProse(paragraph, call, state) {
  // Escape first, then inject anchor tags — safer than parsing HTML.
  let html = escapeHtml(paragraph);
  // 1. First mention of org name — link to org page if it exists in PRECOMPUTED.
  if (!state.orgLinked && call.org) {
    const orgEsc = escapeHtml(call.org);
    const orgSlug = slugify(call.org);
    // Use \b-style boundary via lookarounds so "Carlotta Gallery" matches inside
    // "Carlotta Gallery's" without consuming the apostrophe-s.
    const re = new RegExp('(^|[^a-z0-9])(' + orgEsc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![a-z0-9])', 'i');
    if (re.test(html) && PRECOMPUTED_ORG_PAGES.has(orgSlug)) {
      html = html.replace(re, '$1<a href="/' + orgSlug + '/">$2</a>');
      state.orgLinked = true;
    }
  }
  // 2. Instagram handles are intentionally NOT linked in prose. The organizer's
  // Instagram now lives on the org landing page (a deliberate UI element), not on
  // call detail pages, so any @handle mentioned in description text stays plain.
  return html;
}

function formatVerifiedDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  // Swap the comma-space between day and year for a comma + NON-BREAKING SPACE
  // so "May 23, 2026" never wraps with the year alone on narrow viewports.
  // NOTE: the replacement uses the explicit escape \u00a0 (NBSP), NOT a literal
  // space. Do NOT "simplify" it to a regular space ", " -- that turns it into a
  // real dead no-op. It only LOOKS like a no-op because NBSP renders like space.
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).replace(/, /, ',\u00a0');
}

// Validate data before generating
const COUNTRY_ALIASES = { 'UK': 'United Kingdom', 'UAE': 'United Arab Emirates', 'US': 'United States', 'United States': 'USA' };
const VALID_CATEGORIES = ['photography', 'exhibition', 'grant', 'zine', 'residency', 'education'];
let hasErrors = false;

function err(msg) { console.error(`ERROR: ${msg}`); hasErrors = true; }

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
  } else if (c.deadline && c.deadline !== 'Continuous') {
    // Format is fine, but the regex still passes calendar-impossible dates.
    // "2026-13-01"/"2026-00-10" parse to Invalid Date (renders "Invalid Date"
    // on the page); "2026-02-31" silently rolls forward to Mar 3 (wrong deadline,
    // wrong month bucket, wrong sitemap/RSS). Round-trip the parse to catch both.
    const d = new Date(c.deadline + 'T00:00:00');
    const roundTrip = isNaN(d) ? '' :
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (roundTrip !== c.deadline) {
      err(`"${label}" has a non-existent calendar date: "${c.deadline}" — check the month (01–12) and day`);
    }
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
    // US locations MUST include a state: "City, ST, USA". A 2-part "City, USA"
    // renders a chip labeled with the city but links to the country page (the
    // US-states list), not the city's state — confusing, since there are no
    // per-city pages. Force the state so the chip resolves to a state page.
    if (country === 'USA') {
      if (parts.length < 3) {
        err(`"${label}" has US location "${loc}" missing a state — must be "City, ST, USA" (e.g. "Chicago, IL, USA")`);
      } else {
        // US locations must use 2-letter state abbreviations, not full state names
        const state = parts[parts.length - 2];
        if (state.length > 2) {
          err(`"${label}" uses full state name "${state}" — must use 2-letter abbreviation (e.g. NY, CA, TX)`);
        }
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

  // Submit-via link targets must be valid, or the "Submit via" link is broken.
  // email -> mailto (must be a real address); submitUrl -> link (must be http(s)).
  if (c.email && !isValidEmail(c.email)) {
    err(`"${label}" has invalid email: "${c.email}" — would produce a broken mailto: link`);
  }
  if (c.submitUrl && !isValidHttpUrl(c.submitUrl)) {
    err(`"${label}" has invalid submitUrl: "${c.submitUrl}" — must be an http(s) URL`);
  }
  // For OPEN calls, if submitVia names a SaaS submission platform a submitUrl is
  // mandatory — otherwise the rendered link can only fall back to email/website,
  // never the platform the label promises. (Closed calls render label-only, no
  // link, so they're exempt. Generic labels like "Official website" are exempt:
  // the renderer falls those back to the call's official url, never to mailto.)
  if (c.submitVia && !c.submitUrl && isCallOpen(c.deadline) && submitViaIsPlatform(c.submitVia)) {
    err(`"${label}" submitVia is "${c.submitVia}" (a submission platform) but has no submitUrl — add the platform URL or relabel (e.g. "Official website").`);
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
  // PRIVACY: organizer emails are hydrated onto data.calls in memory (above) for
  // mailto links, but must NEVER be persisted to the PUBLIC data.json. The
  // replacer strips every `email` key from the serialized output WITHOUT mutating
  // the in-memory objects, so later page rendering still has the address. This is
  // the on-disk guarantee; the pre-commit harvester is now just a backstop.
  fs.writeFileSync('data.json', JSON.stringify(data, (k, v) => k === 'email' ? undefined : v, 2) + '\n');
  console.log(`  Auto-filled dateAdded="${dateAddedToday}" on ${dateAddedCount} entries`);
}

const SITE = 'https://opencalls.monographica.com';
const YEAR = new Date().getFullYear();
const TITLE_SUFFIX = ' - Monographica';
const RESERVED = ['index', 'style', 'data', 'favicon', 'apple-touch-icon', 'og-image', 'bg', 'call-detail', 'cards', 'generate-pages', 'sitemap', 'CNAME', 'robots', '404', 'photography', 'exhibitions', 'grants', 'residencies', 'zines', 'education', 'categories', 'locations', 'organizations', 'free', 'paid', 'fees', 'prize', 'united-states', 'eligibility', 'browse', 'deadlines', 'submit', 'submit-via', 'about', 'entry-fee', 'requirements'];
const MANUAL_FILES = ['index.html', '404.html'];
const _now = new Date();
const TODAY = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0') + '-' + String(_now.getDate()).padStart(2, '0');
const openCalls = data.calls.filter(c => c.deadline === 'Continuous' || c.deadline >= TODAY);
function isOpen(c) { return c.deadline === 'Continuous' || c.deadline >= TODAY; }

// Product-reset index policy: keep user browsing pages live, but only ask
// Google to index strong, current pages instead of every generated facet.
const INDEX_POLICY = {
  minCategoryOpenCalls: 5,
  minCountryOpenCalls: 5,
  minStateOpenCalls: 5
};
function robotsFor(indexable) {
  return indexable ? 'index, follow' : 'noindex, follow';
}
function shouldIndexCategoryPage(openCount) {
  return openCount >= INDEX_POLICY.minCategoryOpenCalls;
}
function shouldIndexCountryPage(country, openCount) {
  return !!country && openCount >= INDEX_POLICY.minCountryOpenCalls;
}
function shouldIndexStatePage(openCount) {
  return openCount >= INDEX_POLICY.minStateOpenCalls;
}
function shouldIndexFeePage(slug, openCount) {
  return slug === 'fees/free' && openCount >= INDEX_POLICY.minCategoryOpenCalls;
}
function setRobotsMeta(html, directive) {
  if (/<meta name="robots" content="[^"]*">/.test(html)) {
    return html.replace(/<meta name="robots" content="[^"]*">/, `<meta name="robots" content="${directive}">`);
  }
  return html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  <meta name="robots" content="${directive}">`);
}

// Shared head snippets — change once, applies everywhere
const THEME_LIGHT = '#f5f2ed';
const THEME_DARK = '#151515';
const GA_SNIPPET = `<script defer src="/analytics.js"></script>`;
const PRELOAD = `<link rel="preload" href="/data.json" as="fetch" crossorigin>
  <link rel="alternate" type="application/rss+xml" title="Open Calls for Artists — Monographica" href="/feed.xml">`;
const ICONS = `<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">`;
const FONTS = `<link rel="preload" href="/fonts/source-serif-4-latin.woff2" as="font" type="font/woff2" crossorigin>`;
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
  // Order matters for first paint: charset first, then the render-blocking
  // stylesheet as early as possible so the CSSOM is ready before the browser
  // paints. Scripts (GA) come LAST and are deferred — a blocking script ahead
  // of the stylesheet causes a flash of unstyled content.
  return `<meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
  ${FONTS}
  <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="${THEME_DARK}" media="(prefers-color-scheme: dark)">
  <title>${opts.title}${TITLE_SUFFIX}</title>
  <meta name="description" content="${opts.description}">
  <link rel="canonical" href="${canonical}">
  ${ICONS}
  <meta property="og:title" content="${opts.title}${TITLE_SUFFIX}">
  <meta property="og:description" content="${opts.description}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${canonical}">
  <meta property="og:type" content="${opts.ogType || 'website'}">
  <meta property="og:site_name" content="Monographica">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="${opts.robots || 'index, follow'}">
  ${jsonLdHtml}
  ${PRELOAD}
  ${GA_SNIPPET}`;
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
    <input type="text" class="search-bar" id="globalSearchInput" placeholder="Search calls and opportunities&hellip;" aria-label="Search open calls" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
    <button class="search-clear" id="globalSearchClear" type="button" aria-label="Clear search">&times;</button>
    <div id="globalSearchDropdown" class="global-search-dropdown search-dropdown"></div>
  </div>
  <script>(function(){var p=location.pathname,s=location.search,n=p==='/'&&s.indexOf('view=past')!==-1?'closed':p==='/'?'open':p==='/browse/'||p==='/browse'?'browse':p==='/submit/'||p==='/submit'?'submit':'';document.querySelectorAll('[data-nav]').forEach(function(a){a.classList.toggle('active',a.getAttribute('data-nav')===n)});})()</script>`;
}
const HEADER = buildHeader();

const FOOTER = `<footer class="about-section" id="footer">
      <p class="disclaimer">Information is provided for convenience. Details may change. Always verify them on the official call website.</p>
      <p>&copy; ${YEAR} <a href="https://monographica.com">Monographica</a> &mdash; <a href="/about/">About</a> &mdash; <a href="/feed.xml">RSS</a></p>
    </footer>`;
function CARDS_SCRIPT(cssVersion) { return `<script src="/shared.js?v=${cssVersion}"></script>\n  <script src="/cards.js?v=${cssVersion}"></script>\n  <script src="/search.js?v=${cssVersion}"></script>`; }

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

// CollectionPage JSON-LD for the listing/landing pages (category, fees, eligibility,
// prize, requirements, submit-via, locations, deadlines, browse, org). Same shape
// everywhere — only name/description/url differ.
function collectionPageLd(name, description, url) {
  return JSON.stringify({ "@context": "https://schema.org", "@type": "CollectionPage", "name": name, "description": description, "url": url, "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" } }, null, 2);
}

// Client-side hydration for a listing page: fetch data.json, filter to this
// facet's calls, and re-render the list. filterExpr is the arrow passed to
// Array.filter (e.g. `c => c.category === 'photography' && isCallOpen(...)`).
// Used by the simple facet pages (category/fees/eligibility/requirements/
// submit-via/locations/state). Pages that need extra steps (prize's comment,
// country's USA state index, deadlines' sort) keep their own inline script.
function facetListScript(filterExpr) {
  return `<script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(${filterExpr}).map(processCall);
      document.getElementById('callsList').innerHTML = '';
      renderCallList(calls, document.getElementById('callsList'));
    } catch (e) {}
    }
    loadFiltered();
  </script>`;
}

// Track generated files for cleanup at the end
const generatedFiles = new Set();
function writeGenerated(filepath, content) {
  const dir = path.dirname(filepath);
  if (dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, content);
  generatedFiles.add(filepath);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function safeJsStr(str) {
  if (!str) return '';
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\x3c').replace(/>/g, '\\x3e').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
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
  // Use the real card classes (.call-card / .call-title / .call-description) so
  // the first paint is fully styled by the design system. cards.js later swaps
  // in the interactive cards (with meta pills + sections); this keeps the
  // pre-hydration list looking like a proper card list instead of unstyled
  // default text. Mirrors renderCard() in cards.js (sans the meta-pill row).
  let html = '';
  sorted.forEach(c => {
    const slug = c.slug || slugify(c.title);
    const title = c.orgInTitle ? escapeHtml(c.title) : escapeHtml(c.title) + ' &middot; ' + escapeHtml(c.org);
    const desc = escapeHtml(c.summary || c.description);
    html += `      <div class="call-card"><h3 class="call-title"><a href="/${slug}/">${title}</a></h3><p class="call-description">${desc}</p></div>\n`;
  });
  return html;
}

// === Server-side mirror of cards.js's card + tag + section rendering ===
// The homepage ships ONE list: this produces byte-equivalent markup to what
// cards.js renderCallList() builds for the default (open) view, so the browser
// can keep the server-rendered list instead of rebuilding it on load. Keep in
// sync with renderTags()/renderCard()/renderCallList() in cards.js.
const MONTHS_CAP = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// computeUrgency() lives in shared.js (one contract for server + client).

function renderStaticCard(call, u) {
  const slug = call.slug || slugify(call.title);
  const title = escapeHtml(call.title) + (!call.orgInTitle ? ' · ' + escapeHtml(call.org) : '');
  return `      <div class="call-card">
        <h4 class="call-title"><a href="/${slug}/">${title}</a></h4>
        <div class="call-meta">${renderTags(call, { esc: escapeHtml, urgency: u, locationLink: getStaticLocationLink })}</div>
        <p class="call-description">${escapeHtml(call.summary || call.description)}</p>
      </div>\n`;
}

function buildStaticHomeList(callsList) {
  const now = new Date();
  const processed = callsList
    .filter(c => isCallOpen(c.deadline))
    .map(c => ({ call: c, u: computeUrgency(c, now) }))
    .filter(x => x.u.urgencyClass !== 'closed');
  processed.sort((a, b) => {
    if (a.call.deadline === 'Continuous' && b.call.deadline === 'Continuous') return 0;
    if (a.call.deadline === 'Continuous') return 1;
    if (b.call.deadline === 'Continuous') return -1;
    return a.u.deadlineDate - b.u.deadlineDate;
  });
  let html = '';
  const used = new Set();
  const today = processed.filter(x => x.u.daysLeft === 0);
  if (today.length) { html += '      <h3 class="section-header">Ending Today</h3>\n'; today.forEach(x => { html += renderStaticCard(x.call, x.u); used.add(x); }); }
  const tomorrow = processed.filter(x => x.u.daysLeft === 1);
  if (tomorrow.length) { html += '      <h3 class="section-header">Ending Tomorrow</h3>\n'; tomorrow.forEach(x => { html += renderStaticCard(x.call, x.u); used.add(x); }); }
  let currentSection = '';
  processed.filter(x => !used.has(x)).forEach(x => {
    const section = x.call.deadline === 'Continuous' ? 'Continuous' : MONTHS_CAP[x.u.deadlineDate.getMonth()] + ' ' + x.u.deadlineDate.getFullYear();
    if (section !== currentSection) { currentSection = section; html += '      <h3 class="section-header">' + section + '</h3>\n'; }
    html += renderStaticCard(x.call, x.u);
  });
  return html;
}

// === Helpers ported from cards.js / call-detail.js so detail pages can pre-render
// the same content into static HTML (Google reads without JS). The browser JS
// later replaces this with identical content — no visual change for users. ===


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
    const countrySlug = countrySlugs[country] || slugify(country || '');
  if (PRECOMPUTED_COUNTRY_PAGES.has(countrySlug)) return '/' + countrySlug + '/';
  return null;
}

// Mirrors the prize block call-detail.js writes into #detailPrize
// Maps a free-text requirements string to a single browse bucket slug.
// Keep in sync with deriveRequirementBucket() in cards.js.
// Mirrors renderInfoGrid() in cards.js — produces the deadline/fee/prize/location/etc. table
// Mirrors scoreSimilarity() + loadSimilar() in call-detail.js — pre-renders the
// "More like this" block so internal links are visible to Google.
function buildStaticSimilarCalls(call, allCalls) {
  const currentSlug = call.slug || slugify(call.title);
  const candidates = allCalls
    .filter(c => (c.slug || slugify(c.title)) !== currentSlug)
    .filter(c => isCallOpen(c.deadline));
  const scored = candidates.map(c => ({ call: c, score: scoreSimilarity(call, c) }));
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
    const desc = escapeHtml(c.summary || c.description || '');
    html += `<div class="call-card"><h3 class="call-title"><a href="/${slug}/">${title}</a></h3><p class="call-description">${desc}</p></div>`;
  });
  return html;
}

// Compute countries for landing pages (including Online)
const countryCounts = {};
const openCountryCounts = {};
data.calls.forEach(call => {
  const country = getCountry(call.location);
  if (country) {
    countryCounts[country] = (countryCounts[country] || 0) + 1;
    if (isCallOpen(call.deadline)) {
      openCountryCounts[country] = (openCountryCounts[country] || 0) + 1;
    }
  }
});

// Compute orgs for landing pages
const orgCounts = {};
const openOrgCounts = {};
data.calls.forEach(call => {
  orgCounts[call.org] = (orgCounts[call.org] || 0) + 1;
  if (isCallOpen(call.deadline)) {
    openOrgCounts[call.org] = (openOrgCounts[call.org] || 0) + 1;
  }
});

function buildJsonLd(call) {
  const pageUrl = `${SITE}/${call.slug || slugify(call.title)}/`;
  // CreativeWork is the closest Schema.org type for an open-call posting.
  // Event was misused: there is no public event with date+location — only an
  // application deadline. Using Event misled Google about the page's nature.
  const ld = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "name": call.title,
    "description": call.description,
    "url": pageUrl,
    "inLanguage": "en",
    "publisher": {
      "@type": "Organization",
      "name": "Monographica",
      "url": "https://monographica.com"
    },
    "creator": {
      "@type": "Organization",
      "name": call.org
    }
  };
  if (call.dateAdded) {
    ld.datePublished = call.dateAdded.split('T')[0];
  }
  const verifiedAt = getVerifiedAt(call.slug || slugify(call.title));
  if (verifiedAt) {
    ld.dateModified = verifiedAt.split('T')[0];
  } else if (call.dateAdded) {
    ld.dateModified = call.dateAdded.split('T')[0];
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

  const robotsDirective = isCallOpen(call.deadline) ? 'index, follow' : 'noindex, follow';
  // The info grid + prize block are pre-rendered server-side below, so call-detail.js
  // no longer re-renders them on the client — it only reads CURRENT_CALL to score
  // "More like this" (scoreSimilarity/loadSimilar), and analytics.js reads .title for
  // the GA call_title dimension. Ship only those fields; do NOT trim further.
  const currentCallJson = JSON.stringify({ title: call.title, category: call.category, org: call.org, location: call.location || '', fee: call.fee || '', deadline: call.deadline, eligibility: call.eligibility || [] }).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: metaTitle, description: desc, canonical: `${SITE}/${slug}`, ogType: 'article', jsonLd: buildJsonLd(call), breadcrumbs: [{ name: (categoryLabel[call.category] || call.category), url: `${SITE}/${call.category === 'zine' ? 'zines' : call.category === 'exhibition' ? 'exhibitions' : call.category === 'residency' ? 'residencies' : call.category === 'grant' ? 'grants' : call.category}/` }, { name: call.title, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${HEADER}

  <main>
    <section class="call-detail">
      <nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/${{'photography':'photography','exhibition':'exhibitions','grant':'grants','zine':'zines','residency':'residencies','education':'education'}[call.category] || call.category}/">${escapeHtml({'photography':'Photography','exhibition':'Exhibition','grant':'Grant','zine':'Zines & Books','residency':'Residency','education':'Education'}[call.category] || call.category)} open call</a></nav>
      <h1 class="call-detail-title">${escapeHtml(call.title)}</h1>

      <div id="detailPrize">${buildPrizeBlock(call, escapeHtml)}</div>

${(() => { const state = makeLinkifyState(); return call.prose && call.prose.length
  ? call.prose.map(p => `      <p class="call-detail-description">${linkifyProse(p, call, state)}</p>`).join('\n')
  : `      <p class="call-detail-description">${linkifyProse(call.description, call, state)}</p>`; })()}
${call.winners && call.winners.length ? `
      <div class="call-detail-jury">
        <p class="call-detail-description">Winners: ${call.winners.map(w => escapeHtml(w)).join(' &middot; ')}</p>
      </div>
` : ''}
      <div class="call-detail-info" id="detailInfo">${renderInfoGrid(call, { esc: escapeHtml, locationLink: getStaticLocationLink })}</div>
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
${(() => { const v = getVerifiedAt(slug); return v ? `      <div class="call-detail-jury"><span class="breadcrumbs">Verified by Monographica on ${formatVerifiedDate(v)}</span></div>` : ''; })()}
    </section>

    <section class="related-calls">
      <div id="similarCalls">${buildStaticSimilarCalls(call, data.calls)}</div>
    </section>

    ${FOOTER}
  </main>

  <script>
    const CURRENT_SLUG = '${slug}';
    const CURRENT_CALL = ${currentCallJson};
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
  <script src="/call-detail.js?v=${cssVersion}"></script>

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
const linkedCountrySlugs = [];
let generated = 0;
let skipped = 0;

// --- Precompute strong country/state slug sets so detail pages can pre-render
//     only the location links we still want to promote from every call card.
//     Org pages remain live for users but are noindex and not prose-linked.
{
  // usStateNames + stateNameToAbbr come from shared.js (single source of truth).
  const countrySlugFor = { 'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates' };
  const openStateCountsForLinks = {};

  data.calls.forEach(c => {
    if (!isCallOpen(c.deadline) || !c.location || !c.location.endsWith('USA')) return;
    const parts = c.location.split(',');
    let st = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
    if (st && stateNameToAbbr[st]) st = stateNameToAbbr[st];
    if (st) openStateCountsForLinks[st] = (openStateCountsForLinks[st] || 0) + 1;
  });

  data.calls.forEach(c => {
    // Link to every location page that actually gets generated (one per country/
    // state that appears in any call), independent of the SEO index threshold —
    // a noindex page is still live and should never have its chip link dropped.
    const country = getCountry(c.location);
    if (country) {
      PRECOMPUTED_COUNTRY_PAGES.add(countrySlugFor[country] || slugify(country));
    }
    if (c.location && c.location.endsWith('USA')) {
      const parts = c.location.split(',');
      let st = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
      if (st && stateNameToAbbr[st]) st = stateNameToAbbr[st];
      if (st && usStateNames[st]) {
        PRECOMPUTED_STATE_PAGES[st] = 'united-states/' + slugify(usStateNames[st]);
      }
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
  // Only include open calls in the sitemap. Expired call pages remain
  // accessible (noindex, follow) but are excluded so Google does not keep
  // re-discovering low-value pages past their relevance window.
  if (isCallOpen(call.deadline)) {
    sitemapEntries.push(`${SITE}/${slug}`);
  }
  generated++;
});

// === Category landing pages ===
const categories = {
  'photography': { title: 'Photography Open Calls', desc: 'Competitions, awards, and call for entries for photographers worldwide. Submit your work to juried exhibitions, contests, and portfolio reviews.'},
  'exhibition': { title: 'Exhibition Open Calls', desc: 'Call for entries for group and solo exhibitions worldwide. Gallery shows, curated exhibitions, and art fair opportunities for visual artists.'},
  'grant': { title: 'Grants for Photographers & Visual Artists', desc: 'Funding opportunities for photographers and visual artists. Project grants, production funds, and artist support programs — apply now.'},
  'residency': { title: 'Artist Residencies for Photographers', desc: 'Residency programs for photographers and visual artists worldwide. Studio residencies, international programs, and creative retreats.'},
  'zine': { title: 'Zine & Photobook Open Calls', desc: 'Submit to photobook prizes, zine publications, and dummy awards. Publishing opportunities for photographers and visual artists.'},
  'education': { title: 'Photography Workshops & Education', desc: 'Workshops, masterclasses, mentoring programs, and educational opportunities for photographers and visual artists worldwide.'}
};

Object.entries(categories).forEach(([cat, info]) => {
  const catSlug = cat === 'zine' ? 'zines' : cat === 'exhibition' ? 'exhibitions' : cat === 'residency' ? 'residencies' : cat === 'grant' ? 'grants' : cat;
  const slug = catSlug;
  // Only list open calls on landing pages so internal links flow to indexable URLs.
  const catCalls = data.calls.filter(c => c.category === cat && isCallOpen(c.deadline));
  const count = catCalls.length;
  const indexable = shouldIndexCategoryPage(count);
  const robotsDirective = robotsFor(indexable);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${info.title} ${YEAR}`, description: escapeHtml(info.desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${info.title} ${YEAR}`, info.desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Categories', url: `${SITE}/categories/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
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
  ${facetListScript(`c => c.category === '${cat}' && isCallOpen(c.deadline)`)}

</body>
</html>`;

  writeGenerated(`${slug}/index.html`, html);
  if (indexable) sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Category page: ${slug} (${count} calls, ${robotsDirective})`);
});

// === Special filter pages (Free, Prize) ===
const filterPages = [
  {
    slug: 'fees/free',
    feeKey: 'free',
    title: 'Free Open Calls for Artists',
    desc: 'Open calls with no entry fee. Free exhibitions, grants, residencies, and submissions for photographers and visual artists.',
    
    filterJs: `c.fee && c.fee.toLowerCase().startsWith('free')`
  },
  {
    slug: 'fees/entry-fee',
    feeKey: 'entry-fee',
    title: 'Open Calls with Entry Fees',
    desc: 'Open calls with entry fees. Competitions, exhibitions, and submissions for photographers and visual artists.',
    
    filterJs: `c.fee && !c.fee.toLowerCase().startsWith('free')`
  }
];

const feeFilters = {
  'free': c => c.fee && c.fee.toLowerCase().startsWith('free'),
  'entry-fee': c => c.fee && !c.fee.toLowerCase().startsWith('free')
};

filterPages.forEach(fp => {
  // Only list open calls on fee landing pages.
  const fpCalls = data.calls.filter(c => feeFilters[fp.feeKey](c) && isCallOpen(c.deadline));
  const count = fpCalls.length;
  const indexable = shouldIndexFeePage(fp.slug, count);
  const robotsDirective = robotsFor(indexable);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${fp.title} ${YEAR}`, description: escapeHtml(fp.desc), canonical: `${SITE}/${fp.slug}`, jsonLd: collectionPageLd(`${fp.title} ${YEAR}`, fp.desc, `${SITE}/${fp.slug}/`), breadcrumbs: [{ name: 'Fees', url: `${SITE}/fees/` }, { name: fp.title, url: `${SITE}/${fp.slug}/` }], cssVersion, robots: robotsDirective })}
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
  ${facetListScript(`c => (${fp.filterJs}) && isCallOpen(c.deadline)`)}

</body>
</html>`;

  writeGenerated(`${fp.slug}/index.html`, html);
  if (indexable) sitemapEntries.push(`${SITE}/${fp.slug}`);
  console.log(`  Filter page: ${fp.slug} (${count} calls, ${robotsDirective})`);
});

// === Fees index page ===
const freeCount = openCalls.filter(feeFilters['free']).length;
const paidCount = openCalls.filter(feeFilters['entry-fee']).length;
const feesIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Entry Fee ${YEAR}`, description: 'Browse open calls by entry fee. Find free open calls with no submission fee, or paid competitions for photographers and visual artists.', canonical: `${SITE}/fees`, jsonLd: collectionPageLd(`Open Calls by Entry Fee ${YEAR}`, "Browse open calls by entry fee.", `${SITE}/fees/`), cssVersion, robots: 'noindex, follow' })}
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
  'baltics-finland': { short: 'Baltics & Finland', title: 'Open Calls for Baltic & Finnish Artists', desc: 'Open calls restricted to photographers and artists from the Baltic states (Estonia, Latvia, Lithuania) and Finland.' },
  'commonwealth': { short: 'Commonwealth', title: 'Commonwealth-Only Open Calls', desc: 'Open calls restricted to citizens or residents of Commonwealth nations. Competitions, exhibitions, and awards for Commonwealth photographers and artists.' },
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
  'minnesota': { short: 'Minnesota', title: 'Minnesota-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Minnesota.' },
  'colorado': { short: 'Colorado', title: 'Colorado-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Colorado.' },
  'texas': { short: 'Texas', title: 'Texas-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Texas.' },
  'washington': { short: 'Washington', title: 'Washington-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Washington State.' },
  'virginia': { short: 'Virginia', title: 'Virginia-Only Open Calls', desc: 'Open calls restricted to photographers and artists living or working in Virginia.' },
  'native-american': { short: 'Native American', title: 'Open Calls for Native American Artists', desc: 'Open calls, residencies, and awards for Native American photographers and artists, including enrolled members of US federally recognized tribes.' },
  'northern-california': { short: 'Northern California', title: 'Northern California Open Calls', desc: 'Open calls restricted to photographers and artists based in Northern California.' },
  'arkansas': { short: 'Arkansas', title: 'Arkansas-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Arkansas.' },
  'maryland': { short: 'Maryland', title: 'Maryland-Only Open Calls', desc: 'Open calls restricted to photographers and artists residing in Maryland.' },
  'midwest-us': { short: 'Midwest US', title: 'Midwest US Open Calls', desc: 'Open calls restricted to photographers and artists living or working in the US Midwest — Iowa, Illinois, Indiana, Kansas, Kentucky, Michigan, Minnesota, Missouri, North Dakota, Nebraska, Ohio, South Dakota, and Wisconsin.' },
  'north-east-england': { short: 'North East England', title: 'North East England Open Calls', desc: 'Open calls restricted to photographers and artists based in the North East of England — Tyne and Wear, Northumberland, County Durham, and Tees Valley.' },
  'western-us': { short: 'Western US', title: 'Western US Open Calls', desc: 'Open calls restricted to photographers and artists living in the western United States — Alaska, Arizona, California, Colorado, Hawaii, Idaho, Kansas, Montana, Nebraska, Nevada, New Mexico, North Dakota, Oregon, South Dakota, Texas, Utah, Washington, and Wyoming.' },
  'southwest-us': { short: 'Southwest US', title: 'Southwest US Open Calls', desc: 'Open calls restricted to photographers and artists living or working in the American Southwest — Arizona, New Mexico, Texas, Colorado, Utah, Nevada, and California.' },
  'bipoc': { short: 'BIPOC Artists', title: 'Open Calls for BIPOC Artists', desc: 'Open calls, exhibitions, and awards for Black, Indigenous, and People of Color (BIPOC) photographers and visual artists.' },
  'bay-area': { short: 'Bay Area', title: 'Bay Area Open Calls', desc: 'Open calls restricted to photographers and artists based in the San Francisco Bay Area.' },
  'chicago-area': { short: 'Chicago Area', title: 'Chicago Area Open Calls', desc: 'Open calls restricted to photographers and artists based in the Chicago metropolitan area.' },
  'los-angeles': { short: 'Los Angeles', title: 'Los Angeles Open Calls', desc: 'Open calls restricted to photographers and artists based in the greater Los Angeles area.' },
  'tampa-bay': { short: 'Tampa Bay', title: 'Tampa Bay Open Calls', desc: 'Open calls restricted to photographers and artists based in the Tampa Bay region of Florida — Hillsborough, Manatee, Pasco, Pinellas, and Sarasota counties.' },
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
  '65-plus': { short: '65+', title: 'Open Calls for Artists 65+', desc: 'Open calls restricted to photographers and artists aged 65 or older. Exhibitions, grants, and awards for senior and later-career artists.' },
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

// Validate every eligibility tag used in data has a chip label (eligibilityLabel,
// the single source of truth injected into cards.js) AND a facet-page config
// (eligibilityGroups). cards.js no longer keeps a second hand-maintained copy, so
// these two maps can't drift apart from each other the way they used to.
Object.keys(eligibilityTags).forEach(tag => {
  if (!eligibilityGroups[tag]) {
    console.error(`ERROR: Eligibility tag "${tag}" has no entry in eligibilityGroups (generate-pages.js). Add short, title, and desc.`);
    hasErrors = true;
  }
  if (!(tag in eligibilityLabel)) {
    console.error(`ERROR: Eligibility tag "${tag}" has no entry in eligibilityLabel (shared.js) — the chip would render as the raw slug. Add a display label.`);
    hasErrors = true;
  }
});
if (hasErrors) { console.error('Fix errors above before generating.'); process.exit(1); }

const eligibilityPageSlugs = [];
Object.entries(eligibilityGroups).forEach(([tag, info]) => {
  const count = eligibilityTags[tag] || 0;
  const openCount = openEligibilityTags[tag] || 0;
  const slug = `eligibility/${tag}`;
  // Facet pages stay useful for users but are intentionally not standalone
  // search landing pages during the product-reset test.
  const robotsDirective = 'noindex, follow';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(info.title)} ${YEAR}`, description: escapeHtml(info.desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${info.title} ${YEAR}`, info.desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Eligibility', url: `${SITE}/eligibility/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/eligibility/">Eligibility</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => c.eligibility && c.eligibility.includes(tag) && isCallOpen(c.deadline)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  ${facetListScript(`c => c.eligibility && c.eligibility.includes('${tag}')${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}`)}

</body>
</html>`;

  eligibilityPageSlugs.push(tag);
  writeGenerated(`${slug}/index.html`, html);
  console.log(`  Eligibility page: ${tag} (${count} calls, ${openCount} open)`);
});

// Eligibility index page
const eligibilityOrder = [
  { heading: 'Who Can Apply', tags: ['women', 'flinta', 'black', 'bipoc', 'native-american', 'lgbtq', 'neurodivergent-disabled', 'emerging', 'mid-career', 'student', 'professional', 'under-30', 'under-35', 'under-40', '16-plus', '18-plus', '21-plus', '25-plus', '45-plus', '65-plus', '10-18'] },
  { heading: 'Where', tags: ['united-states', 'new-york-state', 'alaska', 'arkansas', 'colorado', 'maryland', 'minnesota', 'texas', 'virginia', 'washington', 'bay-area', 'chicago-area', 'los-angeles', 'northern-california', 'tampa-bay', 'tri-state', 'gulf-coast', 'mid-atlantic-us', 'midwest-us', 'western-us', 'southwest-us', 'canada', 'europe', 'australia', 'baltics-finland', 'commonwealth', 'france', 'germany', 'india', 'ireland', 'italy', 'kazakhstan', 'malta', 'morocco', 'nordic', 'portugal', 'spain', 'switzerland', 'taiwan', 'ukraine', 'united-kingdom', 'north-east-england', 'non-european', 'wana'] },
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
    // Only list eligibility tags with open calls — zero-open pages are noindex
    // and stay reachable via search.
    const activeTags = group.tags.filter(t => (openEligibilityTags[t] || 0) > 0);
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
  ${HEAD({ title: `Open Calls by Eligibility ${YEAR}`, description: 'Browse open calls by eligibility. Find calls for women, emerging artists, LGBTQ+ photographers, regional restrictions, analog photography, and more.', canonical: `${SITE}/eligibility`, jsonLd: collectionPageLd(`Open Calls by Eligibility ${YEAR}`, "Browse open calls by eligibility.", `${SITE}/eligibility/`), cssVersion, robots: 'noindex, follow' })}
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
  const openCount = openPrizeCatTags[tag] || 0;
  const slug = `prize/${tag}`;
  const robotsDirective = 'noindex, follow';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(info.title)} ${YEAR}`, description: escapeHtml(info.desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${info.title} ${YEAR}`, info.desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Prizes', url: `${SITE}/prize/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/prize/">Prizes</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => derivePrizeCategories(c.prize).includes(tag) && isCallOpen(c.deadline)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    // derivePrizeCategories comes from cards.js (loaded above) — the single
    // source of truth injected at build time. No local copy (it used to drift).
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => derivePrizeCategories(c.prize).includes('${tag}')${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}).map(processCall);
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
  console.log(`  Prize page: ${tag} (${count} calls, ${openCount} open)`);
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
  ${HEAD({ title: `Open Calls by Prize Type ${YEAR}`, description: 'Browse open calls by prize type. Find calls with cash prizes, exhibitions, publications, residencies, and fellowships.', canonical: `${SITE}/prize`, jsonLd: collectionPageLd(`Open Calls by Prize Type ${YEAR}`, "Browse open calls by prize type.", `${SITE}/prize/`), cssVersion, robots: 'noindex, follow' })}
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
  console.log(`  Prize index page (${prizeCatPageSlugs.length} groups)`);
}

// === Requirements (submission) pages ===
const requirementGroups = {
  '1-image': { short: 'Single image', title: 'Open Calls Requiring a Single Image', desc: 'Open calls and competitions where you submit just one image. Single-photo entries for photographers and visual artists.' },
  '2-5-images': { short: '2–5 images', title: 'Open Calls Requiring 2–5 Images', desc: 'Open calls accepting a small set of 2 to 5 images. Compact submissions for photographers and visual artists.' },
  '6-10-images': { short: '6–10 images', title: 'Open Calls Requiring 6–10 Images', desc: 'Open calls accepting a mid-size set of 6 to 10 images. Browse and apply with a short series.' },
  '11-20-images': { short: '11–20 images', title: 'Open Calls Requiring 11–20 Images', desc: 'Open calls accepting a larger set of 11 to 20 images. Ideal for extended series and bodies of work.' },
  '21-plus-images': { short: '21+ images', title: 'Open Calls Requiring 21+ Images', desc: 'Open calls accepting large submissions of more than 20 images. For extensive projects and bodies of work.' },
  'unlimited': { short: 'Unlimited images', title: 'Open Calls With No Image Limit', desc: 'Open calls that place no cap on the number of images you can submit. Show as much work as you like.' },
  'portfolio': { short: 'Portfolio / series', title: 'Open Calls Requiring a Portfolio', desc: 'Open calls asking for a portfolio, cohesive series, or body of work rather than a fixed image count.' },
  'photobook': { short: 'Photobook / dummy', title: 'Open Calls Requiring a Photobook', desc: 'Open calls and awards asking for a photobook, book dummy, or zine. Submissions for photobook makers and publishers.' },
  'proposal': { short: 'Proposal / project', title: 'Open Calls Requiring a Proposal', desc: 'Open calls, grants, and residencies asking for a project proposal, statement of intent, or budget alongside work.' }
};
const requirementOrder = ['1-image', '2-5-images', '6-10-images', '11-20-images', '21-plus-images', 'unlimited', 'portfolio', 'photobook', 'proposal'];

const requirementTags = {};
const openRequirementTags = {};
data.calls.forEach(c => {
  const b = deriveRequirementBucket(c.requirements);
  if (!b) return;
  requirementTags[b] = (requirementTags[b] || 0) + 1;
  if (isCallOpen(c.deadline)) openRequirementTags[b] = (openRequirementTags[b] || 0) + 1;
});

const requirementPageSlugs = [];
requirementOrder.filter(tag => requirementTags[tag]).forEach(tag => {
  const info = requirementGroups[tag];
  const count = requirementTags[tag] || 0;
  const openCount = openRequirementTags[tag] || 0;
  const slug = `requirements/${tag}`;
  const robotsDirective = 'noindex, follow';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(info.title)} ${YEAR}`, description: escapeHtml(info.desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${info.title} ${YEAR}`, info.desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Requirements', url: `${SITE}/requirements/` }, { name: info.title, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/requirements/">Requirements</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => deriveRequirementBucket(c.requirements) === tag && isCallOpen(c.deadline)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  ${facetListScript(`c => deriveRequirementBucket(c.requirements) === '${tag}'${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}`)}

</body>
</html>`;

  requirementPageSlugs.push(tag);
  writeGenerated(`${slug}/index.html`, html);
  console.log(`  Requirements page: ${tag} (${count} calls, ${openCount} open)`);
});

// Requirements index page
function buildRequirementIndexItems() {
  let html = '';
  requirementOrder.filter(t => requirementTags[t]).forEach(tag => {
    const info = requirementGroups[tag];
    html += `      <a href="/requirements/${tag}/" class="index-item">
        <span class="index-item-name">${escapeHtml(info.short)}</span>
        <span class="dots"></span>
        <span class="index-item-count">${openRequirementTags[tag] || 0}</span>
      </a>\n`;
  });
  return html;
}

if (requirementPageSlugs.length) {
  const requirementsIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Submission Requirements ${YEAR}`, description: 'Browse open calls by what you need to submit — a single image, a small set, a full series, a portfolio, a photobook, or a project proposal.', canonical: `${SITE}/requirements`, jsonLd: collectionPageLd(`Open Calls by Submission Requirements ${YEAR}`, "Browse open calls by submission requirements.", `${SITE}/requirements/`), cssVersion, robots: 'noindex, follow' })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Requirements', 'Browse open calls by what you need to submit — a single image, a small set, a full series, a portfolio, a photobook, or a project proposal.')}

    <section class="index-list" id="indexList">
      ${buildRequirementIndexItems()}
    </section>

    <p class="browse-more"><a href="/browse/">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

  writeGenerated('requirements/index.html', requirementsIndexHtml);
  console.log(`  Requirements index page (${requirementPageSlugs.length} groups)`);
}

// === Submit-via (submission method) pages ===
// One honest method per call (Website / Email / Post / WeTransfer / Instagram /
// Dropbox / Google Drive), grouped with the SAME submitViaLabel() the "Submit via"
// row links from. The label on every detail page points at /submit-via/.
const submitViaGroups = {
  'website':      { label: 'Website',      short: 'Website / form', title: 'Open Calls You Submit Online',           desc: 'Open calls you enter through the organiser’s website, an online entry form, or a submission platform.' },
  'email':        { label: 'Email',        short: 'Email',          title: 'Open Calls You Submit by Email',          desc: 'Open calls you enter by emailing your work directly to the organiser.' },
  'post':         { label: 'Post',         short: 'Post / mail',    title: 'Open Calls You Submit by Post',           desc: 'Open calls that ask for physical prints, books, or materials sent by mail.' },
  'wetransfer':   { label: 'WeTransfer',   short: 'WeTransfer',     title: 'Open Calls You Submit via WeTransfer',    desc: 'Open calls that collect files through WeTransfer or a similar file-transfer service.' },
  'instagram':    { label: 'Instagram',    short: 'Instagram',      title: 'Open Calls You Submit via Instagram',     desc: 'Open calls you enter through Instagram — by tagging, posting, or direct message.' },
  'dropbox':      { label: 'Dropbox',      short: 'Dropbox',        title: 'Open Calls You Submit via Dropbox',       desc: 'Open calls that collect files through a shared Dropbox folder or link.' },
  'google-drive': { label: 'Google Drive', short: 'Google Drive',   title: 'Open Calls You Submit via Google Drive',  desc: 'Open calls that collect files through a shared Google Drive folder or link.' }
};
const submitViaOrder = ['website', 'email', 'post', 'wetransfer', 'instagram', 'dropbox', 'google-drive'];
const submitViaSlugByLabel = {};
submitViaOrder.forEach(slug => { submitViaSlugByLabel[submitViaGroups[slug].label] = slug; });

const submitViaTags = {};
const openSubmitViaTags = {};
data.calls.forEach(c => {
  if (!c.submitVia) return;
  const slug = submitViaSlugByLabel[submitViaLabel(c.submitVia)];
  if (!slug) return;
  submitViaTags[slug] = (submitViaTags[slug] || 0) + 1;
  if (isCallOpen(c.deadline)) openSubmitViaTags[slug] = (openSubmitViaTags[slug] || 0) + 1;
});

// Build a sub-page only when the method has at least one OPEN call (avoids stale
// empty pages). Future calls re-introduce a method automatically on the next run.
const submitViaPageSlugs = [];
submitViaOrder.filter(slug => openSubmitViaTags[slug]).forEach(slug => {
  const info = submitViaGroups[slug];
  const count = submitViaTags[slug] || 0;
  const openCount = openSubmitViaTags[slug] || 0;
  const pageSlug = `submit-via/${slug}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(info.title)} ${YEAR}`, description: escapeHtml(info.desc), canonical: `${SITE}/${pageSlug}`, jsonLd: collectionPageLd(`${info.title} ${YEAR}`, info.desc, `${SITE}/${pageSlug}/`), breadcrumbs: [{ name: 'Submit via', url: `${SITE}/submit-via/` }, { name: info.title, url: `${SITE}/${pageSlug}/` }], cssVersion, robots: 'noindex, follow' })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/submit-via/">Submit via</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => submitViaSlugByLabel[submitViaLabel(c.submitVia)] === slug && isCallOpen(c.deadline)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  ${facetListScript(`c => submitViaLabel(c.submitVia) === ${JSON.stringify(info.label)} && isCallOpen(c.deadline)`)}

</body>
</html>`;

  submitViaPageSlugs.push(slug);
  writeGenerated(`${pageSlug}/index.html`, html);
  console.log(`  Submit-via page: ${slug} (${count} calls, ${openCount} open)`);
});

// Submit-via index (hub) page — the target of the "Submit via" detail-page label.
function buildSubmitViaIndexItems() {
  let html = '';
  submitViaOrder.filter(slug => openSubmitViaTags[slug]).forEach(slug => {
    const info = submitViaGroups[slug];
    html += `      <a href="/submit-via/${slug}/" class="index-item">
        <span class="index-item-name">${escapeHtml(info.short)}</span>
        <span class="dots"></span>
        <span class="index-item-count">${openSubmitViaTags[slug] || 0}</span>
      </a>\n`;
  });
  return html;
}

if (submitViaPageSlugs.length) {
  const submitViaDesc = 'How you send your work to the open calls listed here — through a website or online form, by email, by post, or via a file-transfer service.';
  const submitViaIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls by Submission Method ${YEAR}`, description: submitViaDesc, canonical: `${SITE}/submit-via`, jsonLd: collectionPageLd(`Open Calls by Submission Method ${YEAR}`, submitViaDesc, `${SITE}/submit-via/`), cssVersion, robots: 'noindex, follow' })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Submit via', submitViaDesc)}

    <section class="index-list" id="indexList">
      ${buildSubmitViaIndexItems()}
    </section>

    <p class="browse-more"><a href="/browse/">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

  writeGenerated('submit-via/index.html', submitViaIndexHtml);
  console.log(`  Submit-via index page (${submitViaPageSlugs.length} methods)`);
}

// === Country landing pages ===
const countryNames = {
  'USA': 'the United States', 'UK': 'the United Kingdom', 'UAE': 'the United Arab Emirates', 'Netherlands': 'the Netherlands'
};

Object.entries(countryCounts)
  .forEach(([country, count]) => {
    const fullName = countryNames[country] || country;
    const countrySlug = countrySlugs[country] || slugify(country);
    const slug = countrySlug;
    const isOnline = country === 'Online';
    const openCount = openCountryCounts[country] || 0;
    const indexable = shouldIndexCountryPage(country, openCount);
    const robotsDirective = robotsFor(indexable);
    const title = isOnline ? 'Online Open Calls for Artists' : `Open Calls for Artists in ${fullName}`;
    const desc = isOnline
      ? 'Online open calls, competitions, and submissions for photographers and visual artists. No travel required — apply from anywhere.'
      : `Find open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullName}. Browse and apply today.`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(title)} ${YEAR}`, description: escapeHtml(desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${title} ${YEAR}`, desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Locations', url: `${SITE}/locations/` }, { name: country, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero(buildBreadcrumbs('Locations', '/locations'), escapeHtml(title), escapeHtml(desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => getCountry(c.location) === country && isCallOpen(c.deadline)))}
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
      // State index for USA — usStateNames + stateNameToAbbr are the shared.js
      // globals (loaded above), so this never drifts from the server map.
      const _n = new Date(); const today = _n.getFullYear() + '-' + String(_n.getMonth()+1).padStart(2,'0') + '-' + String(_n.getDate()).padStart(2,'0');
      const counts = {};
      data.calls.filter(c => c.location && c.location.endsWith('USA') && (c.deadline === 'Continuous' || c.deadline >= today)).forEach(c => {
        const parts = c.location.split(',');
        let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
        if (state && stateNameToAbbr[state]) state = stateNameToAbbr[state];
        if (state) counts[state] = (counts[state] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => {
        const nameA = (usStateNames[a[0]] || a[0]).toLowerCase();
        const nameB = (usStateNames[b[0]] || b[0]).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      const container = document.getElementById('callsList');
      container.className = 'index-list';
      let html = '';
      sorted.forEach(([state, count]) => {
        const fullName = usStateNames[state] || state;
        html += '<a href="/united-states/' + slugify(fullName) + '/" class="index-item">' +
          '<span class="index-item-name">' + esc(fullName) + '</span>' +
          '<span class="dots"></span>' +
          '<span class="index-item-count">' + count + '</span></a>';
      });
      container.innerHTML = html;
` : `
      const calls = data.calls.filter(c => getCountry(c.location) === '${country.replace(/'/g, "\\'")}'${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}).map(processCall);
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
    // Every generated country page is linkable (noindex pages included); the
    // `indexable` flag only controls SEO robots + sitemap, not internal links.
    linkedCountrySlugs.push(slug);
    writeGenerated(`${slug}/index.html`, html);
    if (indexable) sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Country page: ${slug} (${count} calls, ${openCount} open)`);
  });

// === US State landing pages ===
// usStateNames + stateNameToAbbr come from shared.js (single source of truth).

const stateCounts = {};
const openStateCounts = {};
data.calls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
  const parts = c.location.split(',');
  let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
  // Normalize full state names to abbreviations to prevent duplicate pages
  if (state && stateNameToAbbr[state]) state = stateNameToAbbr[state];
  if (state) {
    stateCounts[state] = (stateCounts[state] || 0) + 1;
    if (isCallOpen(c.deadline)) {
      openStateCounts[state] = (openStateCounts[state] || 0) + 1;
    }
  }
});

Object.entries(stateCounts).forEach(([state, count]) => {
  const fullStateName = usStateNames[state] || state;
  const stateSlug = slugify(fullStateName);
  const slug = `united-states/${stateSlug}`;
  const openCount = openStateCounts[state] || 0;
  const indexable = shouldIndexStatePage(openCount);
  const robotsDirective = robotsFor(indexable);
  const title = `Open Calls for Artists in ${fullStateName}`;
  const desc = `Find open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullStateName}. Browse and apply today.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `${escapeHtml(title)} ${YEAR}`, description: escapeHtml(desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${title} ${YEAR}`, desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Locations', url: `${SITE}/locations/` }, { name: 'United States', url: `${SITE}/united-states/` }, { name: state, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/locations/">Locations</a> / <a href="/united-states/">United States</a></nav>', escapeHtml(title), escapeHtml(desc))}

    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => c.location && (c.location.includes(', ' + state + ',') || c.location.includes(', ' + fullStateName + ',')) && isCallOpen(c.deadline)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  ${facetListScript(`c => c.location && (c.location.includes(', ${state},') || c.location.includes(', ${fullStateName},'))${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}`)}

</body>
</html>`;

  slugMap[slug] = `state: ${fullStateName}`;
  writeGenerated(`${slug}/index.html`, html);
  if (indexable) sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  State page: ${slug} (${count} calls, ${openCount} open)`);
});

// === Org landing pages ===
Object.entries(orgCounts)
  .forEach(([org, count]) => {
    const orgSlug = slugify(org);
    const slug = orgSlug;
    const openCount = openOrgCounts[org] || 0;
    const robotsDirective = 'noindex, follow';
    const title = `${org} - Open Calls`;
    const desc = `Open calls and submission opportunities from ${org}. Browse exhibitions, grants, residencies, and more for photographers and visual artists.`;

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
  ${HEAD({ title: escapeHtml(title), description: escapeHtml(desc), canonical: `${SITE}/${slug}`, jsonLd: collectionPageLd(`${org} - Open Calls`, desc, `${SITE}/${slug}/`), breadcrumbs: [{ name: 'Organizations', url: `${SITE}/organizations/` }, { name: org, url: `${SITE}/${slug}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero(buildBreadcrumbs('Organizations', '/organizations'), escapeHtml(org), escapeHtml(desc))}
    <section class="calls-list" id="callsList">
${buildStaticCallList(data.calls.filter(c => c.org === org && isCallOpen(c.deadline)))}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  ${facetListScript(`c => c.org === '${org.replace(/'/g, "\\'")}'${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}`)}

</body>
</html>`;

    slugMap[slug] = `org: ${org}`;
    createdOrgSlugs.push(slug);
    writeGenerated(`${slug}/index.html`, html);
    console.log(`  Org page: ${slug} (${count} calls, ${openCount} open)`);
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
  // Past-month pages where every call has closed → noindex + drop from sitemap.
  const robotsDirective = openCount > 0 ? 'index, follow' : 'noindex, follow';
  const visibleCalls = openCount > 0 ? g.calls.filter(isOpen) : g.calls;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Open Calls — ${label}`, description: `${count} open calls for artists with deadlines in ${label}. Photography competitions, exhibitions, grants, and residencies.`, canonical: `${SITE}/deadlines/${key}`, jsonLd: collectionPageLd(`Open Calls — ${label}`, `Open calls with deadlines in ${label}.`, `${SITE}/deadlines/${key}/`), breadcrumbs: [{ name: 'Deadlines', url: `${SITE}/deadlines/` }, { name: label, url: `${SITE}/deadlines/${key}/` }], cssVersion, robots: robotsDirective })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/deadlines/">Deadlines</a></nav>', label, `${count} call${count !== 1 ? 's' : ''} with deadlines in ${label}${openCount > 0 && openCount < count ? ` — ${openCount} still open` : openCount === 0 ? ' — all closed' : ''}.`)}

    <section class="calls-list" id="callsList">
${buildStaticCallList(visibleCalls)}
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}
  <script>
    async function loadFiltered() {
      try {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.deadline !== 'Continuous' && c.deadline.startsWith('${g.year}-${String(g.month + 1).padStart(2, '0')}')${openCount > 0 ? ' && isCallOpen(c.deadline)' : ''}).map(processCall);
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
  if (openCount > 0) sitemapEntries.push(`${SITE}/deadlines/${key}`);
  console.log(`  Deadline page: ${label} (${count} calls, ${openCount} open)`);
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
  ${HEAD({ title: `Open Calls by Deadline ${YEAR}`, description: 'Browse open calls by deadline month. Find photography competitions, exhibitions, grants, and residencies organized by submission deadline.', canonical: `${SITE}/deadlines`, jsonLd: collectionPageLd(`Open Calls by Deadline ${YEAR}`, "Browse open calls by deadline month.", `${SITE}/deadlines/`), cssVersion })}
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
  ${HEAD({ title: 'Submit an Open Call', description: 'Know an open call we should list? Submit it here. We review every suggestion.', canonical: `${SITE}/submit`, cssVersion })}
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
          <summary>Add details <span style="color:var(--text-muted)">(optional)</span></summary>

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

// === About / editorial process page ===
const aboutJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "name": "About Monographica Open Calls",
  "description": "Editorial process and verification notes for Monographica Open Calls.",
  "url": `${SITE}/about/`,
  "publisher": {
    "@type": "Organization",
    "name": "Monographica",
    "url": "https://monographica.com"
  }
}, null, 2);

const aboutHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: 'About Open Calls', description: 'How Monographica curates, verifies, and updates open calls for photographers and visual artists.', canonical: `${SITE}/about`, jsonLd: aboutJsonLd, breadcrumbs: [{ name: 'About', url: `${SITE}/about/` }], cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'About Open Calls', 'How Monographica curates and verifies opportunities for photographers and visual artists.')}

    <section class="call-detail">
      <p class="call-detail-description">Monographica Open Calls is an editorial directory of submission opportunities for photographers and visual artists. The site focuses on exhibitions, grants, residencies, awards, publications, portfolio reviews, and education programs with clear deadlines or rolling application windows.</p>

      <h2 class="section-header">How calls are selected</h2>
      <p class="call-detail-description">Calls are gathered from official organization pages, organizer announcements, newsletters, public listings, and reader submissions. Listings are prioritized when they include enough practical information for artists to decide whether an opportunity is relevant: deadline, fee, prize or outcome, location, eligibility, submission requirements, organizer, and application link.</p>

      <h2 class="section-header">Verification</h2>
      <p class="call-detail-description">Before publication, details are checked against the official call page where possible. Many detail pages show a "Verified by Monographica" date; that date records the most recent editorial check in the local verification log. Because organizers can change deadlines, fees, juries, or eligibility after publication, each listing links to the official source and asks readers to confirm details before applying.</p>

      <h2 class="section-header">Updates and archives</h2>
      <p class="call-detail-description">The directory is updated regularly as new calls are found and existing calls are checked. Open calls are shown first across the homepage and browse pages. Closed calls may remain accessible for reference, but expired listings are not promoted as current opportunities.</p>

      <h2 class="section-header">Corrections</h2>
      <p class="call-detail-description">If a listing is wrong, outdated, duplicated, or missing important context, send the official source through the <a href="/submit/">submit form</a>. Corrections are handled from the official call information rather than from secondary summaries.</p>
    </section>

    ${FOOTER}
  </main>

  ${CARDS_SCRIPT(cssVersion)}

</body>
</html>`;

writeGenerated('about/index.html', aboutHtml);
sitemapEntries.push(`${SITE}/about`);
console.log('  About page');

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
  // Only surface destinations that actually have open calls. Zero-count pages
  // are noindex anyway and just bloat the page; they stay reachable via search.
  const live = items.filter(i => i.count > 0);
  if (!live.length) return '';
  const headingHtml = headingLink ? `<a href="${headingLink}">${escapeHtml(heading)}</a>` : escapeHtml(heading);
  let html = `<h3 class="section-header">${headingHtml}</h3>\n`;
  const sorted = [...live].sort((a, b) => b.count - a.count);
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

const browseRequirements = [];
requirementOrder.filter(t => requirementTags[t]).forEach(tag => {
  browseRequirements.push({ label: requirementGroups[tag].short, href: `/requirements/${tag}/`, count: openRequirementTags[tag] || 0 });
});

const browseCountries = Object.entries(countryCounts)
  .map(([country]) => {
    const countrySlug = countrySlugs[country] || slugify(country);
    const label = countryNames[country] ? countryNames[country].replace(/^the /, '') : country;
    return { label, href: `/${countrySlug}/`, count: openCountryCounts[country] || 0 };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

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

const browseOrgs = Object.entries(orgCounts)
  .filter(([org]) => createdOrgSlugs.includes(slugify(org)))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([org]) => ({ label: org, href: `/${slugify(org)}/`, count: openOrgCounts[org] || 0 }));

const browseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${HEAD({ title: `Browse All Open Calls ${YEAR}`, description: 'Browse open calls for photographers and visual artists by category, location, eligibility, and organization. Find exhibitions, grants, residencies, and competitions worldwide.', canonical: `${SITE}/browse`, jsonLd: collectionPageLd(`Browse All Open Calls ${YEAR}`, "Browse open calls for photographers and visual artists by category, location, eligibility, and organization.", `${SITE}/browse/`), cssVersion })}
</head>
<body>

  ${buildHeader()}

  <main>
    ${buildHero('', 'Browse All Open Calls', 'Explore open calls by category, location, eligibility, and organization.')}

    <section class="index-list">
${buildBrowseSection('Categories', browseCategories, '/categories/')}
${buildBrowseSection('Fees', browseFees, '/fees/')}
${buildBrowseSection('Prizes', browsePrizes, '/prize/')}
${buildBrowseSection('Requirements', browseRequirements, '/requirements/')}
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

// Build state pages map for cards.js
const statePageMap = {};
Object.keys(stateCounts).forEach(state => {
  // A state page is generated for every state that appears; link to all of them
  // (noindex pages included). The index threshold only governs SEO, not links.
  const fullName = usStateNames[state] || state;
  statePageMap[state] = 'united-states/' + slugify(fullName);
});

// Update page lists in cards.js (between markers) — only include actually created pages
// Only build-DERIVED data (which pages actually got generated) is injected.
// All shared LOGIC + static maps live in shared.js, loaded before cards.js.
const pageListsBlock = `// ==AUTO-GENERATED-START== (do not edit manually)
const countryPages = ${JSON.stringify(linkedCountrySlugs)};
const orgPages = [];
const statePages = ${JSON.stringify(statePageMap)};
// ==AUTO-GENERATED-END==`;
let cardsJs = fs.readFileSync('cards.js', 'utf8');
cardsJs = cardsJs.replace(
  /\/\/ ==AUTO-GENERATED-START==[\s\S]*?\/\/ ==AUTO-GENERATED-END==/,
  // Function replacement (not a string) so `$`-sequences in the injected
  // regex sources (e.g. `( fee)?$'`) aren't interpreted as replace patterns.
  () => pageListsBlock
);
fs.writeFileSync('cards.js', cardsJs);

// === HARD GATE 1: cards.js + shared.js integrity ===
// shared.js is the single source of truth for shared logic; cards.js consumes it
// and only gets build-derived DATA injected into its ==AUTO-GENERATED== block.
// Prove both parse, the markers/derived data are intact, shared logic is defined
// exactly once in shared.js, and is NOT re-declared (drifted) into cards.js.
{
  const written = fs.readFileSync('cards.js', 'utf8');
  const sharedSrc = fs.readFileSync('shared.js', 'utf8');
  const gateErrs = [];
  const countOf = (src, re) => (src.match(re) || []).length;
  if (countOf(written, /==AUTO-GENERATED-START==/g) !== 1) gateErrs.push('AUTO-GENERATED-START marker must appear exactly once in cards.js');
  if (countOf(written, /==AUTO-GENERATED-END==/g) !== 1) gateErrs.push('AUTO-GENERATED-END marker must appear exactly once in cards.js');
  // Shared SSOT functions: exactly once in shared.js, and ZERO copies in the
  // browser consumers (cards.js, call-detail.js) — they must use the shared one.
  const callDetailSrc = fs.readFileSync('call-detail.js', 'utf8');
  // scripts/ is gitignored local tooling — guard so the build works without it.
  const verifyBatchSrc = fs.existsSync('scripts/verify-batch.js') ? fs.readFileSync('scripts/verify-batch.js', 'utf8') : '';
  const updateStateSrc = fs.existsSync('scripts/update-verify-state.js') ? fs.readFileSync('scripts/update-verify-state.js', 'utf8') : '';
  for (const fn of ['function shortenFee(', 'function feeChip(', 'function submitViaLink(', 'function derivePrizeCategory(', 'function derivePrizeCategories(', 'function isCallOpen(', 'function computeUrgency(', 'function slugify(', 'function splitPrizeParts(', 'function shortenLocation(', 'function deriveRequirementBucket(', 'function renderTags(', 'function renderInfoGrid(', 'function buildPrizeBlock(', 'function tagHtml(', 'function getCountry(', 'function scoreSimilarity(', 'function getState(', 'function isFree(']) {
    const inShared = sharedSrc.split(fn).length - 1;
    if (inShared !== 1) gateErrs.push(`${fn} must be defined exactly once in shared.js (found ${inShared})`);
    for (const [consumer, csrc] of [['cards.js', written], ['call-detail.js', callDetailSrc], ['scripts/verify-batch.js', verifyBatchSrc], ['scripts/update-verify-state.js', updateStateSrc]]) {
      if (csrc.split(fn).length - 1 !== 0) gateErrs.push(`${fn} is re-declared in ${consumer} — it must live ONLY in shared.js`);
    }
  }
  // Shared data maps: defined once in shared.js, not re-declared in cards.js.
  for (const decl of ['const eligibilityLabel', 'const categoryLabel', 'const prizeCategoryLabel', 'const categorySlug', 'const shortCountry', 'const countrySlugs', 'const usStateNames', 'const stateNameToAbbr']) {
    if (sharedSrc.split(decl).length - 1 !== 1) gateErrs.push(`${decl} must be defined exactly once in shared.js`);
    if (written.split(decl).length - 1 !== 0) gateErrs.push(`${decl} is re-declared in cards.js — it must live ONLY in shared.js`);
  }
  // Hand-written core cards.js functions must not be duplicated.
  for (const fn of ['function renderCallList', 'function renderCard', 'function esc', 'function processCall']) {
    const n = written.split(fn).length - 1;
    if (n !== 1) gateErrs.push(`${fn} must appear exactly once in cards.js (found ${n})`);
  }
  // Both files must be syntactically valid JS (compile, do not run).
  for (const [name, src] of [['cards.js', written], ['shared.js', sharedSrc]]) {
    try { new (require('vm').Script)(src, { filename: name }); }
    catch (e) { gateErrs.push(`${name} failed to parse: ${e.message}`); }
  }
  if (gateErrs.length) {
    console.error('FATAL: shared.js/cards.js integrity gate failed:');
    gateErrs.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
}

// === HARD GATE 2: fee chips must stay short ===
// Every fee renders through shortenFee(); a format it can't condense passes
// through raw and produces an ugly long chip. Fail the build so an unhandled
// fee format must be taught to shortenFee rather than silently shipped long.
{
  const MAX_FEE_CHIP = 12; // longest legit compact output is a range like "€150–€250" (9)
  const offenders = [];
  const seenFee = new Set();
  data.calls.forEach(c => {
    if (!c.fee || seenFee.has(c.fee)) return;
    seenFee.add(c.fee);
    const out = shortenFee(c.fee);
    if (out && out.length > MAX_FEE_CHIP) offenders.push(`${out.length} chars: "${out}"  <=  "${c.fee}"`);
  });
  if (offenders.length) {
    console.error(`FATAL: ${offenders.length} fee chip(s) exceed ${MAX_FEE_CHIP} chars — extend shortenFee() to handle them:`);
    offenders.forEach(o => console.error('  - ' + o));
    process.exit(1);
  }
}

// Generate sitemap.xml with a restrained, high-value canonical set.
// Keep expired/noindex archives out, but submit active call detail pages:
// those are the pages users need while deadlines are still relevant.
const today = new Date().toISOString().split('T')[0];
const allUrlsRaw = [`${SITE}/`, ...sitemapEntries.map(u => u.endsWith('/') ? u : u + '/')];

const STRUCTURAL_EXACT = new Set([
  `${SITE}/`,
  `${SITE}/about/`,
  `${SITE}/browse/`,
  `${SITE}/categories/`,
  `${SITE}/deadlines/`,
  `${SITE}/submit/`,
  `${SITE}/photography/`,
  `${SITE}/exhibitions/`,
  `${SITE}/grants/`,
  `${SITE}/residencies/`,
  `${SITE}/zines/`,
  `${SITE}/fees/free/`,
]);
// Top country pages: include any country page that's a single-segment path
// directly under root (e.g. /united-states/, /germany/, /united-kingdom/).
// Individual state/city sub-paths and individual call/org pages are excluded.
function isTopCountryPage(url) {
  const path = url.slice(SITE.length);
  // Single segment under root, ends with slash, not in RESERVED/non-country list.
  if (!/^\/[a-z0-9-]+\/$/.test(path)) return false;
  const slug = path.slice(1, -1);
  return PRECOMPUTED_COUNTRY_PAGES.has(slug);
}

const ACTIVE_CALL_URLS = new Set(
  data.calls
    .filter(c => isCallOpen(c.deadline))
    .map(c => `${SITE}/${c.slug || slugify(c.title)}/`)
);
const ACTIVE_DEADLINE_URLS = new Set(
  Object.entries(monthGroups)
    .filter(([, group]) => group.calls.some(isOpen))
    .map(([key]) => `${SITE}/deadlines/${key}/`)
);
const INDEXABLE_STATE_URLS = new Set(
  Object.entries(openStateCounts)
    .filter(([, openCount]) => shouldIndexStatePage(openCount || 0))
    .map(([state]) => `${SITE}/united-states/${slugify(usStateNames[state] || state)}/`)
);

const allUrls = allUrlsRaw.filter(url =>
  STRUCTURAL_EXACT.has(url) ||
  isTopCountryPage(url) ||
  INDEXABLE_STATE_URLS.has(url) ||
  ACTIVE_CALL_URLS.has(url) ||
  ACTIVE_DEADLINE_URLS.has(url)
);

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemapXml);
console.log(`  Sitemap includes ${allUrls.length} active/structural URLs (from ${allUrlsRaw.length} generated candidates)`);

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
    html = html.replace(/src="\/shared\.js\?v=[^"]+"/g, `src="/shared.js?v=${cssVersion}"`);
    html = html.replace(/src="\/cards\.js\?v=[^"]+"/g, `src="/cards.js?v=${cssVersion}"`);
    html = html.replace(/src="\/search\.js\?v=[^"]+"/g, `src="/search.js?v=${cssVersion}"`);
    // shared.js must load before cards.js; inject it if the page predates the split.
    if (html.includes('cards.js') && !html.includes('shared.js')) {
      html = html.replace('<script src="/cards.js', `<script src="/shared.js?v=${cssVersion}"></script>\n  <script src="/cards.js`);
    }
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
  html = html.replace(/src="\/shared\.js\?v=[^"]+"/g, `src="/shared.js?v=${cssVersion}"`);
  html = html.replace(/src="\/cards\.js\?v=[^"]+"/g, `src="/cards.js?v=${cssVersion}"`);
  html = html.replace(/src="\/search\.js\?v=[^"]+"/g, `src="/search.js?v=${cssVersion}"`);
  // shared.js must load before cards.js; inject it if the page predates the split.
  if (html.includes('cards.js') && !html.includes('shared.js')) {
    html = html.replace('<script src="/cards.js', `<script src="/shared.js?v=${cssVersion}"></script>\n  <script src="/cards.js`);
  }
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
  const staticCalls = buildStaticHomeList(openCalls);
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
  html = setRobotsMeta(html, 'index, follow');
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
  html = setRobotsMeta(html, 'noindex, follow');
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
  html = setRobotsMeta(html, 'noindex, follow');
  html = html.replace(
    /<!-- STATIC-INDEX-START -->[\s\S]*?<!-- STATIC-INDEX-END -->/,
    `<!-- STATIC-INDEX-START -->\n${items}      <!-- STATIC-INDEX-END -->`
  );
  fs.writeFileSync('organizations/index.html', html);
  console.log(`  Organizations page: injected ${sorted.length} org links`);
}

// === Redirect stubs for renamed calls (old slug → current slug) ===
// When a call's title changes its slug changes too, orphaning the old directory.
// We never delete pages (they may be bookmarked/indexed), so replace the stale
// empty shell with a lightweight client redirect to the call's current URL.
// Add an entry here whenever a rename leaves a dead old slug behind.
const REDIRECTS = {
  '2026-fotograf-magazine-open-call': 'fotograf-magazine-2026-open-call',
  'after-dark-night-sky-and-shadow': 'after-dark-night-sky-and-shadow-photoplace-gallery',
  'fundacion-enaire-photography-prize-2026': 'xix-premio-de-fotograf-a-fundaci-n-enaire-2026',
  'remedy-photo-festival-2026-open-call': 'remedy-photo-festival-open-call-2026',
  'photoed-magazine-home-vs-away-issue-76': 'photoed-magazine-home-vs-away-issue-77'
};
Object.entries(REDIRECTS).forEach(([from, to]) => {
  if (slugMap[from]) { console.error(`ERROR: redirect source "${from}" collides with a live page — remove it from REDIRECTS.`); process.exit(1); }
  if (!slugMap[to]) { console.error(`ERROR: redirect target "${to}" does not exist — fix the REDIRECTS entry for "${from}".`); process.exit(1); }
  const dest = `/${to}/`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="${SITE}${dest}">
  <meta http-equiv="refresh" content="0; url=${dest}">
  <title>Redirecting&hellip;${TITLE_SUFFIX}</title>
  <script>location.replace('${dest}' + location.search + location.hash);</script>
</head>
<body>
  <p>This open call has moved to <a href="${dest}">${dest}</a>.</p>
</body>
</html>`;
  writeGenerated(`${from}/index.html`, html);
  console.log(`  Redirect: ${from} -> ${to}`);
});

// Warn about stale HTML files (never auto-delete — pages may be indexed/bookmarked)
// Fix noindex on stale pages — Google flags these as "Excluded by noindex tag"
const staleFiles = [];
function findStale(dir) {
  if (!fs.existsSync(dir)) return;
  const ignoredDirs = new Set(['.git', 'node_modules', '.wrangler']);
  fs.readdirSync(dir).forEach(item => {
    if (item.startsWith('.')) return;
    const fp = path.join(dir, item);
    if (fs.statSync(fp).isDirectory()) {
      if (ignoredDirs.has(item)) return;
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

  // Ensure stale pages carry exactly one noindex robots tag. Match any existing
  // directive ("noindex, follow", "index, follow", etc.) and collapse duplicates
  // — string-exact checks miss variants and leave conflicting tags behind.
  const robotsTags = html.match(/\s*<meta name="robots" content="[^"]*">/g) || [];
  const alreadyCorrect = robotsTags.length === 1 && /content="noindex">/.test(robotsTags[0]);
  if (!alreadyCorrect) {
    html = html.replace(/\s*<meta name="robots" content="[^"]*">/g, '');
    html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n  <meta name="robots" content="noindex">');
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
