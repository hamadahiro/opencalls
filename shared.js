// ============================================================================
// shared.js — SINGLE SOURCE OF TRUTH for pure logic + data maps used by BOTH
// the browser (cards.js / search.js / call-detail.js) and the Node build
// (generate-pages.js). Define each thing ONCE here; never copy it elsewhere.
//
// Loading model:
//   • Browser: <script src="/shared.js"> BEFORE cards.js. Classic script, so
//     the top-level functions/consts land in the shared global scope and are
//     visible to cards.js/search.js/call-detail.js as bare identifiers.
//   • Node: require('./shared.js') — the trailing module.exports guard returns
//     everything. (In the browser `module` is undefined, so the guard is skipped.)
//
// Keep everything here PURE (no DOM, no fs). HTML builders take an `esc`
// function as a parameter so they don't depend on the per-environment escaper.
// ============================================================================

// ---- Data maps ----
const categoryLabel = {
  'photography': 'Photography',
  'exhibition': 'Exhibition',
  'grant': 'Grant',
  'zine': 'Zines & Books',
  'residency': 'Residency',
  'education': 'Education'
};

const categorySlug = {
  photography: 'photography', exhibition: 'exhibitions', grant: 'grants',
  zine: 'zines', residency: 'residencies', education: 'education'
};

const prizeCategoryLabel = {
  'cash': 'Cash prize',
  'exhibition': 'Exhibition',
  'publication': 'Publication',
  'residency': 'Residency',
  'fellowship': 'Fellowship'
};

const shortCountry = {
  'United Kingdom': 'UK',
  'United States': 'US',
  'United Arab Emirates': 'UAE',
  'Czech Republic': 'Czechia',
  'Bosnia and Herzegovina': 'BiH',
  'North Macedonia': 'N. Macedonia'
};

const countrySlugs = {
  'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates'
};

const eligibilityLabel = {
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
  'minnesota': 'Minnesota only', 'bipoc': 'BIPOC artists',
  'gulf-coast': 'Gulf Coast only', 'spain': 'Spain only', 'india': 'India only',
  '16-plus': '16+', '18-plus': '18+', '21-plus': '21+', '25-plus': '25+', '45-plus': '45+', '65-plus': '65+',
  'student': 'Students', 'ukraine': 'Ukraine only', 'flinta': 'FLINTA', 'global-south': 'Global South', 'france': 'France only',
  'tri-state': 'NY/NJ/CT only', 'wana': 'WANA region only',
  'bay-area': 'Bay Area only', 'chicago-area': 'Chicago Area only', 'los-angeles': 'LA only',
  'new-york-state': 'NY State only', 'kazakhstan': 'Kazakhstan only', 'mid-career': 'Mid-career',
  'united-kingdom': 'UK only'
};

