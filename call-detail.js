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
  // Results stroke on a closed call (shared.js renderInfoGrid): when its words take more than one line, every line gets the
  // stroke (.dl-lines, style.css); on one line it stays the deadline's ::before. Checked again whenever the value's box
  // changes size: the web font arriving after this ran (it moves where words break), a turned phone, a resized window.
  // The class changes no width, so it cannot change the line count it is set from.
  var resLink = info && info.querySelector('.info-value a.dl-band[href^="/results/"]');
  if (resLink) {
    var lines = function () { resLink.classList.toggle('dl-lines', resLink.getClientRects().length > 1); };
    lines();
    if (window.ResizeObserver) new ResizeObserver(lines).observe(resLink.parentNode);
    else window.addEventListener('resize', lines);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', lines);
  }
})();

// "More like this" is rendered into the page at build time
// (buildStaticSimilarCalls in generate-pages.js); nothing to fetch here.
