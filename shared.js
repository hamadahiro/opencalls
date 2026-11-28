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
// The country slot's short forms spelled out, for search (cards.js suggestions and chips, the home search).
const countryLongNames = { USA: 'United States', UK: 'United Kingdom', UAE: 'United Arab Emirates' };

// Canonical set of accepted values for the country slot (the last comma part of
// a location). The build validates every location's country against this set, so
// a typo ("Germny") or a US state left in the country slot ("Lanesboro, MN") can
// never silently mint a junk single-segment page. Spellings follow site
// convention: 'USA' (not "United States"), 'United Kingdom' (not "UK"),
// 'United Arab Emirates', 'Czech Republic'. UK locations MUST use 'United
// Kingdom' — England/Scotland/Wales are intentionally absent so calls don't
// fragment across /scotland/ + /united-kingdom/. 'Northern Ireland' is
// grandfathered (already in use). To add a genuinely new country, add it here.
const validCountries = new Set([
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia',
  'Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium',
  'Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad',
  'Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea',
  'Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany',
  'Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hong Kong',
  'Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica',
  'Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon',
  'Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Macau','Madagascar','Malawi',
  'Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia',
  'Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal',
  'Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Northern Ireland',
  'Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines',
  'Poland','Portugal','Puerto Rico','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia',
  'Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal',
  'Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia',
  'South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland',
  'Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago',
  'Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom',
  'Uruguay','USA','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
]);

// US state abbreviation → full name. ONE copy — consumed by generate-pages.js
// (state pages + the country page's embedded state-index script) and any client
// code, so the map can never drift between server and browser.
const usStateNames = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};
// Reverse lookup: full state name → abbreviation (e.g. 'California' → 'CA').
const stateNameToAbbr = {};
Object.keys(usStateNames).forEach(abbr => { stateNameToAbbr[usStateNames[abbr]] = abbr; });

