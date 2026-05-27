const EMPTY_MESSAGES = ['Nothing here, for now.','No calls match this search.','Nothing came up this time.','No results, it seems.','No calls found for this.','Nothing fits this search.','No matches at the moment.','Nothing to show here.','No calls in this range.','Nothing here yet.'];
function emptyState() { return '<p class="empty-state">' + EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)] + '<a href="/browse/">Browse all calls &rarr;</a></p>'; }

const shortCountry = {
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
  for (const [full, short] of Object.entries(shortCountry)) {
    s = s.replace(full, short);
  }
  return s;
}

const categoryLabel = {
  'photography': 'Photography',
  'exhibition': 'Exhibition',
  'grant': 'Grant',
  'zine': 'Zines & Books',
  'residency': 'Residency',
  'education': 'Education'
};

const eligibilityLabel = {
  'women': 'Women',
  'united-states': 'US only',
  'europe': 'Europe only',
  'italy': 'Italy only',
  'emerging': 'Emerging artists',
  'under-30': 'Under 30',
  'under-35': 'Under 35',
  'under-40': 'Under 40',
  'lgbtq': 'LGBTQ+',
  'analog-photography': 'Analog only',
  'alternative-process': 'Alternative process',
  'professional': 'Professional only',
  'membership-required': 'Membership required',
  'puerto-rico': 'Puerto Rico focus',
  'latin-america': 'Latin America',
  'asian-american': 'Asian American focus',
  'south-asian': 'South Asian focus',
  'african-diaspora': 'African diaspora focus',
  'black': 'Black artists',
  'neurodivergent-disabled': 'Neurodivergent & disabled',
  'portugal': 'Portugal only',
  'taiwan': 'Taiwan only',
  'morocco': 'Morocco only',
  'non-european': 'Non-European only',
  'australia': 'Australia only',
  'canada': 'Canada only',
  'ireland': 'Ireland only',
  'switzerland': 'Switzerland only',
  'caribbean': 'Caribbean focus',
  'nordic': 'Nordic only',
  'germany': 'Germany only',
  'malta': 'Malta only',
  '10-18': 'Ages 10–18',
  'mid-atlantic-us': 'Mid-Atlantic US',
  'new-york-state': 'NY State only',
  'alaska': 'Alaska only',
  'bay-area': 'Bay Area only',
  'chicago-area': 'Chicago Area only',
  'los-angeles': 'LA only',
  'tri-state': 'NY/NJ/CT only',
  'gulf-coast': 'Gulf Coast only',
  'spain': 'Spain only',
  'india': 'India only',
  '16-plus': '16+',
  '18-plus': '18+',
  '21-plus': '21+',
  '25-plus': '25+',
  '45-plus': '45+',
  'student': 'Students',
  'ukraine': 'Ukraine only',
  'flinta': 'FLINTA',
  'global-south': 'Global South',
  'wana': 'WANA region only',
  'france': 'France only',
  'mid-career': 'Mid-career',
  'united-kingdom': 'UK only',
  'kazakhstan': 'Kazakhstan only'
};

const prizeCategoryLabel = {
  'cash': 'Cash prize',
  'exhibition': 'Exhibition',
  'publication': 'Publication',
  'residency': 'Residency',
  'fellowship': 'Fellowship'
};

function derivePrizeCategory(text) {
  var p = text.toLowerCase();
  if (/[$€£¥]|chf\b|sek\b|aud\b|twd\b|rub\b|stipend|budget|gear|payment|voucher/.test(p)) return 'cash';
  if (/fellowship/.test(p)) return 'fellowship';
  if (/residency|accommodation|apartment/.test(p)) return 'residency';
  if (/publication|photobook|catalog|print edition|contributor|book/.test(p)) return 'publication';
  if (/exhibition/.test(p)) return 'exhibition';
  return null;
}

function derivePrizeCategories(prize) {
  if (!prize) return [];
  var seen = {};
  return splitPrizeParts(prize).map(function(part) { return derivePrizeCategory(part); }).filter(function(c) {
    if (!c || seen[c]) return false;
    seen[c] = true;
    return true;
  });
}

function splitPrizeParts(prize) {
  if (!prize) return [];
  return prize.split(/\s*\+\s*/).map(function(s) { s = s.trim(); return s.charAt(0).toUpperCase() + s.slice(1); }).filter(Boolean);
}