// ---- Pure functions ----
function isCallOpen(deadline) {
  if (deadline === 'Continuous') return true;
  const end = new Date(deadline + 'T00:00:00');
  end.setDate(end.getDate() + 1);
  return end > new Date();
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function shortenLocation(loc) {
  if (!loc) return loc;
  let s = loc.replace(/,\s*USA$/, '');
  for (const [full, sh] of Object.entries(shortCountry)) s = s.replace(full, sh);
  return s;
}

// `prize` is split on " + " into one chip per part (renderer appends an icon).
// Use " + " ONLY to separate DISTINCT prizes; never put a literal + inside one.
function splitPrizeParts(prize) {
  if (!prize) return [];
  return prize.split(/\s*\+\s*/).map(s => { s = s.trim(); return s.charAt(0).toUpperCase() + s.slice(1); }).filter(Boolean);
}

function derivePrizeCategory(text) {
  const p = text.toLowerCase();
  if (/[$€£¥]|chf\b|sek\b|aud\b|twd\b|rub\b|nok\b|aed\b|zar\b|\br\s?\d|stipend|budget|gear|payment|voucher/.test(p)) return 'cash';
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

// Maps a free-text requirements string to a single browse bucket slug.
function deriveRequirementBucket(r) {
  if (!r) return null;
  const s = r.toLowerCase();
  if (/photobook|book dummy|\bbook\b|\bzine\b|photo book|dummy/.test(s)) return 'photobook';
  if (/proposal|intent|budget|project pdf|project in progress|solo exhibit|\bapplication\b/.test(s)) return 'proposal';
  if (/unlimited|no limit/.test(s)) return 'unlimited';
  if (/portfolio|work sample|body of work|cohesive|\bproject\b|\bseries\b|photo essay|looks/.test(s)) return 'portfolio';
  const nums = (s.match(/\d+/g) || []).map(Number);
  if (nums.length) {
    const m = Math.max.apply(null, nums);
    if (m <= 1) return '1-image';
    if (m <= 5) return '2-5-images';
    if (m <= 10) return '6-10-images';
    if (m <= 20) return '11-20-images';
    return '21-plus-images';
  }
  if (/single|1 photo|one photo/.test(s)) return '1-image';
  return 'portfolio';
}

// Compact fee for chips. Full fee is kept on the detail page + chip tooltip.
//   Free… -> "Free"/"Free*"; clean "X–Y" range kept; else first amount + "+"
//   (entry floor, never understated); bare fee shown as-is; unknown currency as-is.
function shortenFee(fee) {
  if (!fee) return fee;
  var s = String(fee).trim();
  var strip = function(n) { return n.replace(/\.0+$/, ''); };
  if (/^free/i.test(s)) {
    var rest = s.replace(/^free/i, '');
    return /[£$€¥R]\s?\d|\bif\b|select|accept|finalist|shortlist/i.test(rest) ? 'Free*' : 'Free';
  }
  var range = s.match(/^([£$€¥R])\s?(\d[\d.,]*)\s*[–-]\s*([£$€¥R])?\s?(\d[\d.,]*)$/);
  if (range) return range[1] + strip(range[2]) + '–' + (range[3] || range[1]) + strip(range[4]);
  // R is a currency (Rand) ONLY before a digit — otherwise a capital-R word
  // (e.g. "Regular $35") would be grabbed as the symbol and break extraction.
  var sym = (s.match(/[£$€¥]|R(?=\s?\d)/) || [])[0];
  if (!sym) return s;
  var first = s.match(new RegExp('\\' + sym + '\\s?(\\d[\\d.,]*)'));
  if (!first) return s;
  var amount = sym + strip(first[1]);
  var isBare = new RegExp('^\\' + sym + '\\s?\\d[\\d.,]*( fee)?$', 'i').test(s);
  return isBare ? amount : amount + '+';
}

// Fee chip (compact) — full fee kept in a title tooltip when shortened. Takes
// the environment's HTML escaper as `esc`.
function feeChip(fee, esc) {
  const feeShort = shortenFee(fee);
  const href = fee.toLowerCase().startsWith('free') ? '/fees/free/' : '/fees/entry-fee/';
  // Append " fee" only to a money amount (currency symbol + digit). Must include
  // R (Rand) to match shortenFee's currency class — otherwise "R250+" loses " fee".
  const body = /^[£$€¥R]\d/.test(feeShort) ? feeShort + ' fee' : feeShort;
  const title = feeShort !== fee ? ` title="${esc(fee)}"` : '';
  return `<a href="${href}" class="meta-tag meta-tag-link"${title}>${esc(body)}</a>`;
}

// "Submit via" row: collapse 77 raw values to honest methods + link the real
// target. Website (forms/platforms/apps), Email, Post, or a recognizable service
// kept by name (Dropbox, Google Drive, Instagram, WeTransfer). Combos collapse to
// their primary online method. target: submitUrl > mailto(email intent) > url > email.
function submitViaLink(call, esc) {
  const s = (call.submitVia || '').toLowerCase().trim();
  if (!s) return '';
  let label;
  if (/\b(post|postal)\b|physical|parcel/.test(s) && !/website|online|form|platform|portal|email|dropbox|drive|instagram|wetransfer|app/.test(s)) label = 'Post';
  else if (/website|online|form|platform|portal/.test(s)) label = 'Website';
  else if (/email/.test(s)) label = 'Email';
  else if (/wetransfer|swisstransfer/.test(s)) label = 'WeTransfer';
  else if (/instagram/.test(s)) label = 'Instagram';
  else if (/dropbox/.test(s)) label = 'Dropbox';
  else if (/google drive/.test(s)) label = 'Google Drive';
  else label = 'Website';

  const emailIntent = /email|wetransfer|swisstransfer/.test(s);
  let href = null;
  if (call.submitUrl) href = call.submitUrl;
  else if (emailIntent && call.email) href = 'mailto:' + call.email;
  else if (call.url) href = call.url;
  else if (call.email) href = 'mailto:' + call.email;

  if (!isCallOpen(call.deadline) || !href) return esc(label);
  const isMail = href.slice(0, 7) === 'mailto:';
  const title = call.submitVia && call.submitVia !== label ? ` title="${esc(call.submitVia)}"` : '';
  return `<a href="${esc(href)}"${isMail ? '' : ' target="_blank"'} rel="nofollow noopener"${title}>${esc(label)}</a>`;
}

// ---- Shared SVG glyphs ----
const PIN_SVG = '<svg class="pin-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
const PRIZE_SVG = '<svg class="pin-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>';

function getCountry(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

// Wrap a long value onto two lines for the info grid. Takes the env escaper.
function tagHtml(str, minLen, esc) {
  minLen = minLen || 25;
  if (!str || str.length <= minLen) return esc(str || '');
  const words = str.split(' ');
  if (words.length <= 2) return esc(str);
  const splitAt = Math.ceil(words.length * 0.6);
  const front = words.slice(0, splitAt).join(' ');
  const back = words.slice(splitAt).join(' ');
  return `<span class="tag-front">${esc(front)}</span> <span class="tag-back">${esc(back)}</span>`;
}

// Meta-tag row for a card. opts = { esc, urgency, locationLink }
//   urgency = { deadlineSlug, urgencyClass, urgencyText }
//   locationLink = (location, country) => href|null  (env-specific page lookup:
//     client uses injected countryPages/statePages; build uses PRECOMPUTED sets)
function renderTags(call, opts) {
  const esc = opts.esc, u = opts.urgency || {}, locationLink = opts.locationLink;
  const tags = [];
  if (u.deadlineSlug) tags.push(`<a href="/deadlines/${u.deadlineSlug}/" class="call-deadline ${u.urgencyClass}">${esc(u.urgencyText)}</a>`);
  else tags.push(`<span class="call-deadline ${u.urgencyClass}">${esc(u.urgencyText)}</span>`);
  if (call.prize) splitPrizeParts(call.prize).forEach(part => {
    const cat = derivePrizeCategory(part);
    const href = cat ? '/prize/' + cat + '/' : '/prize/';
    tags.push(`<a href="${href}" class="meta-tag meta-tag-link call-prize">${PRIZE_SVG}${esc(part)}</a>`);
  });
  if (call.fee) tags.push(feeChip(call.fee, esc));
  if (call.location) {
    const country = getCountry(call.location);
    const locLink = locationLink ? locationLink(call.location, country) : null;
    const locDisplay = shortenLocation(call.location);
    if (locLink) tags.push(`<a href="${locLink}" class="meta-tag meta-tag-link">${PIN_SVG}${esc(locDisplay)}</a>`);
    else tags.push(`<span class="meta-tag">${PIN_SVG}${esc(locDisplay)}</span>`);
  }
  tags.push(`<a href="/${categorySlug[call.category]}/" class="meta-tag meta-tag-link">${esc(categoryLabel[call.category] || call.category)}</a>`);
  if (call.eligibility && call.eligibility.length) call.eligibility.forEach(e => {
    tags.push(`<a href="/eligibility/${e}/" class="meta-tag meta-tag-link eligibility-tag">${esc(eligibilityLabel[e] || e)}</a>`);
  });
  return tags.join(' ');
}

// The "Prize / Prizes" block under a detail-page title. Takes the env escaper.
function buildPrizeBlock(call, esc) {
  if (!call.prize) return '';
  const parts = splitPrizeParts(call.prize);
  const label = parts.length > 1 ? 'Prizes' : 'Prize';
  const tags = parts.map(part => {
    const cat = derivePrizeCategory(part);
    const href = cat ? '/prize/' + cat + '/' : '/prize/';
    return `<a href="${href}" class="meta-tag meta-tag-link call-prize">${PRIZE_SVG}${esc(part)}</a>`;
  }).join(' ');
  return `<div class="call-detail-prize"><span class="call-detail-prize-label"><a href="/prize/">${label}</a></span> ${tags}</div>`;
}

// Detail-page info grid (deadline/fee/prize/location/etc.). opts = { esc, locationLink }
function renderInfoGrid(call, opts) {
  const esc = opts.esc, locationLink = opts.locationLink;
  function infoRow(label, value) {
    return `<div class="info-row"><span class="info-label">${label}</span><span class="dots"></span><span class="info-value">${value}</span></div>`;
  }
  function infoVal(str) { return tagHtml(str, 20, esc); }
  function infoLink(href, str) { const h = href.endsWith('/') ? href : href + '/'; return `<a href="${h}" title="${esc(str)}">${infoVal(str)}</a>`; }

  const rows = [];

  const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
    new Date(call.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let dlSlug = null;
  if (call.deadline !== 'Continuous') {
    const d = new Date(call.deadline + 'T00:00:00');
    dlSlug = ['january','february','march','april','may','june','july','august','september','october','november','december'][d.getMonth()] + '-' + d.getFullYear();
  }
  rows.push(infoRow('<a href="/deadlines/">Deadline</a>', dlSlug ? infoLink('/deadlines/' + dlSlug, deadlineText) : infoVal(deadlineText)));

  if (call.resultsDate) {
    const resultsPast = (function(s) {
      const months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11,jan:0,feb:1,mar:2,apr:3,jun:5,jul:6,aug:7,sep:8,sept:8,oct:9,nov:10,dec:11};
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
    rows.push(infoRow('Results', esc(call.resultsDate) + (resultsPast ? ' (announced)' : '')));
  }

  if (call.fee) {
    const feeHtml = call.fee.toLowerCase().startsWith('free')
      ? infoLink('/fees/free', call.fee)
      : infoLink('/fees/entry-fee', call.fee);
    rows.push(infoRow('<a href="/fees/">Entry fee</a>', feeHtml));
  }

  if (call.eligibility && call.eligibility.length) {
    const eligHtml = call.eligibility.map(e => infoLink('/eligibility/' + e, eligibilityLabel[e] || e)).join(', ');
    rows.push(infoRow('<a href="/eligibility/">Eligibility</a>', eligHtml));
  }

  if (call.location) {
    const country = getCountry(call.location);
    const locLink = locationLink ? locationLink(call.location, country) : null;
    const locShort = shortenLocation(call.location);
    rows.push(infoRow('<a href="/locations/">Location</a>', locLink ? infoLink(locLink, locShort) : infoVal(locShort)));
  }

  if (call.requirements) {
    const reqBucket = deriveRequirementBucket(call.requirements);
    rows.push(infoRow('<a href="/requirements/">Requirements</a>', reqBucket ? infoLink('/requirements/' + reqBucket, call.requirements) : infoVal(call.requirements)));
  }

  if (call.ai && call.ai !== 'Not specified') rows.push(infoRow('AI policy', infoVal(call.ai)));

  if (call.submitVia) rows.push(infoRow('Submit via', submitViaLink(call, esc)));

  return rows.join('');
}

function isFree(fee) { return fee && fee.toLowerCase().startsWith('free'); }

// US state from "City, ST, USA" (empty otherwise).
function getState(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts.length >= 3 ? parts[parts.length - 2].trim() : '';
}

// "More like this" relevance score between two calls. One copy (was duplicated
// as scoreSimilarity in call-detail.js and scoreSimilarityStatic in the build,
// which had already drifted on the deadline null-guard and the dead Online branch).
function scoreSimilarity(current, other) {
  let score = 0;
  const curElig = current.eligibility || [];
  const othElig = other.eligibility || [];
  curElig.forEach(tag => { if (othElig.includes(tag)) score += 5; });
  if (current.category === other.category) score += 4; else score -= 3;
  const curCountry = getCountry(current.location);
  const othCountry = getCountry(other.location);
  if (curCountry === 'USA' && othCountry === 'USA') {
    const curState = getState(current.location);
    const othState = getState(other.location);
    if (curState && curState === othState) score += 3; else score += 2;
  } else if (curCountry && curCountry === othCountry) {
    score += 2;
  }
  const curFree = isFree(current.fee);
  const othFree = isFree(other.fee);
  if (curFree && othFree) score += 1;
  if (!curFree && !othFree) score += 1;
  if (current.deadline !== 'Continuous' && other.deadline !== 'Continuous' && current.deadline && other.deadline) {
    const diff = Math.abs(new Date(current.deadline + 'T00:00:00') - new Date(other.deadline + 'T00:00:00')) / (1000 * 60 * 60 * 24);
    if (diff <= 30) score += 1;
  }
  if (current.org === other.org) score += 2;
  return score;
}

// ---- Data validators (shared by the build's hard gates AND verify-batch.js, so
//      the verifier flags exactly what the build would reject — no drift) ----
function isValidEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim()); }
function isValidHttpUrl(s) { return /^https?:\/\/.+/i.test(String(s || '').trim()); }
// submitVia values that name a SaaS submission platform and therefore REQUIRE a
// submitUrl (the link can't fall back to email/website and still be the platform).
function submitViaIsPlatform(submitVia) {
  return /^(picter|submittable|cafe|slideroom|jotform|typeform|entrythingy|smarter\s?entry|zealous|paperform|cognito forms|formsite|surveymonkey|artcall|google forms?|fillout|goethe application portal)$/i.test(String(submitVia || '').trim());
}

// Node export guard (no-op in the browser, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    categoryLabel, categorySlug, prizeCategoryLabel, shortCountry, countrySlugs, eligibilityLabel,
    PIN_SVG, PRIZE_SVG,
    isCallOpen, slugify, shortenLocation, splitPrizeParts, derivePrizeCategory, derivePrizeCategories,
    deriveRequirementBucket, shortenFee, feeChip, submitViaLink,
    getCountry, tagHtml, renderTags, renderInfoGrid, buildPrizeBlock,
    isFree, getState, scoreSimilarity,
    isValidEmail, isValidHttpUrl, submitViaIsPlatform
  };
}