const eligibilityLabel = {
  'women': 'Women', 'non-binary': 'Non-binary', 'united-states': 'US only', 'europe': 'Europe only', 'italy': 'Italy only',
  'emerging': 'Emerging artists', 'under-25': 'Under 25', 'under-30': 'Under 30', 'under-35': 'Under 35', 'under-40': 'Under 40', 'under-45': 'Under 45',
  'lgbtq': 'LGBTQ+', 'analog-photography': 'Analog only', 'alternative-process': 'Alternative process',
  'professional': 'Professional only', 'membership-required': 'Membership required',
  'puerto-rico': 'Puerto Rico focus', 'latin-america': 'Latin America', 'asian-american': 'Asian American focus',
  'south-asian': 'South Asian focus', 'african-diaspora': 'African diaspora focus', 'nigerian-diaspora': 'Nigerian diaspora only', 'black': 'Black artists',
  'neurodivergent-disabled': 'Neurodivergent & disabled', 'immigrant': 'Immigrant artists', 'jewish': 'Jewish community focus', 'portugal': 'Portugal only', 'portugal-lusophone-africa': 'Portugal & Lusophone Africa only', 'taiwan': 'Taiwan only',
  'morocco': 'Morocco only', 'non-european': 'Non-European only', 'australia': 'Australia only', 'south-australia': 'South Australia only', 'nsw-act': 'NSW & ACT only',
  'australia-new-zealand': 'Australia & NZ only', 'new-zealand': 'New Zealand only',
  'europe-mediterranean': 'Europe & Mediterranean only',
  'canada': 'Canada only', 'us-canada': 'US & Canada only', 'north-america': 'US, Canada & Mexico only', 'ireland': 'Ireland only', 'switzerland': 'Switzerland only', 'netherlands': 'Netherlands only', 'belgium': 'Belgium only',
  'caribbean': 'Caribbean focus', 'nordic': 'Nordic only', 'copenhagen': 'Copenhagen only', 'cologne': 'Cologne only', 'germany': 'Germany only', 'sweden': 'Sweden only', 'malta': 'Malta only', 'bulgaria': 'Bulgaria only',
  'baltics-finland': 'Baltics & Finland', 'baltic-states': 'Baltic states only', 'lithuania': 'Lithuania only', 'argentina': 'Argentina only', 'commonwealth': 'Commonwealth only', 'qatar': 'Qatar only', 'greece': 'Greece only',
  '6-21': 'Ages 6–21', '8-18': 'Ages 8–18', '8-22': 'Ages 8–22', '10-18': 'Ages 10–18', '12-25': 'Ages 12–25', '13-25': 'Ages 13–25', 'singapore': 'Singapore only', 'philippines': 'Philippines only', 'mid-atlantic-us': 'Mid-Atlantic US', 'alaska': 'Alaska only',
  'hong-kong-macau': 'Hong Kong & Macau only',
  'hawaii-island': 'Hawaiʻi Island only',
  'pacific-northwest': 'Pacific Northwest only',
  'minnesota': 'Minnesota only', 'bipoc': 'BIPOC artists', 'ontario': 'Ontario only',
  'indiana': 'Indiana only', 'ohio': 'Ohio only', 'lakewood-co': 'Lakewood, CO only', 'kentucky': 'Kentucky only', 'alabama': 'Alabama only', '14-18': 'Ages 14–18', '18-26': 'Ages 18–26', '14-24': 'Ages 14–24', '16-25': 'Ages 16–25', '14-29': 'Ages 14–29',
  '18-35': 'Ages 18–35', 'germany-austria-switzerland': 'Germany, Austria & Switzerland only',
  'gulf-coast': 'Gulf Coast only', 'spain': 'Spain only', 'india': 'India only', 'south-africa': 'South Africa only', 'nigeria': 'Nigeria only', 'israel': 'Israel only',
  '14-plus': '14+', '15-plus': '15+', '16-plus': '16+', '18-plus': '18+', '19-plus': '19+', '21-plus': '21+', '23-plus': '23+', '25-plus': '25+', '30-plus': '30+', '40-plus': '40+', '45-plus': '45+', '60-plus': '60+', '65-plus': '65+',
  'student': 'Students', 'ukraine': 'Ukraine only', 'belarus': 'Belarus only', 'flinta': 'FLINTA', 'global-south': 'Global South', 'france': 'France only',
  'tri-state': 'NY/NJ/CT only', 'wana': 'WANA region only', 'southeast-asia': 'Southeast Asia only', 'north-africa': 'North Africa only', 'central-west-africa': 'Central & West Africa only',
  'bay-area': 'Bay Area only', 'chicago-area': 'Chicago Area only', 'cincinnati-area': 'Cincinnati Area only', 'dayton-area': 'Dayton Area only', 'northeast-ohio': 'Northeast Ohio only', 'los-angeles': 'LA only', 'portland-area': 'Portland Area only',
  'atlanta-area': 'Atlanta Area only', 'charlotte-area': 'Charlotte Area only', 'houston-area': 'Houston Area only', 'stamford-area': 'Stamford Area only', 'providence-area': 'Providence Area only', 'va-wv-md-dc-nc': 'VA, WV, MD, DC & NC only',
  'boston-area': 'Boston Area only', 'twin-cities-area': 'Twin Cities Area only', 'waco-area': 'Waco Area only', 'abilene-area': 'Abilene Area only', 'west-michigan': 'West Michigan only', 'sioux-falls-area': 'Sioux Falls Area only', 'chippewa-valley': 'Chippewa Valley only', 'hudson-valley': 'Hudson Valley only', 'inland-empire': 'Inland Empire only', 'inland-northwest': 'Inland Northwest only', 'kansas-region': 'Kansas region only', 'philadelphia': 'Philadelphia only',
  'new-york-city': 'NYC only', 'new-york-state': 'NY State only', 'central-new-york': 'Central NY only', 'western-new-york': 'Western NY only', 'san-ramon': 'San Ramon only', 'greensboro': 'Greensboro only', 'kazakhstan': 'Kazakhstan only', 'mid-career': 'Mid-career',
  'united-kingdom': 'UK only', 'midwest-us': 'Midwest US only', 'western-us': 'Western US only',
  'japan': 'Japan only', 'southeast-us': 'Southeast US only',
  'england': 'England only', 'north-east-england': 'North East England only', 'wales': 'Wales only', 'london': 'London only',
  'oxfordshire': 'Oxfordshire only', 'south-west-england': 'South West England only',
  'lower-austria': 'Lower Austria only',
  'maritimes': 'Maritimes only',
  'metro-vancouver': 'Metro Vancouver only',
  'california': 'California only', 'colorado': 'Colorado only', 'new-jersey': 'New Jersey only', 'montana': 'Montana only', 'texas': 'Texas only', 'washington': 'Washington only', 'oklahoma': 'Oklahoma only', 'south-dakota': 'South Dakota only',
  'arkansas': 'Arkansas only', 'baltimore-region': 'Baltimore region only', 'washington-dc': 'Washington, DC only', 'dc-maryland-virginia': 'DC, Maryland & Virginia only', 'frederick-county-md': 'Frederick County, MD only', 'palm-beach-county': 'Palm Beach County, FL only', 'ventura-county': 'Ventura County, CA only', 'prince-georges-county-md': "Prince George's County, MD only", 'mercer-county-nj': 'Mercer County, NJ only', 'st-joseph-region': 'St. Joseph region only', 'st-louis-region': 'St. Louis region only', 'southern-illinois': 'Southern Illinois only', 'southwest-us': 'Southwest US only',
  'virginia': 'Virginia only', 'roanoke-area': 'Roanoke area only', 'richmond-area': 'Richmond area only', 'arizona': 'Arizona only', 'utah': 'Utah only', 'georgia': 'Georgia only', 'native-american': 'Native American artists',
  'sonoma-county': 'Sonoma County only', 'boulder-area': 'Boulder Area only', 'northern-california': 'Northern California only', 'southern-california': 'Southern California only', 'tampa-bay': 'Tampa Bay only',
  'new-mexico': 'New Mexico only', 'massachusetts-rhode-island': 'MA & RI only', 'cape-cod-and-islands': 'Cape Cod & Islands only', 'new-england': 'New England only',
  'connecticut': 'Connecticut only',
  'berkshires': 'Berkshires area only',
  'northeast-us': 'Northeast US only',
  'oregon': 'Oregon only', 'idaho': 'Idaho only', 'great-lakes': 'Great Lakes only',
  'wisconsin': 'Wisconsin only', 'vermont': 'Vermont only', 'new-hampshire-vermont': 'NH & VT only', 'central-us': 'MO/KS/IA/NE/AR/OK/TX only', 'ks-ne-mo-ok-co': 'KS/NE/MO/OK/CO only', 'mn-ia-wi': 'MN/IA/WI only', 'wi-ia-mn-il-mi': 'WI/IA/MN/IL/MI only', 'in-oh-il-mi-ky-mo-ia-wi-ks-ne': 'IN/OH/IL/MI/KY/MO/IA/WI/KS/NE only', 'continental-us': 'Continental US only',
  'michigan': 'Michigan only', 'florida': 'Florida only', 'ark-la-tex': 'AR/LA/OK/TX only', 'de-pa-md-nj-va-dc': 'DE/PA/MD/NJ/VA/DC only', 'detroit-area': 'Metro Detroit only',
  'south-central-us': 'AR/LA/NM/OK/TX only',
  'curators': 'Curators & academics', 'art-educators': 'Art educators', 'scientists': 'Scientists', 'military-community': 'Military community'
};

