// Add deadline badge to detail page meta tags
(function() {
  const meta = document.querySelector('.call-detail-meta');
  if (meta && typeof CURRENT_DEADLINE !== 'undefined') {
    const p = processCall({ deadline: CURRENT_DEADLINE });
    meta.insertAdjacentHTML('beforeend', `<span class="call-deadline ${p.urgencyClass}">${p.urgencyText}</span>`);
  }
})();

function getCountry(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function renderRelatedList(calls, heading, containerId) {
  const container = document.getElementById(containerId);
  const processed = calls.map(processCall).filter(c => c.urgencyClass !== 'closed');
  if (!processed.length) { container.innerHTML = ''; return; }

  let html = `<h2 class="related-heading">${heading}</h2>`;
  processed.forEach(call => { html += renderCard(call); });
  container.innerHTML = html;
}

async function loadRelated() {
  const res = await fetch('/data.json');
  const data = await res.json();

  const otherCalls = data.calls.filter(c => slugify(c.title) !== CURRENT_SLUG);

  const byOrg = otherCalls.filter(c => c.org === CURRENT_ORG);
  renderRelatedList(byOrg, `More from ${CURRENT_ORG}`, 'relatedOrg');

  if (CURRENT_COUNTRY && CURRENT_COUNTRY !== 'Online') {
    const byCountry = otherCalls.filter(c => getCountry(c.location) === CURRENT_COUNTRY && c.org !== CURRENT_ORG);
    renderRelatedList(byCountry, `More calls in ${CURRENT_COUNTRY}`, 'relatedCountry');
  }
}

loadRelated();
