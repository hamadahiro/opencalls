// Render detail page meta tags and info grid from CURRENT_CALL
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const info = document.getElementById('detailInfo');
  if (info) info.innerHTML = renderInfoGrid(CURRENT_CALL);
  var dp = document.getElementById('detailPrize');
  if (dp && CURRENT_CALL.prize) {
    var parts = splitPrizeParts(CURRENT_CALL.prize);
    var label = parts.length > 1 ? 'Prizes' : 'Prize';
    var prizeSvg = '<svg class="pin-icon" aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/></svg>';
    var tags = parts.map(function(part) {
      var cat = derivePrizeCategory(part);
      var href = cat ? '/prize/' + cat + '/' : '/prize/';
      return '<a href="' + href + '" class="meta-tag meta-tag-link call-prize">' + prizeSvg + esc(part) + '</a>';
    }).join(' ');
    dp.innerHTML = '<div class="call-detail-prize"><span class="call-detail-prize-label"><a href="/prize/">' + label + '</a></span> ' + tags + '</div>';
  }
})();

function getState(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts.length >= 3 ? parts[parts.length - 2].trim() : '';
}

function isFree(fee) {
  return fee && fee.toLowerCase().startsWith('free');
}

function scoreSimilarity(current, other) {
  let score = 0;

  // Shared eligibility tags: +5 each (strongest signal)
  const curElig = current.eligibility || [];
  const othElig = other.eligibility || [];
  curElig.forEach(tag => {
    if (othElig.includes(tag)) score += 5;
  });

  // Same category: +4
  if (current.category === other.category) {
    score += 4;
  } else {
    // Different category: -3 penalty
    score -= 3;
  }

  // Location
  const curCountry = getCountryFromLocation(current.location);
  const othCountry = getCountryFromLocation(other.location);

  if (curCountry === 'USA' && othCountry === 'USA') {
    const curState = getState(current.location);
    const othState = getState(other.location);
    if (curState && curState === othState) {
      score += 3; // Same state
    } else {
      score += 2; // Same country (USA)
    }
  } else if (curCountry && curCountry === othCountry) {
    if (curCountry === 'Online') {
      score += 2; // Both online
    } else {
      score += 2; // Same country
    }
  }

  // Fee similarity
  const curFree = isFree(current.fee);
  const othFree = isFree(other.fee);
  if (curFree && othFree) score += 1;
  if (!curFree && !othFree) score += 1;

  // Deadline proximity (within 30 days): +1
  if (current.deadline !== 'Continuous' && other.deadline !== 'Continuous') {
    const curDate = new Date(current.deadline + 'T00:00:00');
    const othDate = new Date(other.deadline + 'T00:00:00');
    const diff = Math.abs(curDate - othDate) / (1000 * 60 * 60 * 24);
    if (diff <= 30) score += 1;
  }

  // Same org: small bonus only
  if (current.org === other.org) score += 2;

  return score;
}

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