const categorySlug = {
  'photography': 'photography',
  'exhibition': 'exhibitions',
  'grant': 'grants',
  'zine': 'zines',
  'residency': 'residencies',
  'education': 'education'
};

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
const countryPages = ["portugal","united-states","sweden","japan","france","united-kingdom","hungary","online","ukraine","greece","germany","italy","argentina","netherlands","czech-republic","morocco","canada","spain","austria","northern-ireland","switzerland","south-africa","lithuania","singapore","denmark","india","brazil","ireland","australia","north-macedonia","iceland","croatia","estonia","romania","malaysia","russia","bosnia-and-herzegovina","finland","belgium","israel","united-arab-emirates","slovakia","mexico","albania","malta","norway","qatar","poland","spain-international-applicants","south-korea"];
const orgPages = ["encontros-da-imagem","decode-gallery","kult-books","tokyo-arts-and-space-tokas","fluxus-art-projects","project-row-houses","women-alternative-photography-group","eidolon-centre-for-everyday-photography","the-print-center","woman-made-gallery","yachting-monthly","humberlands","women-photograph","royal-photographic-society","ukrainian-house-of-photography","visual-arts-international-festival","lensculture","los-angeles-center-of-photography","the-illume","der-greif","photovogue","black-women-photographers","the-independent-photographer","polygona-kunstverein","p-rez-art-museum-miami","photoworks","east-bay-photo-collective","muus-collection","now-art","slowexposures","atlanta-photography-group","new-orleans-photo-alliance","shots-magazine","southeast-center-for-photography","a-photographer-s-place","photolucida","le-stanze-della-fotografia","photographic-resource-center","vermont-center-for-photography","saveartspace","remarque-print-workshop-gallery","emc-magazine","0-1-gallery","artdoc-photography-magazine","pragovka-gallery","rencontres-de-la-photographie-marrakech","headlands-center-for-the-arts","oak-spring-garden-foundation","fondation-grantham","bureau-of-land-management","sonntag-grant-for-photography","ucross-foundation","scan-international-photography-festival","black-box-gallery","rotlicht-festival","all-about-photo","prairie-ronde-artist-residency","source-photographic-review","festival-panor-mic","alt-1000","phest","yaddo","cuttyhunk-island-artists-residency","glasgow-gallery-of-photography","cape-town-photo-festival","photoartdoc","photometria-international-photography-festival","singapore-international-photography-festival","filter-photo","the-studio-museum-in-harlem","baxter-st-at-ccny","fresh-eyes-gup-magazine","copenhagen-photo-festival","outdoor-photography-magazine","print-swap","l-a-photo-curator","shutter-hub","lucie-foundation","northern-contemporary-gallery","women-s-studio-workshop","beers-london","the-docks","ph21-gallery","decagon-gallery","the-art-center","fine-art-photography-awards","not-just-art","edward-hopper-house-museum","chico-art-center","midwest-center-for-photography","tcg-gallery","soho-photo-gallery","praxis-photo-arts-center","light-art-space","coal","eyes-wide-open","fotohof","frank-lloyd-wright-s-martin-house","loghaven","florida-museum-of-photographic-arts","fotograf-magazine","grenze-arsenali-fotografici","photography-4-humanity","minimalist-photography-awards","villa-lena-foundation","national-portrait-gallery","lisbon-street-photo-fest","the-photo-review","athens-street-photography-festival","rancho-linda-vista","el-local","athens-photo-festival","absuria-festival","co-ex-collaborative","epson-international-pano-awards","remedy-photo-festival","washington-county-museum-of-fine-arts","unstaged","visa-pour-l-image","photosc","italian-cultural-institute-of-s-o-paulo","delfina-foundation","mack","camera-austria","fotodocument","magnum-foundation","photo-museum-ireland","exibart-street","lithuanian-photographers-association","doug-pensinger-photography-fund","museum-of-australian-photography","flanelle-magazine","embracing-our-differences","fotografiska","lumen-prize","fringe-arts-bath","association-camille-lepage-on-est-ensemble","blue-sky-gallery","edition-502","pro-photo-dc","international-women-s-media-foundation","kaleid-gallery","de-pietri-artphilein-foundation","sept-off","fabula-works","alaska-photographic-center","fondation-tgcc","no-place-art","59-rivoli","analog-sparks","griffin-museum-of-photography","royal-birmingham-society-of-artists","photobook-cafe-rapid-eye-darkroom","witty-books-exposed","houston-center-for-photography","zrno-festival","photography-network","kyotographie","fotografiska-emerging","portraits-hellerau","petard-magazine","la-kabine-saif","fotobus-society","fondazione-deloitte","rfotofolio","insight-foto-festival","bibin-magazine","penumbra-foundation","experimenter-generator","curatory-magazine","art-everywhere-behind-va-shadows","nes-artist-residency","lobster-club","monart-curates","suboart-magazine","aurea-photogallery","the-eden-arts-foundation","mecklenburg-artists-house","golden-duck-gallery","life-framer","bba-gallery","arty-rat","museum-of-contemporary-art-zagreb","louvre-unbound","mus-e-du-quai-branly-jacques-chirac","photographers-without-borders","darmstadt-days-of-photography","container-media","saint-petersburg-month-of-photography","new-abstract-gallery-berlin","viewpoint-photographic-art-center","organ-vida-festival","innovate-artist-grants","tampa-international-airport","dek-unu-magazine","midwest-nice-art","association-laurent-troude","visual-arts-scotland","malerba-fund","foto-tallinn","10x10-photobooks","los-angeles-center-for-photography","art-space-114","photo-artfolio","dusk-gallery","pep-photography","fano-centrale-festival","alternative-processes","photo-trouvee-magazine","alternativephotography-com","fotoslovo","ephemere","kuala-lumpur-photo-awards","asian-american-museum-of-orange-county","sro-photo-gallery-texas-tech-university","hasselblad-foundation","light-work","photoplace-gallery","center-for-photographic-art","golden-turtle","sarajevo-photography-festival","rhode-island-center-for-photographic-arts","the-image-flow","pasadena-photography-arts","hospital-san-juan-de-dios-de-le-n","a-smith-gallery","penn-institute-for-urban-research","dodho-magazine","viewpoint-gallery","bartur-photo-award-cortona-on-the-move","montgomery-photo-festival","new-york-center-for-photographic-arts","film-photo-award","phmuseum","fotofilmic","exposure-one","the-hopper-prize","the-image-flow-praxis-gallery","cape-cod-art-center","1839-awards","refocus-awards","the-hand-magazine","art-fluent","museum-of-contemporary-photography-at-columbia","helsinki-analog-festival","arte-laguna-prize","international-mini-print-cantabria","analog-forever-magazine","open-doors-gallery","booooooom","brussels-street-photography-festival","form-gallery","head-on-foundation","comune-di-sirmione","blank-wall-gallery","euronatur","siena-awards","parisartistes","golden-shot-photography-awards","photo-is-rael","street-photography-barcelona","appennino-foto-festival","black-white-spider-awards","nd-awards","international-photography-awards","international-awards-associate","photo-journalism-prize","gomma-publishing","landskrona-foto","international-aerial-photographer-of-the-year","rea-arte","association-sylvia-s","monovisions-magazine","nature-photographer-of-the-year","hamdan-bin-mohammed-bin-rashid-al-maktoum","natural-landscape-photography-awards","narwhal-rainbow-alliance","exposure-photo-gallery","chromatic-awards","prix-de-la-photographie-paris","prix-camera-clara","tokyo-international-foto-awards","thestreetsoup","aesthetica-magazine","international-color-awards","cambridge-photography-gallery","daylight-books","the-idle-class-magazine","berlin-photo-awards","galleri-format","domino-film-photo-magazine","benrido","carlotta-gallery","paradajs-photo-festival","beautiful-bizarre-magazine","fotodoc-festival","manifest-gallery","artadia","archivo-fotogr-fico-jal-n-ngel","bethany-arts-community","fundaci-n-enaire","fundaci-n-televisa","lenscratch","photoed-magazine","les-rencontres-d-arles","agora-gallery","creatura-magazine","f-stop-magazine","photo-trouv-e-magazine","hndl-magazine","apa-los-angeles","munich-art-gallery","festival-del-reportage","arts-to-hearts-project","gide-associa-o-portuguesa-das-artes","centre-de-la-photographie-gen-ve","lightbox-photo-library","bushwick-gallery","solstice-magazine","leica-society-international","effe4-0-street-photography","dyonyzine","feelszine","cut-paste-magazine","zone-magazine","burn-magazine","incandescent-zine","phases-magazine","noice-magazine","siyu-award","alpine-fellowship","monochrome-awards","annual-photography-awards","wider-skies","reuse-italy","sv-tova-1","no-type-magazine","state-of-the-art-gallery","loosenart","aurora-photocenter","grid-photo-gallery","tilt-institute","photosynthesis","the-stage-gallery","revoke-collective","linea-recta-books","haze-gallery","galleri-heike-arndt-dk","kh7-artspace","soft-publishing","laif-foundation","comedy-wildlife-photography-awards","arcadian-gallery","nova24","la-chambre","lucky-star-magazine","reporter-akademie","creative-capital","la-napoule-art-foundation","elyse-tonna","united-nations-divephotoguide","anonymous-was-a-woman","black-and-white-photo-awards","british-wildlife-photography-awards","new-york-foundation-for-the-arts","tulsa-artist-fellowship","powerlines","global-peace-photo-award","working-assumptions","banff-centre-for-arts-and-creativity","apparently-in-america","visual-studies-workshop","flow-trip-magazine","fieldwork-photo-journal","pearl-press","mangrove-action-project","better-photography-magazine","inland","sonntag-grant","fondazione-capri","eddie-adams-workshop","virginia-center-for-the-creative-arts","visual-carlow","nordic-artists-centre-dale","cavendish-arts-science","chester-photo-festival","monson-arts","the-studios-of-key-west","grunt-gallery","academy-center-of-the-arts","recology-san-francisco","tasweer-photo-festival-qatar","miller-art-museum","queer-art","create-magazine","slow-exposures","pamplemousse-magazine","see-zeen","texas-photographic-society","perspective-gallery","athens-photo-festival-hellenic-centre-for-photography","polygona-kunstverein-kobra","vist-foundation","ian-parry-foundation","manifest-creative-research-gallery","photoworks-sf","fotofestiwal","no-type","20-20-photo-festival","visionary-art-collective","street-photo-festival-athens","eurostars-hotel-company","wassaic-project","rak-art-festival","fiilthy-glo","stanley-greene-foundation","quinn-emanuel","fundaci-n-bot-n","donggang-international-photo-festival","f-262-international-photography-festival","circulation-s-festival","coventry-university-ma-photography-fast-forward","photoworks-with-ease","gallery-one","mrinalini-mukherjee-foundation","les-amis-de-jean-giono","goethe-institut","memory-version","festival-de-l-image","charta-festival","verzasca-foto-festival","near","lanesboro-arts","association-of-photographers","haus-a-rest","aperture","urban-photo-awards","playa"];
const statePages = {"AZ":"united-states/arizona","TX":"united-states/texas","PA":"united-states/pennsylvania","FL":"united-states/florida","CA":"united-states/california","GA":"united-states/georgia","LA":"united-states/louisiana","SC":"united-states/south-carolina","NC":"united-states/north-carolina","OR":"united-states/oregon","MA":"united-states/massachusetts","VT":"united-states/vermont","NY":"united-states/new-york","NM":"united-states/new-mexico","VA":"united-states/virginia","UT":"united-states/utah","WY":"united-states/wyoming","MI":"united-states/michigan","NH":"united-states/new-hampshire","MN":"united-states/minnesota","KS":"united-states/kansas","TN":"united-states/tennessee","MD":"united-states/maryland","DC":"united-states/washington-dc","AK":"united-states/alaska","RI":"united-states/rhode-island","AL":"united-states/alabama","IL":"united-states/illinois","OH":"united-states/ohio","IN":"united-states/indiana","CT":"united-states/connecticut","OK":"united-states/oklahoma","SD":"united-states/south-dakota","ME":"united-states/maine","WI":"united-states/wisconsin","WA":"united-states/washington"};
// ==AUTO-GENERATED-END==

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tagHtml(str, minLen) {
  minLen = minLen || 25;
  if (!str || str.length <= minLen) return esc(str);
  // Split at ~60% on a word boundary for the front, keep last word(s) for the tail
  const words = str.split(' ');
  if (words.length <= 2) return esc(str);
  const splitAt = Math.ceil(words.length * 0.6);
  const front = words.slice(0, splitAt).join(' ');
  const back = words.slice(splitAt).join(' ');
  return `<span class="tag-front">${esc(front)}</span> <span class="tag-back">${esc(back)}</span>`;
}

