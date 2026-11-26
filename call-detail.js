// Detail pages are pre-rendered server-side (generate-pages.js) for SEO, so the
// info grid already exists in the static HTML. Only fill them
// client-side as a FALLBACK for legacy pages that shipped an empty container —
// never overwrite the canonical server render, which is built from the full call
// (including the call URL that the trimmed inlined CURRENT_CALL omits).
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const info = document.getElementById('detailInfo');
  if (info && !info.innerHTML.trim()) info.innerHTML = renderInfoGrid(CURRENT_CALL, { esc: esc, locationLink: getLocationLink });
  // Deadline band: colour by urgency as of now, the same rule as the deadline pills
  // (computeUrgency in shared.js). Closed calls get no band.
  var dlLink = info && info.querySelector('.info-value a[href^="/deadlines/"]');
  if (dlLink && CURRENT_CALL.deadline && typeof computeUrgency === 'function') {
    var u = computeUrgency(CURRENT_CALL, new Date()).urgencyClass;
    if (u && u !== 'closed') dlLink.classList.add('dl-band', 'dl-' + u);
  }
})();

// "More like this" is rendered into the page at build time
// (buildStaticSimilarCalls in generate-pages.js); nothing to fetch here.
