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
    if (CURRENT_COUNTRY === 'USA' && CURRENT_CALL.location) {
      // For USA: try state first, fall back to all USA
      const parts = CURRENT_CALL.location.split(',');
      const state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
      const stateName = state && typeof statePages !== 'undefined' && statePages[state]
        ? statePages[state].split('/')[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : '';
      if (state) {
        const byState = otherCalls.filter(c => c.location && c.location.includes(', ' + state + ',') && c.org !== CURRENT_ORG);
        if (byState.length > 0) {
          renderRelatedList(byState, `More calls in ${stateName}`, 'relatedCountry');
        } else {
          const byUSA = otherCalls.filter(c => getCountryFromLocation(c.location) === 'USA' && c.org !== CURRENT_ORG);
          renderRelatedList(byUSA, 'More calls in the United States', 'relatedCountry');
        }
      } else {
        const byUSA = otherCalls.filter(c => getCountryFromLocation(c.location) === 'USA' && c.org !== CURRENT_ORG);
        renderRelatedList(byUSA, 'More calls in the United States', 'relatedCountry');
      }
    } else {
      const byCountry = otherCalls.filter(c => getCountryFromLocation(c.location) === CURRENT_COUNTRY && c.org !== CURRENT_ORG);
      renderRelatedList(byCountry, `More calls in ${CURRENT_COUNTRY}`, 'relatedCountry');
    }
  }
}

loadRelated();
