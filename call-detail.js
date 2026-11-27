// Detail pages are pre-rendered server-side (generate-pages.js), info grid included; this
// script only colours the deadline link.
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const info = document.getElementById('detailInfo');
  // Deadline band: colour by urgency as of now, the same rule as the deadline pills
  // (computeUrgency in shared.js). Closed calls get no band, nor does a page built closed
  // (no #applyBtn: it says "Submissions closed"), whatever the visitor's clock says.
  var dlLink = info && info.querySelector('.info-value a[href^="/deadlines/"]');
  if (dlLink && CURRENT_CALL.deadline && typeof computeUrgency === 'function' && document.getElementById('applyBtn')) {
    var u = computeUrgency(CURRENT_CALL, new Date()).urgencyClass;
    if (u && u !== 'closed') dlLink.classList.add('dl-band', 'dl-' + u);
  }
})();

// "More like this" is rendered into the page at build time
// (buildStaticSimilarCalls in generate-pages.js); nothing to fetch here.