// ---- TAG LIMITS — owner 2026-11-16: "tags is for 1 or sometimes 2 words not whole sentences".
// Every chip in a card's tag row goes through cardTagTexts() below, and the build refuses
// any call whose chips break these limits (generate-pages.js). Do not loosen them without
// the owner's own words. A money amount ("$1,000", "CHF 750") counts as one word; "&" is
// not a word. A place may use 3 words ("San Diego, CA").
const TAG_MAX_WORDS = 2;
const TAG_MAX_CHARS = 20;
const TAG_MONEY = /(?:[$€£¥]|\b(?:CHF|SEK|NOK|DKK|AUD|CAD|NZD|USD|EUR|GBP|ISK|HKD|SGD|JPY|TWD|ZAR|AED|RMB|CNY|PLN|CZK|HUF|INR|KRW|MXN|BRL|R)\s?)\d[\d.,]*(?:\s?[kKmM]\b)?/g;
function tagWords(s) {
  return String(s || '').replace(TAG_MONEY, 'X').split(/\s+/).filter(w => w && w !== '&').length;
}
function tagFits(s, maxWords) {
  s = String(s || '');
  return s.length > 0 && tagWords(s) <= (maxWords || TAG_MAX_WORDS) && s.length <= TAG_MAX_CHARS;
}
// Chip labels for eligibility values whose full label (kept on facet pages and the
// detail page) is too long for a tag.
const eligibilityTagOverride = {
  'neurodivergent-disabled': 'ND & disabled',
  'portugal-lusophone-africa': 'Lusophone',
  'europe-mediterranean': 'Euro-Med',
  'north-america': 'North America',
  'hong-kong-macau': 'HK & Macau',
  'germany-austria-switzerland': 'DE/AT/CH',
  'central-west-africa': 'Central/West Africa',
  'va-wv-md-dc-nc': 'VA/WV/MD/DC/NC',
  'twin-cities-area': 'Twin Cities',
  'sioux-falls-area': 'Sioux Falls',
  'north-east-england': 'NE England',
  'south-west-england': 'SW England',
  'washington-dc': 'Washington, DC',
  'dc-maryland-virginia': 'DC/MD/VA',
  'frederick-county-md': 'Frederick, MD',
  'palm-beach-county': 'Palm Beach',
  'ventura-county': 'Ventura County',
  'prince-georges-county-md': 'PG County',
  'mercer-county-nj': 'Mercer County',
  'st-joseph-region': 'St. Joseph',
  'st-louis-region': 'St. Louis',
  'native-american': 'Native American',
  'cape-cod-and-islands': 'Cape Cod',
  'in-oh-il-mi-ky-mo-ia-wi-ks-ne': 'Midwest US'
};
function eligibilityTag(e) {
  const full = eligibilityLabel[e] || e;
  if (tagFits(full)) return full;
  if (eligibilityTagOverride[e]) return eligibilityTagOverride[e];
  return full.replace(/\s+(only|focus|area|region|artists)$/i, '');
}
// A prize part longer than a tag shows its category label instead (closed rows written
// before 2026-11-16); open and new rows must carry short prize text themselves (build gate).
function prizeTag(part) {
  if (tagFits(part)) return part;
  return prizeCategoryLabel[derivePrizeCategory(part)] || 'Prize';
}
// Location chip: first place + country/state; anything longer falls back to the last part.
// The detail page keeps the fuller shortenLocation() text.
function tagLocation(loc) {
  const s = shortenLocation(loc);
  if (!s) return s;
  const parts = s.split(',').map(x => x.trim()).filter(Boolean);
  const pair = parts.length > 2 ? parts[0] + ', ' + parts[parts.length - 1] : parts.join(', ');
  return tagFits(pair, 3) ? pair : parts[parts.length - 1];
}

// ---- Pure functions ----
function isCallOpen(deadline) {
  if (deadline === 'Continuous') return true;
  const end = new Date(deadline + 'T00:00:00');
  end.setDate(end.getDate() + 1);
  return end > new Date();
}

