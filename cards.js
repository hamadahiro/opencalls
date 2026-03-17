const categoryLabel = {
  'photography': 'Photography',
  'exhibition': 'Exhibition',
  'grant': 'Grant',
  'zine': 'Zines & Books',
  'residency': 'Residency',
  'education': 'Education'
};

const categorySlug = {
  'photography': 'photography',
  'exhibition': 'exhibitions',
  'grant': 'grants',
  'zine': 'zines',
  'residency': 'residencies',
  'education': 'education'
};

// Countries with landing pages (2+ calls)
const countryPages = ["morocco","uk","france","online","greece","usa","italy","north-macedonia","japan","germany","iceland","spain","brazil","hungary","austria","croatia","estonia","netherlands","romania","malaysia","sweden","bosnia-and-herzegovina","canada","finland"];

// Orgs with landing pages (2+ calls)
const orgPages = ["fondation-tgcc","no-place-art","59-rivoli","lensculture","analog-sparks","athens-photo-festival","griffin-museum-of-photography","royal-birmingham-society-of-artists","witty-books-exposed","zrno-festival","photography-network","kyotographie","fotografiska","portraits-hellerau","edition-502","petard-magazine","atlantic-current","la-kabine-saif","fotobus-society","fondazione-deloitte","rfotofolio","lucie-foundation","insight-foto-festival","bibin-magazine","penumbra-foundation","experimenter-generator","curatory-magazine","art-everywhere-behind-va-shadows","nes-artist-residency","scan-international-photography-festival","lobster-club","s-o-paulo-photography-festival","monart-curates","suboart-magazine","aurea-photogallery","the-eden-arts-foundation","mecklenburg-artists-house","golden-duck-gallery","life-framer","bba-gallery","arty-rat","louvre-unbound","mus-e-du-quai-branly-jacques-chirac","photographers-without-borders","darmstadt-days-of-photography","the-lucie-foundation","container-media","saint-petersburg-month-of-photography","all-about-photo","new-abstract-gallery-berlin","viewpoint-photographic-art-center","organ-vida-festival","innovate-artist-grants","tampa-international-airport","dek-unu-magazine","midwest-nice-art","tcg-gallery","praxis-photo-arts-center","malerba-fund","foto-tallinn","a-photographer-s-place","10x10-photobooks","los-angeles-center-for-photography","art-space-114","dusk-photo-gallery","pep-photography","atlanta-photography-group","decode-gallery","l-a-photo-curator","fano-centrale-festival","artdoc-photography-magazine","alternative-processes","photo-trouvee-magazine","alternativephotography-com","fotoslovo","ephemere-photo-fest","independent-photo","kuala-lumpur-photo-awards","asian-american-museum-of-orange-county","decagon-gallery","sro-photo-gallery-texas-tech-university","hasselblad-foundation","light-work","photoplace-gallery","center-for-photographic-art","southeast-center-for-photography","soho-photo-gallery","der-greif","sarajevo-photography-festival","black-box-gallery","rhode-island-center-for-photographic-arts","the-image-flow","pasadena-photography-arts","a-smith-gallery","penn-institute-for-urban-research","dodho-magazine","viewpoint-gallery","bartur-photo-award-cortona-on-the-move","montgomery-photo-festival","new-york-center-for-photographic-arts","florida-museum-of-photographic-arts","film-photo-award","phmuseum","fotofilmic","exposure-one","the-hopper-prize","the-image-flow-praxis-gallery","cape-cod-art-center","1839-awards","refocus-awards","the-hand-magazine","art-fluent","museum-of-contemporary-photography-columbia-college-chicago","helsinki-analog-festival","arte-laguna-prize","international-mini-print-cantabria","photometria-international-photography-festival","analog-forever-magazine","open-doors-gallery","booooooom"];

function getCountryFromLocation(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function processCall(call) {
  const now = new Date();
  const deadlineDate = call.deadline === 'Continuous' ? null : new Date(call.deadline);
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
    urgencyText = daysLeft + (daysLeft === 1 ? ' day left' : ' days left');
    urgencyClass = 'soon';
  } else if (deadlineDate) {
    urgencyText = deadlineDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    urgencyClass = 'normal';
  }

  return { ...call, deadlineDate, daysLeft, urgencyClass, urgencyText };
}

function renderTags(call) {
  const pinSvg = '<svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>';
  const tags = [];
  if (call.prize) tags.push(`<span class="meta-tag call-prize">${call.prize}</span>`);
  const catSlug = categorySlug[call.category];
  tags.push(`<a href="/${catSlug}" class="meta-tag meta-tag-link">${categoryLabel[call.category] || call.category}</a>`);
  const orgSlug = slugify(call.org);
  if (orgPages.includes(orgSlug)) {
    tags.push(`<a href="/${orgSlug}" class="meta-tag meta-tag-link">${call.org}</a>`);
  } else {
    tags.push(`<span class="meta-tag">${call.org}</span>`);
  }
  if (call.location) {
    const country = getCountryFromLocation(call.location);
    const countrySlug = slugify(country);
    if (countryPages.includes(countrySlug)) {
      tags.push(`<a href="/${countrySlug}" class="meta-tag meta-tag-link">${pinSvg}${call.location}</a>`);
    } else {
      tags.push(`<span class="meta-tag">${pinSvg}${call.location}</span>`);
    }
  }
  if (call.fee && call.fee !== 'Check website') tags.push(`<span class="meta-tag">${call.fee}</span>`);
  tags.push(`<span class="call-deadline ${call.urgencyClass}">${call.urgencyText}</span>`);
  return tags.join(' ');
}

function renderCard(call, titleTag) {
  titleTag = titleTag || 'h4';
  return `
    <div class="call-card">
      <${titleTag} class="call-title"><a href="/${slugify(call.title)}">${call.title}</a></${titleTag}>
      <div class="call-meta">${renderTags(call)}</div>
      <p class="call-description">${call.description}</p>
    </div>`;
}
