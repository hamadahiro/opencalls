// Render detail page meta tags and info grid from CURRENT_CALL
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const processed = processCall(CURRENT_CALL);

  const meta = document.getElementById('detailMeta');
  if (meta) meta.innerHTML = renderTags(processed);

  const info = document.getElementById('detailInfo');
  if (info) info.innerHTML = renderInfoGrid(CURRENT_CALL);
})();

function renderRelatedList(calls, heading, containerId) {
  const container = document.getElementById(containerId);
  const processed = calls.map(processCall).filter(c => c.urgencyClass !== 'closed');
  if (!processed.length) { container.innerHTML = ''; return; }

  let html = `<h2 class="section-header">${heading}</h2>`;
  processed.forEach(call => { html += renderCard(call, 'h3'); });
  container.innerHTML = html;
}

async function loadRelated() {
  const res = await fetch('/data.json');
  const data = await res.json();

  const otherCalls = data.calls.filter(c => slugify(c.title) !== CURRENT_SLUG);

  const byOrg = otherCalls.filter(c => c.org === CURRENT_ORG);
  renderRelatedList(byOrg, `More from ${CURRENT_ORG}`, 'relatedOrg');

  if (CURRENT_COUNTRY && CURRENT_COUNTRY !== 'Online') {
    const byCountry = otherCalls.filter(c => getCountryFromLocation(c.location) === CURRENT_COUNTRY && c.org !== CURRENT_ORG);
    renderRelatedList(byCountry, `More calls in ${CURRENT_COUNTRY}`, 'relatedCountry');
  }
}

loadRelated();
