function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function getCountry(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function renderRelatedList(calls, heading, containerId) {
  const container = document.getElementById(containerId);
  if (!calls.length) { container.innerHTML = ''; return; }

  const categoryLabel = {
    'photography': 'Photography', 'exhibition': 'Exhibition', 'grant': 'Grant',
    'zine': 'Zines & Books', 'residency': 'Residency', 'education': 'Education'
  };

  let html = `<h2 class="related-heading">${heading}</h2>`;
  calls.forEach(call => {
    const slug = slugify(call.title);
    const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
      new Date(call.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    html += `
      <div class="related-card">
        <h3 class="call-title"><a href="/${slug}">${call.title}</a></h3>
        <div class="call-meta">
          <span class="meta-tag">${categoryLabel[call.category] || call.category}</span>
          <span class="meta-tag">${call.org}</span>
          ${call.location ? `<span class="meta-tag"><svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${call.location}</span>` : ''}
          <span class="meta-tag">${deadlineText}</span>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

async function loadRelated() {
  const res = await fetch('/data.json');
  const data = await res.json();
  const now = new Date();

  const otherCalls = data.calls.filter(c => slugify(c.title) !== CURRENT_SLUG);
  const open = otherCalls.filter(c => c.deadline === 'Continuous' || new Date(c.deadline) >= now);

  const byOrg = open.filter(c => c.org === CURRENT_ORG);
  const byCountry = open.filter(c => getCountry(c.location) === CURRENT_COUNTRY && c.org !== CURRENT_ORG);

  renderRelatedList(byOrg, `More from ${CURRENT_ORG}`, 'relatedOrg');
  renderRelatedList(byCountry, `More calls in ${CURRENT_COUNTRY}`, 'relatedCountry');
}

loadRelated();
