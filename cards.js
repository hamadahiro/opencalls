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
const countryPages = ["uk","france","greece","usa","italy","japan","germany","spain","canada"];

// Orgs with landing pages (2+ calls)
const orgPages = ["kyotographie","penumbra-foundation","life-framer","all-about-photo","innovate-artist-grants","praxis-photo-arts-center","dusk-photo-gallery","decode-gallery","alternativephotography-com","light-work","black-box-gallery","a-smith-gallery","new-york-center-for-photographic-arts","phmuseum","refocus-awards","art-fluent"];

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

function renderCard(call, titleTag) {
  titleTag = titleTag || 'h4';
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
    if (country !== 'Online' && countryPages.includes(countrySlug)) {
      tags.push(`<a href="/${countrySlug}" class="meta-tag meta-tag-link"><svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${call.location}</a>`);
    } else {
      tags.push(`<span class="meta-tag"><svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${call.location}</span>`);
    }
  }
  if (call.fee && call.fee !== 'Check website') tags.push(`<span class="meta-tag">${call.fee}</span>`);
  tags.push(`<span class="call-deadline ${call.urgencyClass}">${call.urgencyText}</span>`);

  return `
    <div class="call-card">
      <${titleTag} class="call-title"><a href="/${slugify(call.title)}">${call.title}</a></${titleTag}>
      <div class="call-meta">${tags.join(' ')}</div>
      <p class="call-description">${call.description}</p>
    </div>`;
}