function getLocationLink(location, country) {
  // For USA locations, link to state page if available
  if (country === 'USA' && typeof statePages !== 'undefined') {
    const parts = location.split(',');
    const state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
    if (state && statePages[state]) return '/' + statePages[state] + '/';
  }
  // Map abbreviated country names to their URL slugs
  const countrySlugs = { 'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates' };
  const countrySlug = countrySlugs[country] || slugify(country);
  if (countryPages.includes(countrySlug)) return '/' + countrySlug + '/';
  return null;
}

function getCountryFromLocation(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Central timezone logic — a call is open until the end of its deadline day (local time)
function isCallOpen(deadline) {
  if (deadline === 'Continuous') return true;
  var end = new Date(deadline + 'T00:00:00');
  end.setDate(end.getDate() + 1);
  return end > new Date();
}

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
    urgencyText = 'Ends today';
    urgencyClass = 'ending';
  } else if (daysLeft !== null && daysLeft === 1) {
    urgencyText = 'Ends tomorrow';
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

function renderTags(call) {
  const pinSvg = '<svg class="pin-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
  const tags = [];
  // Deadline badge
  if (call.deadlineSlug) {
    tags.push(`<a href="/deadlines/${call.deadlineSlug}/" class="call-deadline ${call.urgencyClass}">${esc(call.urgencyText)}</a>`);
  } else {
    tags.push(`<span class="call-deadline ${call.urgencyClass}">${esc(call.urgencyText)}</span>`);
  }
  // Prize
  if (call.prize) {
    const parts = splitPrizeParts(call.prize);
    parts.forEach(part => {
      const cat = derivePrizeCategory(part);
      const href = cat ? '/prize/' + cat + '/' : '/prize/';
      tags.push(`<a href="${href}" class="meta-tag meta-tag-link call-prize">${esc(part)} prize</a>`);
    });
  }
  // Fee
  if (call.fee) {
    if (call.fee.toLowerCase().startsWith('free')) {
      tags.push(`<a href="/fees/free/" class="meta-tag meta-tag-link">Free</a>`);
    } else if (/^[£$€¥]/.test(call.fee)) {
      tags.push(`<a href="/fees/entry-fee/" class="meta-tag meta-tag-link">${esc(call.fee)} fee</a>`);
    } else {
      tags.push(`<a href="/fees/entry-fee/" class="meta-tag meta-tag-link">${esc(call.fee)}</a>`);
    }
  }
  // Location
  if (call.location) {
    const country = getCountryFromLocation(call.location);
    const locLink = getLocationLink(call.location, country);
    const locDisplay = shortenLocation(call.location);
    if (locLink) {
      tags.push(`<a href="${locLink}" class="meta-tag meta-tag-link">${pinSvg}${esc(locDisplay)}</a>`);
    } else {
      tags.push(`<span class="meta-tag">${pinSvg}${esc(locDisplay)}</span>`);
    }
  }
  // Category
  const catSlug = categorySlug[call.category];
  tags.push(`<a href="/${catSlug}/" class="meta-tag meta-tag-link">${categoryLabel[call.category] || esc(call.category)}</a>`);
  // Eligibility
  if (call.eligibility && call.eligibility.length) {
    call.eligibility.forEach(e => {
      const label = eligibilityLabel[e] || e;
      tags.push(`<a href="/eligibility/${e}/" class="meta-tag meta-tag-link eligibility-tag">${esc(label)}</a>`);
    });
  }
  return tags.join(' ');
}

function renderInfoGrid(call) {
  function infoRow(label, value) {
    return `<div class="info-row">
      <span class="info-label">${label}</span>
      <span class="dots"></span>
      <span class="info-value">${value}</span>
    </div>`;
  }
  function infoVal(str) { return tagHtml(str, 20); }
  function infoLink(href, str) { const h = href.endsWith('/') ? href : href + '/'; return `<a href="${h}" title="${esc(str)}">${infoVal(str)}</a>`; }

  const rows = [];
  // Deadline
  const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
    new Date(call.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dlSlug = call.deadline !== 'Continuous' ? (function() { const d = new Date(call.deadline + 'T00:00:00'); return ['january','february','march','april','may','june','july','august','september','october','november','december'][d.getMonth()] + '-' + d.getFullYear(); })() : null;
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
    rows.push(infoRow('Results', esc(call.resultsDate) + (resultsPast ? ' (announced)' : '')));
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
      const label = eligibilityLabel[e] || e;
      return infoLink('/eligibility/' + e, label);
    }).join(', ');
    rows.push(infoRow('<a href="/eligibility/">Eligibility</a>', eligHtml));
  }
  // Location
  if (call.location) {
    const country = getCountryFromLocation(call.location);
    const locLink = getLocationLink(call.location, country);
    const locShort = shortenLocation(call.location);
    const locHtml = locLink ? infoLink(locLink, locShort) : infoVal(locShort);
    rows.push(infoRow('<a href="/locations/">Location</a>', locHtml));
  }
  // Requirements
  if (call.requirements) rows.push(infoRow('Requirements', infoVal(call.requirements)));
  // AI policy (only show if actually specified)
  if (call.ai && call.ai !== 'Not specified') rows.push(infoRow('AI policy', infoVal(call.ai)));
  // Submit via
  if (call.submitVia) {
    const open = isCallOpen(call.deadline);
    const label = infoVal(call.submitVia);
    if (!open) {
      rows.push(infoRow('Submit via', label));
    } else if (call.email) {
      rows.push(infoRow('Submit via', `<a href="mailto:${esc(call.email)}" target="_blank" rel="nofollow noopener">${label}</a>`));
    } else if (call.submitUrl) {
      rows.push(infoRow('Submit via', `<a href="${esc(call.submitUrl)}" target="_blank" rel="nofollow noopener">${label}</a>`));
    } else {
      rows.push(infoRow('Submit via', label));
    }
  }
  return rows.join('');
}

