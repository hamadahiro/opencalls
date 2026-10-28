// Detail pages are pre-rendered server-side (generate-pages.js) for SEO, so the
// info grid and prize block already exist in the static HTML. Only fill them
// client-side as a FALLBACK for legacy pages that shipped an empty container —
// never overwrite the canonical server render, which is built from the full call
// (including the call URL that the trimmed inlined CURRENT_CALL omits).
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const info = document.getElementById('detailInfo');
  if (info && !info.innerHTML.trim()) info.innerHTML = renderInfoGrid(CURRENT_CALL, { esc: esc, locationLink: getLocationLink });
  var dp = document.getElementById('detailPrize');
  if (dp && !dp.innerHTML.trim() && CURRENT_CALL.prize) dp.innerHTML = buildPrizeBlock(CURRENT_CALL, esc);
})();

// "More like this" is rendered into the page at build time
// (buildStaticSimilarCalls in generate-pages.js); nothing to fetch here.
