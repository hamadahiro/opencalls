// Render detail page meta tags and info grid from CURRENT_CALL
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const processed = processCall(CURRENT_CALL);

  const meta = document.getElementById('detailMeta');
  if (meta) meta.innerHTML = renderTags(processed);

  const info = document.getElementById('detailInfo');
  if (info) info.innerHTML = renderInfoGrid(CURRENT_CALL);
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
    const curDate = new Date(current.deadline);
    const othDate = new Date(other.deadline);
    const diff = Math.abs(curDate - othDate) / (1000 * 60 * 60 * 24);
    if (diff <= 30) score += 1;
  }

  // Same org: small bonus only
  if (current.org === other.org) score += 2;

  return score;
}

async function loadSimilar() {
  const res = await fetch('/data.json');
  const data = await res.json();

  const now = new Date();
  const candidates = data.calls
    .filter(c => slugify(c.title) !== CURRENT_SLUG)
    .filter(c => c.deadline === 'Continuous' || new Date(c.deadline) >= now);

  const scored = candidates.map(c => ({
    call: c,
    score: scoreSimilarity(CURRENT_CALL, c)
  }));

  scored.sort((a, b) => b.score - a.score);

  // Minimum score threshold and minimum 2 results
  const minScore = 3;
  const top = scored.filter(s => s.score >= minScore).slice(0, 6);

  const container = document.getElementById('similarCalls');
  if (top.length < 2) {
    container.innerHTML = '';
    return;
  }

  let html = '<h2 class="section-header">Similar Calls</h2>';
  top.forEach(s => {
    html += renderCard(processCall(s.call), 'h3');
  });
  container.innerHTML = html;
}

loadSimilar();