function renderCard(call, titleTag) {
  titleTag = titleTag || 'h4';
  return `
    <div class="call-card">
      <${titleTag} class="call-title"><a href="/${call.slug || slugify(call.title)}/">${esc(call.title)}${!call.orgInTitle ? ' · ' + esc(call.org) : ''}</a></${titleTag}>
      <div class="call-meta">${renderTags(call)}</div>
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

  if (opts.skipSections) {
    const all = [...open, ...closed];
    all.forEach(call => container.insertAdjacentHTML('beforeend', renderCard(call, 'h4')));
    if (all.length === 0) container.innerHTML = emptyState();
    return;
  }

  // Ending soon section (today + tomorrow combined)
  const specialSlugs = new Set();
  const endingSoon = open.filter(c => c.daysLeft !== null && c.daysLeft <= 1);
  if (endingSoon.length >= 1) {
    container.insertAdjacentHTML('beforeend', '<h3 class="section-header">Ending soon</h3>');
    endingSoon.forEach(call => {
      container.insertAdjacentHTML('beforeend', renderCard(call, 'h4'));
      specialSlugs.add(call.slug || slugify(call.title));
    });
  }

  // Open month sections (skip Today/Tomorrow items)
  let currentSection = '';
  open.filter(c => !specialSlugs.has(c.slug || slugify(c.title))).forEach(call => {
    const section = call.deadline === 'Continuous' ? 'Continuous' : monthNames[call.deadlineDate.getMonth()] + ' ' + call.deadlineDate.getFullYear();
    if (section !== currentSection) {
      currentSection = section;
      container.insertAdjacentHTML('beforeend', '<h3 class="section-header">' + section + '</h3>');
    }
    container.insertAdjacentHTML('beforeend', renderCard(call, 'h4'));
  });

  // Past sections (newest first)
  if (closed.length) {
    closed.sort((a, b) => b.deadlineDate - a.deadlineDate);
    const pastSlugs = new Set();

    // Yesterday section
    const yesterday = closed.filter(c => c.daysLeft !== null && c.daysLeft === -1);
    if (yesterday.length >= 1) {
      container.insertAdjacentHTML('beforeend', '<h3 class="section-header">Ended Yesterday</h3>');
      yesterday.forEach(call => {
        container.insertAdjacentHTML('beforeend', renderCard(call, 'h4'));
        pastSlugs.add(call.slug || slugify(call.title));
      });
    }

    // Remaining past calls
    const rest = closed.filter(c => !pastSlugs.has(c.slug || slugify(c.title)));
    if (rest.length) {
      container.insertAdjacentHTML('beforeend', '<h3 class="section-header">Past</h3>');
      rest.forEach(call => {
        container.insertAdjacentHTML('beforeend', renderCard(call, 'h4'));
      });
    }
  }

  if (container.children.length === 0) {
    container.innerHTML = emptyState();
  }
}
