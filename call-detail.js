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

async function loadSimilar() {
  try {
  const res = await fetch('/data.json');
  const data = await res.json();

  const candidates = data.calls
    .filter(c => (c.slug || slugify(c.title)) !== CURRENT_SLUG)
    .filter(c => isCallOpen(c.deadline));

  const scored = candidates.map(c => ({
    call: c,
    score: scoreSimilarity(CURRENT_CALL, c)
  }));

  scored.sort((a, b) => b.score - a.score);

  const curElig = CURRENT_CALL.eligibility || [];
  const hasEligibility = curElig.length > 0;

  // Filter: min score 5, and if current has eligibility tags, require conceptual match
  const top = scored.filter(s => {
    if (s.score < 5) return false;
    if (hasEligibility) {
      const othElig = s.call.eligibility || [];
      const sharedElig = curElig.some(t => othElig.includes(t));
      const sameCategory = s.call.category === CURRENT_CALL.category;
      if (!sharedElig && !sameCategory) return false;
    }
    return true;
  }).slice(0, 6);

  const container = document.getElementById('similarCalls');
  if (top.length < 2) {
    container.innerHTML = '';
    return;
  }

  let html = '<h2 class="section-header">More like this</h2>';
  top.forEach(s => {
    html += renderCard(processCall(s.call), 'h3');
  });
  container.innerHTML = html;
} catch (e) {}
}

loadSimilar();
