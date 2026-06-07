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
  if (range) return range[1] + strip(range[2]) + '–' + range[1] + strip(range[4]);
  var sym = (s.match(/[£$€¥R]/) || [])[0];
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
  const body = /^[£$€¥]/.test(feeShort) ? feeShort + ' fee' : feeShort;
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

// Node export guard (no-op in the browser, where `module` is undefined).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    categoryLabel, categorySlug, prizeCategoryLabel, shortCountry, countrySlugs, eligibilityLabel,
    isCallOpen, slugify, shortenLocation, splitPrizeParts, derivePrizeCategory, derivePrizeCategories,
    deriveRequirementBucket, shortenFee, feeChip, submitViaLink
  };
}