// Deadline urgency for a call as of `now`: CSS class, human label, and month
// slug. ONE definition — the client (cards.js processCall) and the server static
// pre-render (generate-pages.js) both consume it, so the buckets/labels Google
// sees in the static HTML can never drift from what the browser re-renders.
const URGENCY_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
// Whole calendar days from the date of `from` to the date of `to`, both read on the local clock. Counted on the dates
// (Date.UTC of each), not in milliseconds: a day with a clock change is 23 or 25 hours long, and dividing hours by 24 gave
// "3 days left" for 2 at 00:30 on 2027-10-31 in Lisbon, and "Closed" an hour before the deadline day ended.
function calendarDaysBetween(from, to) {
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 864e5);
}
function computeUrgency(call, now) {
  const deadlineDate = call.deadline === 'Continuous' ? null : new Date(call.deadline + 'T00:00:00');
  const daysLeft = deadlineDate ? calendarDaysBetween(now, deadlineDate) : null;
  let urgencyClass = '', urgencyText = '';
  if (call.deadline === 'Continuous') { urgencyText = 'Continuous'; urgencyClass = 'rolling'; }
  else if (daysLeft < 0) { urgencyText = 'Closed'; urgencyClass = 'closed'; }
  else if (daysLeft === 0) { urgencyText = 'Ending today'; urgencyClass = 'ending'; }
  else if (daysLeft === 1) { urgencyText = 'Ending tomorrow'; urgencyClass = 'ending'; }
  else if (daysLeft <= 14) { urgencyText = daysLeft + ' days left'; urgencyClass = 'urgent'; }
  else if (daysLeft <= 30) { urgencyText = daysLeft + ' days left'; urgencyClass = 'soon'; }
  else { urgencyText = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); urgencyClass = 'normal'; }
  const deadlineSlug = deadlineDate ? URGENCY_MONTHS[deadlineDate.getMonth()] + '-' + deadlineDate.getFullYear() : null;
  return { deadlineDate, daysLeft, urgencyClass, urgencyText, deadlineSlug };
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// JURY (2026-11-26). A juror's URL keeps the letters of their name: accents are folded first
// ("Awa Konaté" → awa-konate), where slugify() would drop them (awa-konat). Calls and organisers keep slugify().
// A person's slug is stored in jury.json, so changing this function never moves a page.
function personSlug(name) {
  const folded = String(name).replace(/ø/g, 'o').replace(/Ø/g, 'O').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae').replace(/Æ/g, 'AE').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return folded.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// The part of a jury entry that is the person's name: the first place one of their `names` occurs (longest name
// first) where only a short title may come before it ("Dr. ", "Councillor ") and the name ends the entry or is
// followed by a comma, a bracket or a dash. Returns { start, end } or null. The call page links exactly this span;
// the build refuses a linked entry where it is null.
function juryNameSpan(entry, names) {
  const list = [...new Set(names || [])].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const n of list) {
    let from = 0;
    for (;;) {
      const i = entry.indexOf(n, from);
      if (i < 0) break;
      const before = entry.slice(0, i), after = entry.slice(i + n.length);
      const okBefore = i === 0 || (/ $/.test(before) && !/[,(;:|·]/.test(before) && before.trim().split(/\s+/).length <= 3);
      // Post-nominal letters may follow the name: "Sally Varah MBE DL", "Simon Hill HonFRPS, President".
      const okAfter = /^(?: (?=[A-Za-z]*[A-Z][A-Za-z]*[A-Z])[A-Za-z]{2,8})*(?:$|,|;| \(| [–—-] | \||:)/.test(after);
      if (okBefore && okAfter) return { start: i, end: i + n.length };
      from = i + 1;
    }
  }
  return null;
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
  if (/[$€£¥]|chf\b|sek\b|aud\b|twd\b|rub\b|nok\b|aed\b|zar\b|rmb\b|cny\b|\br\s?\d|cash|stipend|budget|gear|camera|equipment|payment|voucher|gift card|subscription/.test(p)) return 'cash';
  if (/fellowship/.test(p)) return 'fellowship';
  if (/residency|accommodation|apartment|housing|studio/.test(p)) return 'residency';
  if (/publication|photobook|catalog|print edition|contributor|book/.test(p)) return 'publication';
  if (/exhibition|representation/.test(p)) return 'exhibition';
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

// AI policy group for /ai-policy/<group>/ from the stored wording (33 wordings,
// 2026-11-23). null = no group (silent, unclear, or about written text only).
//   not-accepted  'Not accepted'
//   accepted      AI work accepted, with or without disclosure or its own category
//   editing-only  AI editing or assistance yes, AI-generated work no
function aiPolicyBucket(ai) {
  const s = (ai || '').toLowerCase().trim();
  if (!s || s === 'not specified' || s === 'not mentioned') return null;
  if (s === 'not accepted') return 'not-accepted';
  if (/categor/.test(s)) return 'accepted';
  if (/generat|substantial|only|not as primary|hybrid|real photograph|modified|mockup/.test(s)) return 'editing-only';
  if (/accepted|must disclose|discouraged/.test(s)) return 'accepted';
  return null;
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

// Compact ENTRY fee for chips (the `fee` field; feeChipText adds the kind and the asterisk). Full fee on the call page
// and in the chip's tooltip.
//   Free… -> "Free"; clean "X–Y" range kept; else first amount + "+" (entry floor, never understated); bare fee as-is.
//   A currency written with letters keeps them: "A$50", "CA$65+", "CA$20+" (from "$20 CAD"), "DKK 100", "CHF 65+" —
//   a lone "$" would read as US dollars (2026-11-25: "A$50" showed as "$50 fee").
function shortenFee(fee) {
  if (!fee) return fee;
  var s = String(fee).trim();
  // a comma or full stop written straight after the amount is punctuation, not part of it ("$40, $7.50 each" -> "$40+")
  var strip = function(n) { return n.replace(/[.,]+$/, '').replace(/\.0+$/, ''); };
  if (/^free/i.test(s)) return 'Free';
  if (/^Fee \(amount not stated\)/i.test(s)) return 'Paid entry';     // a fee is charged, its amount is not stated
  var DOLLAR = { CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', HKD: 'HK$', SGD: 'S$', USD: '$' };
  var CODES = 'CHF|SEK|DKK|NOK|ISK|PLN|CZK|HUF|RON|JPY|INR|ZAR|MXN|BRL|ARS|TWD|MYR|KRW|THB|PHP|IDR|TRY|ILS|AED';
  var cur = null, num = null, to = null, m;
  if ((m = s.match(/^([A-Z]{1,3})\$\s?(\d[\d.,]*)(?:\s*[–-]\s*(?:[A-Z]{1,3}\$)?\s?(\d[\d.,]*))?/))) { cur = m[1] + '$'; num = m[2]; to = m[3]; }
  else if ((m = s.match(/^(CAD|AUD|NZD|HKD|SGD|USD)\s?\$?\s?(\d[\d.,]*)/))) { cur = DOLLAR[m[1]]; num = m[2]; }
  else if ((m = s.match(/^\$\s?(\d[\d.,]*)\s?(CAD|AUD|NZD|HKD|SGD|USD)\b/))) { cur = DOLLAR[m[2]]; num = m[1]; }
  else if ((m = s.match(new RegExp('^(' + CODES + ')\\s?(\\d[\\d.,]*)(?:\\s*[–-]\\s*(\\d[\\d.,]*))?', 'i')))) { cur = m[1].toUpperCase() + ' '; num = m[2]; to = m[3]; }
  // "+" means the price can rise above the amount shown (owner, 2026-11-25, Bora F19: "$30+ fee" was shown for one fixed
  // price): a price per item, "each additional", or a later amount in the same currency that is higher. A lower members'
  // or students' price, a waiver or a free subscriber entry is no "+".
  var rises = function(base, symRe) {
    if (/\bper\b|\badditional\b|\bmore\b/i.test(s)) return true;
    var n0 = parseFloat(strip(base).replace(/,/g, '')), re = new RegExp(symRe + '\\s?(\\d[\\d,]*(?:\\.\\d+)?)', 'g'), a;
    while ((a = re.exec(s))) if (parseFloat(strip(a[1]).replace(/,/g, '')) > n0) return true;
    return false;
  };
  if (cur) {
    var whole = m[0].length >= s.replace(/\s+fee$/i, '').length;
    var curRe = cur.replace(/\$/, '\\$').replace(/ $/, '');
    if (to) return cur + strip(num) + '–' + (cur.slice(-1) === '$' ? cur : '') + strip(to) + (whole || !rises(to, curRe) ? '' : '+');
    return cur + strip(num) + (whole || !rises(num, curRe) ? '' : '+');
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
  return isBare || !rises(first[1], sym === 'R' ? 'R' : '\\' + sym) ? amount : amount + '+';
}

// The kind of fee, read from the two fields (owner, 2026-11-25: "if something is paid at the end its not free"):
//   'free'        — `fee` is Free and there is no `additionalFees`: nothing to pay at any stage;
//   'free-entry'  — `fee` is Free, but `additionalFees` lists a cost (if selected, a membership, more images);
//   'entry'       — `fee` is an amount (with or without `additionalFees`).
// The one reader of the fee: chips, fee pages, search filters, call pages and the build gate all use it.
function feeKind(call) {
  if (!call || !call.fee || /^Not stated$/i.test(String(call.fee).trim())) return null;   // unknown: no chip, on no fee page
  if (/^free/i.test(String(call.fee).trim())) return call.additionalFees ? 'free-entry' : 'free';
  return 'entry';
}
const feePage = { 'free': '/fees/free/', 'free-entry': '/fees/free-entry/', 'entry': '/fees/entry-fee/' };

// The fee chip's words: "Free", "Free entry*", "$30 fee", "$30+ fee", "$30 fee*". The asterisk always means the same:
// there are additional fees, listed on the call page.
function feeChipText(call) {
  const kind = feeKind(call);
  if (!kind) return '';
  if (kind === 'free') return 'Free';
  if (kind === 'free-entry') return 'Free entry*';
  const s = shortenFee(call.fee);
  // " fee" only after a money amount: a symbol, a letter currency ("A$", "CA$", "DKK ") or the Rand before a digit.
  const body = /^(?:[£$€¥₹]|R(?=\d)|[A-Z]{1,3}\$|[A-Z]{3} )\d/.test(s) ? s + ' fee' : s;
  return body + (call.additionalFees ? '*' : '');
}

// Fee chip — the full fees are kept in a title tooltip (desktop) and on the call page. Takes the HTML escaper as `esc`.
function feeChip(call, esc) {
  const text = feeChipText(call);
  const full = call.fee + (call.additionalFees ? '. Additional fees: ' + call.additionalFees : '');
  const title = text !== call.fee ? ` title="${esc(full)}"` : '';
  return `<a href="${feePage[feeKind(call)]}" class="meta-tag meta-tag-link"${title}>${esc(text)}</a>`;
}

// "Submit via" row: collapse 77 raw values to honest methods + link the real
// target. Website (forms/platforms/apps), Email, Post, or a recognizable service
// kept by name (Dropbox, Google Drive, Instagram, WeTransfer). Combos collapse to
// their primary online method. target: submitUrl > mailto(email intent) > url > email.
// Collapse a raw submitVia value to one honest method label. Shared by the link
// (below) and the /submit-via/ facet pages, so grouping never drifts from display.
function submitViaLabel(submitVia) {
  const s = (submitVia || '').toLowerCase().trim();
  if (!s) return '';
  if (/\b(post|postal)\b|physical|parcel/.test(s) && !/website|online|form|platform|portal|email|dropbox|drive|instagram|wetransfer|app/.test(s)) return 'Post';
  if (/website|online|form|platform|portal/.test(s)) return 'Website';
  if (/email/.test(s)) return 'Email';
  if (/wetransfer|swisstransfer/.test(s)) return 'WeTransfer';
  if (/instagram/.test(s)) return 'Instagram';
  if (/dropbox/.test(s)) return 'Dropbox';
  if (/google drive/.test(s)) return 'Google Drive';
  return 'Website';
}

function submitViaLink(call, esc) {
  const s = (call.submitVia || '').toLowerCase().trim();
  if (!s) return '';
  const label = submitViaLabel(call.submitVia);

  // The submission link, else the call's page. No organiser address is ever on a call row (contacts stay private), so
  // there is no mailto: link.
  const href = call.submitUrl || call.url || null;

  if (!isCallOpen(call.deadline) || !href) return `<a href="/submit-via/${slugify(label)}/">${esc(label)}</a>`;
  const title = call.submitVia && call.submitVia !== label ? ` title="${esc(call.submitVia)}"` : '';
  return `<a href="${esc(href)}" target="_blank" rel="nofollow noopener"${title}>${esc(label)}</a>`;
}

function getCountry(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

// The text of every content chip renderTags() shows (deadline and fee chips are built
// from fixed short formats). The build checks each against the TAG LIMITS.
function cardTagTexts(call) {
  const out = [];
  if (call.prize) splitPrizeParts(call.prize).forEach(p => out.push({ kind: 'prize', text: prizeTag(p), raw: p }));
  if (feeKind(call)) out.push({ kind: 'fee', text: feeChipText(call) });
  if (call.location) out.push({ kind: 'location', text: tagLocation(call.location) });
  out.push({ kind: 'category', text: categoryLabel[call.category] || call.category || '' });
  (call.eligibility || []).forEach(e => out.push({ kind: 'eligibility', text: eligibilityTag(e) }));
  return out;
}

// The deadline on a card: the call page's hand-drawn stroke under the words, in the urgency's colour. Closed calls get no stroke.
// mode 'results' (the cards of a results month page): the results date for every call, its stroke while still to come.
function cardDate(call, u, esc, mode) {
  if (mode === 'results') {
    const r = resultsText(call);
    if (r) return `<a href="/results/${resultsMonthSlug(call)}/" class="call-date${r.coming ? ' dl-band dl-results' : ''}">${esc(r.text).replace(/ /g, '&nbsp;')}</a>`;
  }
  const slug = u.deadlineSlug || (call.deadline === 'Continuous' ? 'continuous' : '');
  const results = u.urgencyClass === 'closed' && closedResultsText(call);
  // "Results …" carries the deadline's stroke in green (owner, 2026-11-26: "just underline them in green"); "Closed" none.
  const cls = 'call-date' + (results ? ' dl-band dl-results' : u.urgencyClass && u.urgencyClass !== 'closed' ? ' dl-band dl-' + u.urgencyClass : '');
  return `<a href="${results ? '/results/' + resultsMonthSlug(call) + '/' : '/deadlines/' + slug + '/'}" class="${cls}">${esc(results || u.urgencyText).replace(/ /g, '&nbsp;')}</a>`;
}

// A closed call whose results are still to come says when, in place of "Closed". A day the organiser named reads in the
// deadline's form (computeUrgency: relative up to 30 days, the date beyond): "Results today", "Results tomorrow",
// "Results in 6 days", "Results on Feb 5, 2027" (owner, 2026-11-26: "same absolute/relative date format as for
// deadlines"); any other date in its own words with the year: "Results late December 2026", "Results by Dec 5, 2026".
// Results passed, announced, or with no month: "Closed".
function closedResultsText(call, now) {
  if (!call || isCallOpen(call.deadline)) return null;
  const r = resultsText(call, now);
  return r && r.coming ? r.text : null;
}

// The results date in a card's words, for any call, or null when it names no month. coming: results still to come
// (resultsListed's rule without the closed test) — then a named day reads as a deadline does ("Results in 6 days",
// "Results on Feb 5, 2027") and any other date in its own words with the year ("Results late December 2026"); passed or
// announced: the absolute form, no count ("Results on Oct 30, 2026", "Results in October 2026"). The cards of a results
// month page all say this, the green stroke while still to come (owner, 2026-11-28: a results page showed "Ending
// tomorrow"; "same design like /results/ … absolute/relative format, green underline").
function resultsText(call, now) {
  now = now || new Date();
  const w = resultsWhen(call);
  if (!w) return null;
  const pad = n => String(n).padStart(2, '0');
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const coming = w.kind !== 'announced' && w.last >= today;
  if (coming && w.kind === 'day' && !/ about /.test(w.label)) {
    const d = new Date(w.day + 'T00:00:00');
    const n = calendarDaysBetween(now, d);
    if (n <= 0) return { text: 'Results today', coming };
    if (n === 1) return { text: 'Results tomorrow', coming };
    if (n <= 30) return { text: 'Results in ' + n + ' days', coming };
    return { text: 'Results on ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), coming };
  }
  // A named day already passed (or announced): the absolute form, as a far date reads.
  if (w.day && (w.kind === 'day' || w.kind === 'announced') && !/ about /.test(w.label))
    return { text: 'Results on ' + new Date(w.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), coming };
  const y = w.month.slice(0, 4);
  return { text: /\d{4}$/.test(w.label) ? w.label : /\d$/.test(w.label) ? w.label + ', ' + y : w.label + ' ' + y, coming };
}

// A card under its title: the date opens the description, the other facts (renderTags) stand under it.
// A closed call whose results come on a named day says when (closedResultsText) in place of "Closed".
// opts = { esc, urgency }
function renderCardBody(call, opts) {
  const tags = renderTags(call, opts);
  const date = cardDate(call, opts.urgency || {}, opts.esc, opts.mode);
  return `<p class="call-description">${date} – ${opts.esc(call.summary || call.description)}</p>`
    + (tags ? `<div class="call-meta">${tags}</div>` : '');
}

// The facts of a card as outline chips, all alike: fee, prize (one a part), and who may enter when that is more than an age.
// Category and place are left out: the title or the description says the category on 9 cards of 10, the place on 8.
// opts = { esc }
function renderTags(call, opts) {
  const esc = opts.esc;
  const tags = [];
  if (feeKind(call)) tags.push(feeChip(call, esc));   // no chip when the fee is not stated
  splitPrizeParts(call.prize).filter((p, i, a) => a.findIndex(q => prizeTag(q) === prizeTag(p)) === i).forEach(part => {
    const cat = derivePrizeCategory(part);
    const href = cat ? '/prize/' + cat + '/' : '/prize/';
    tags.push(`<a href="${href}" class="meta-tag meta-tag-link"${prizeTag(part) !== part ? ` title="${esc(part)}"` : ''}>${esc(prizeTag(part))}</a>`);
  });
  (call.eligibility || []).filter(e => !/^\d+-plus$/.test(e)).forEach(e => {
    tags.push(`<a href="/eligibility/${e}/" class="meta-tag meta-tag-link"${eligibilityTag(e) !== (eligibilityLabel[e] || e) ? ` title="${esc(eligibilityLabel[e] || e)}"` : ''}>${esc(eligibilityTag(e))}</a>`);
  });
  return tags.join(' ');
}

// RESULTS — when the organiser says results come, read from the stored text (owner, 2026-11-25: a "Results due" page).
// One reader for the Results pages, the call page's Results link and the build gate.
// Returns { kind, month: 'YYYY-MM', day: 'YYYY-MM-DD' or null, label, last: 'YYYY-MM-DD' } or null when the text names no
// month (a season, "Rolling"). last: the last day the words allow — the date itself (a range, a week, "by": its end);
// early: the 10th; mid: the 20th; first to fourth week: the 7th, 14th, 21st, 28th; a month, late, end of: its last day. kind: day, range, month, part (early/mid/late/end of), by, relative (computed from the deadline or a date).
// label: the card's words — "Results Dec 15", "Results Dec 11–13", "Results by Dec 1", "Results in December",
// "Results late December", "Results about Dec 9".
const RESULTS_MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
function resultsWhen(call) {
  const t = call && call.resultsDate;
  if (!t) return null;
  const MON = {}; RESULTS_MONTHS.forEach((m, i) => { MON[m] = i + 1; MON[m.slice(0, 3)] = i + 1; }); MON.sept = 9;
  const M = '(' + RESULTS_MONTHS.join('|') + '|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\\.?';
  const pad = n => String(n).padStart(2, '0');
  const SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const NAME = m => RESULTS_MONTHS[m - 1][0].toUpperCase() + RESULTS_MONTHS[m - 1].slice(1);
  const UPTO = { early: 10, mid: 20, first: 7, second: 14, third: 21, fourth: 28 };   // the last day of a part of a month; others: its end
  const out = (kind, y, m, d, label, upTo) => ({ kind, month: y + '-' + pad(m), day: d ? y + '-' + pad(m) + '-' + pad(d) : null, label,
    last: y + '-' + pad(m) + '-' + pad(d || upTo || new Date(Date.UTC(y, m, 0)).getUTCDate()) });
  const l = String(t).trim().replace(/–/g, '–').toLowerCase().replace(/^[~≈]\s*/, '');
  const re = s => new RegExp('^' + s + '$');
  let x;
  // "Announced October 30, 2026": results that are out, on the day given — placed in its month (the call page links to
  // that month's results page); never "Results …" on a card (resultsListed).
  if ((x = l.match(/^announced (.+)$/))) {
    const w = resultsWhen({ resultsDate: x[1] });
    return w && w.day ? { ...w, kind: 'announced' } : null;
  }
  if ((x = l.match(/^(\d{4})-(\d{2})-(\d{2})$/))) return out('day', +x[1], +x[2], +x[3], 'Results ' + SHORT[+x[2] - 1] + ' ' + +x[3]);
  const approx = /^(?:on or about |around |approximately |approx\\.? )/.test(l) || /^[~≈]/.test(String(t).trim());
  if ((x = l.match(re('(?:on or about |around |approximately |approx\\.? )?' + M + ' (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})'))))
    return out('day', +x[3], MON[x[1]], +x[2], 'Results ' + (approx ? 'about ' : '') + SHORT[MON[x[1]] - 1] + ' ' + +x[2]);
  if ((x = l.match(re('(\\d{1,2}) ' + M + ',? (\\d{4})')))) return out('day', +x[3], MON[x[2]], +x[1], 'Results ' + SHORT[MON[x[2]] - 1] + ' ' + +x[1]);
  if ((x = l.match(re(M + ' (\\d{1,2})\\s?[–-]\\s?(?:' + M + ' )?(\\d{1,2}),? (\\d{4})')))) {
    const m2 = x[3] ? MON[x[3]] : MON[x[1]];
    return out('range', +x[5], m2, +x[4], 'Results ' + SHORT[MON[x[1]] - 1] + ' ' + +x[2] + '–' + (x[3] ? SHORT[m2 - 1] + ' ' : '') + +x[4]);
  }
  if ((x = l.match(re('(?:on or about |around |approximately )?' + M + ',? (\\d{4})')))) return out('month', +x[2], MON[x[1]], null, 'Results in ' + NAME(MON[x[1]]));
  if ((x = l.match(re('(early|mid|mid-|late|end of|the end of|by the end of|by end of|beginning of|start of) ?' + M + ',? (\\d{4})')))) {
    const part = /^mid/.test(x[1]) ? 'mid-' : /end/.test(x[1]) ? 'end of ' : /early|beginning|start/.test(x[1]) ? 'early ' : 'late ';
    return out('part', +x[3], MON[x[2]], null, 'Results ' + part + NAME(MON[x[2]]), UPTO[part.replace(/\W.*$/, '')]);
  }
  if ((x = l.match(re(M + '\\s?[–-]\\s?' + M + ',? (\\d{4})')))) return out('range', +x[3], MON[x[2]], null, 'Results ' + NAME(MON[x[1]]) + '–' + NAME(MON[x[2]]));
  if ((x = l.match(re('(?:by|before|no later than|not later than) ' + M + ' (\\d{1,2})(?:st|nd|rd|th)?,? (\\d{4})'))))
    return out('by', +x[3], MON[x[1]], +x[2], 'Results by ' + SHORT[MON[x[1]] - 1] + ' ' + +x[2]);
  if ((x = l.match(re('(?:by|before|no later than) ' + M + ',? (\\d{4})')))) return out('by', +x[2], MON[x[1]], null, 'Results by ' + NAME(MON[x[1]]));
  // "Week of December 14, 2026": listed until that week ends.
  if ((x = l.match(re('week of ' + M + ' (\\d{1,2}),? (\\d{4})')))) {
    const e = new Date(Date.UTC(+x[3], MON[x[1]] - 1, +x[2] + 6));
    const day = e.getUTCFullYear() + '-' + pad(e.getUTCMonth() + 1) + '-' + pad(e.getUTCDate());
    return { kind: 'week', month: x[3] + '-' + pad(MON[x[1]]), day, label: 'Results week of ' + SHORT[MON[x[1]] - 1] + ' ' + +x[2], last: day };
  }
  // "First week of December 2026", "Last week of July 2026"
  if ((x = l.match(re('(first|second|third|fourth|last) week of ' + M + ',? (\\d{4})')))) return out('part', +x[3], MON[x[2]], null, 'Results ' + x[1] + ' week of ' + NAME(MON[x[2]]), UPTO[x[1]]);
  // "Early to mid-December 2026", "Early–mid September 2026", "Late October–early November 2026", "Likely end of November 2026"
  if ((x = l.match(re('(early|mid|late)(?: to |–|-)(early|mid|late)-? ?' + M + ',? (\\d{4})')))) return out('part', +x[4], MON[x[3]], null, 'Results ' + x[1] + ' to ' + (x[2] === 'mid' ? 'mid-' : x[2] + ' ') + NAME(MON[x[3]]), UPTO[x[2]]);
  if ((x = l.match(re('(early|mid|late)-? ?' + M + '\\s?[–-]\\s?(early|mid|late)-? ?' + M + ',? (\\d{4})')))) return out('part', +x[5], MON[x[4]], null, 'Results ' + x[1] + ' ' + NAME(MON[x[2]]) + '–' + x[3] + ' ' + NAME(MON[x[4]]), UPTO[x[3]]);
  if ((x = l.match(re('likely (?:the )?end of ' + M + ',? (\\d{4})')))) return out('part', +x[2], MON[x[1]], null, 'Results end of ' + NAME(MON[x[1]]));
  if ((x = l.match(/^by the end of (\d{4})$/))) return out('by', +x[1], 12, 31, 'Results by end of ' + x[1]);
  const N = { one: 1, two: 2, three: 3, four: 4, six: 6 };
  const UNIT = u => /week/.test(u) ? 7 : /month/.test(u) ? 30 : /working|business/.test(u) ? 1.4 : 1;
  const plus = (d, n, u) => {   // working or business days skip Saturdays and Sundays
    const r = new Date(d.getTime());
    if (/working|business/.test(u)) { let k = n; while (k > 0) { r.setUTCDate(r.getUTCDate() + 1); if (r.getUTCDay() % 6) k--; } return r; }
    r.setUTCDate(r.getUTCDate() + Math.round(n * UNIT(u))); return r;
  };
  const byDate = (d) => out('relative', d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 'Results by ' + SHORT[d.getUTCMonth()] + ' ' + d.getUTCDate());
  const fromDate = (kind, d) => out(kind, d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 'Results about ' + SHORT[d.getUTCMonth()] + ' ' + d.getUTCDate());
  // "Within 2 weeks of the deadline", "Within 2–3 weeks of deadline" (the later end), "Within a week of the deadline"
  if ((x = l.match(/^within (?:(\d+|one|two|three|four|six)\s?[–-]\s?)?(\d+|a|one|two|three|four|six) (days?|weeks?|working days?|business days|months?) (?:of|after) (?:the )?(?:deadline|close|closing|submission deadline)$/))
      && /^\d{4}-\d{2}-\d{2}$/.test(call.deadline || ''))
    return byDate(plus(new Date(call.deadline + 'T00:00:00Z'), x[2] === 'a' ? 1 : (N[x[2]] || +x[2]), x[3]));
  // "Five weeks after the November 18 deadline"
  const WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  if ((x = l.match(re('(\\d+|one|two|three|four|five|six|seven|eight|nine|ten) (days?|weeks?) after the ' + M + ' (\\d{1,2}),? (?:(\\d{4}) )?deadline')))) {
    const y = x[5] ? +x[5] : +(call.deadline || '').slice(0, 4);
    if (y) return fromDate('relative', plus(new Date(Date.UTC(y, MON[x[3]] - 1, +x[4])), WORD[x[1]] || +x[1], x[2]));
  }
  if ((x = l.match(re('within (\\d+) (days?|weeks?|working days?|business days) (?:of|after) ' + M + ' (\\d{1,2}),? (\\d{4})'))))
    return byDate(plus(new Date(Date.UTC(+x[5], MON[x[3]] - 1, +x[4])), +x[1], x[2]));
  return null;
}
// A call is on the Results page when it has closed and its results are still to come: until the last day the organiser's
// words allow has passed ("Early November": until Nov 10). The page, the cards and the call page use this one rule.
function resultsListed(call, now) {
  now = now || new Date();
  if (!call || isCallOpen(call.deadline)) return null;
  const w = resultsWhen(call);
  if (!w || w.kind === 'announced') return null;
  const pad = n => String(n).padStart(2, '0');
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  return w.last >= today ? w : null;
}

// The results month page a results date belongs to ("December 6–12, 2026", "Late December 2026" → december-2026), or
// null when the date names no month ("Announced", "Spring 2027"). Cards and the call page link a results date here.
function resultsMonthSlug(call) {
  const w = resultsWhen(call);
  if (!w) return null;
  return RESULTS_MONTHS[+w.month.slice(5, 7) - 1] + '-' + w.month.slice(0, 4);
}

// Detail-page info grid (deadline/prize/fee/location/etc.). opts = { esc, locationLink }
function renderInfoGrid(call, opts) {
  const esc = opts.esc, locationLink = opts.locationLink;
  function infoRow(label, value) {
    return `<div class="info-row"><span class="info-label">${label}</span><span class="dots"></span><span class="info-value">${value}</span></div>`;
  }
  // Full text, wrapping. Not a split into two nowrap halves: they ran past the row's
  // edge on phones and were clipped (owner, 2026-11-23, a long entry fee).
  // <wbr> after a slash: "IN/OH/IL/MI/KY/MO/IA/WI/KS/NE" breaks between codes, not inside one.
  function infoVal(str) { return esc(str || '').replace(/\//g, '/<wbr>'); }
  function infoLink(href, str) { const h = href.endsWith('/') ? href : href + '/'; return `<a href="${h}" title="${esc(str)}">${infoVal(str)}</a>`; }

  const rows = [];

  const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
    new Date(call.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let dlSlug = null;
  if (call.deadline !== 'Continuous') {
    const d = new Date(call.deadline + 'T00:00:00');
    dlSlug = ['january','february','march','april','may','june','july','august','september','october','november','december'][d.getMonth()] + '-' + d.getFullYear();
  }
  rows.push(infoRow('<a href="/deadlines/">Deadline</a>', infoLink('/deadlines/' + (dlSlug || 'continuous'), deadlineText)));

  // Every part in full (the pills on the cards show the short tag), in the order of the data,
  // with the Eligibility row's ", " between them. A part never breaks across lines if it fits the column.
  if (call.prize) {
    const parts = splitPrizeParts(call.prize);
    const prizeHtml = parts.map((p, i) => {
      const cat = derivePrizeCategory(p);
      return `<span class="info-part">${infoLink(cat ? '/prize/' + cat : '/prize', p)}${i < parts.length - 1 ? ',' : ''}</span>`;
    }).join(' ');
    rows.push(infoRow(`<a href="/prize/">${parts.length > 1 ? 'Prizes' : 'Prize'}</a>`, prizeHtml));
  }

  // Two rows (owner, 2026-11-25): what it costs to enter, and every other payment — if selected, a membership, more images.
  if (call.fee) {
    const page = feePage[feeKind(call)];   // none when the fee is "Not stated"
    rows.push(infoRow('<a href="/fees/">Entry fee</a>', page ? infoLink(page, call.fee) : infoVal(call.fee)));
    if (call.additionalFees) rows.push(infoRow('<a href="/fees/">Additional fees</a>', page ? infoLink(page, call.additionalFees) : infoVal(call.additionalFees)));
  }

  // One fact per row, the same on every call page (owner, 2026-11-25): Eligibility says WHO can apply ("Membership
  // required", as on the card and on /eligibility/membership-required/); Additional fees says WHAT IT COSTS ("$45/year
  // WEAD membership" — never "required"). The build keeps the tag and the fee item together (both or neither).
  const elig = call.eligibility || [];
  if (elig.length) {
    const eligHtml = elig.map(e => infoLink('/eligibility/' + e, eligibilityLabel[e] || e)).join(', ');
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

  if (call.ai && call.ai !== 'Not specified') {
    const aiBucket = aiPolicyBucket(call.ai);
    rows.push(infoRow('<a href="/ai-policy/">AI policy</a>', aiBucket ? infoLink('/ai-policy/' + aiBucket, call.ai) : infoVal(call.ai)));
  }

  if (call.submitVia) rows.push(infoRow('<a href="/submit-via/">Submit via</a>', submitViaLink(call, esc)));

  // Results last, on every call: the date as the organiser states it, nothing added (owner, 2026-11-24; "(announced)" was
  // printed from the date alone, audit C01). The label links to the Results page like every label; while the call is on
  // that page (its card says "Results …") the date links there too, written as the Deadline row writes a date, with the
  // cards' green stroke (owner, 2026-11-26: "link results word with results page and match date format and color. dont
  // move the position").
  // The date links to its results month page whenever it names a month (owner, 2026-11-28: results dates linked like
  // deadlines); one with no month ("Announced", "Spring 2027") stays plain, as any value without a page.
  if (call.resultsDate) {
    const month = resultsMonthSlug(call), w = resultsWhen(call);
    const listed = !!closedResultsText(call);
    const oneDay = listed && w.kind === 'day' && !/ about /.test(w.label);
    const text = oneDay ? new Date(w.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : call.resultsDate;
    const val = !month ? infoVal(call.resultsDate)
      : `<a href="/results/${month}/"${listed ? ' class="dl-band dl-results"' : ''} title="${esc(call.resultsDate)}">${infoVal(text)}</a>`;
    rows.push(infoRow('<a href="/results/">Results</a>', val));
  }

  return rows.join('');
}

function isFree(call) { return feeKind(call) === 'free'; }

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
  if (feeKind(current) === feeKind(other)) score += 1;   // the same kind of fee
  if (current.deadline !== 'Continuous' && other.deadline !== 'Continuous' && current.deadline && other.deadline) {
    const diff = Math.abs(new Date(current.deadline + 'T00:00:00') - new Date(other.deadline + 'T00:00:00')) / (1000 * 60 * 60 * 24);
    if (diff <= 30) score += 1;
  }
  if (current.org === other.org) score += 2;
  return score;
}

// ---- Listing-page contract ----
// Every listing page (org, country, state, category, fee, eligibility, prize,
// requirements, submit-via, deadline month) shows EVERY call it covers: the
// open ones first, then the rest under a "Past" header. That way the number
// printed next to a page in any index equals the number of calls on the page —
// they can never disagree. A page with nothing open simply starts with its past
// calls (owner 2026-11-26: no "No open calls right now" sentence anywhere).

// ---- Data validators (shared by the build's hard gates AND verify-batch.js, so
//      the verifier flags exactly what the build would reject — no drift) ----
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
    usStateNames, stateNameToAbbr, validCountries,
    isCallOpen, computeUrgency, slugify, personSlug, juryNameSpan, shortenLocation, splitPrizeParts, derivePrizeCategory, derivePrizeCategories,
    deriveRequirementBucket, aiPolicyBucket, shortenFee, feeKind, feePage, feeChipText, feeChip, submitViaLink, submitViaLabel,
    getCountry, renderTags, renderCardBody, renderInfoGrid,
    isFree, getState, scoreSimilarity,
    isValidHttpUrl, submitViaIsPlatform,
    TAG_MAX_WORDS, TAG_MAX_CHARS, tagWords, tagFits, eligibilityTag, prizeTag, tagLocation, cardTagTexts,
    resultsWhen, RESULTS_MONTHS, resultsListed, closedResultsText, resultsMonthSlug, resultsText
  };
}
