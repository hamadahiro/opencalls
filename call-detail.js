// Render detail page meta tags and info grid from CURRENT_CALL
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  const info = document.getElementById('detailInfo');
  if (info) info.innerHTML = renderInfoGrid(CURRENT_CALL);
})();

// Timeline bar
(function() {
  if (typeof CURRENT_CALL === 'undefined') return;
  var bar = document.getElementById('timelineBar');
  if (!bar) return;

  var deadline = CURRENT_CALL.deadline;
  if (deadline === 'Continuous') return;

  var now = new Date();
  var deadlineDate = new Date(deadline + 'T00:00:00');
  var daysToDeadline = Math.ceil((deadlineDate - now) / 864e5);

  if (daysToDeadline < 0) return;

  // Match urgency colors from deadline tags
  var deadlineColor;
  if (daysToDeadline <= 1) deadlineColor = '#4C447A';
  else if (daysToDeadline <= 14) deadlineColor = '#B6332F';
  else deadlineColor = '#D3B36F';

  var resultsColor = '#8CAA8C';

  // Parse resultsDate to get days between deadline and results
  var resultsDays = 0;
  if (CURRENT_CALL.resultsDate) {
    var months = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
    var clean = CURRENT_CALL.resultsDate.replace(/^[~≈]/, '').replace(/^(After|Early|Mid-?|Late|End of)\s*/i, '');
    var my = clean.match(/([A-Za-z]+)[\s\d,]+(\d{4})/);
    if (my) {
      var mi = months[my[1].toLowerCase()];
      if (mi !== undefined) {
        var yr = parseInt(my[2]);
        var dm = clean.match(/(\d{1,2})[,\s-]/);
        var day = dm ? parseInt(dm[1]) : new Date(yr, mi + 1, 0).getDate();
        var rDate = new Date(yr, mi, day);
        if (rDate > deadlineDate) {
          resultsDays = Math.ceil((rDate - deadlineDate) / 864e5);
        }
      }
    }
  }

  var totalDays = Math.max(daysToDeadline + resultsDays, 1);
  var deadlinePct = (daysToDeadline / totalDays) * 100;
  var resultsPct = (resultsDays / totalDays) * 100;

  var html = '<div style="display:flex;width:100%;height:4px;border-radius:2px;overflow:hidden;margin-top:32px">';
  html += '<div style="width:' + deadlinePct + '%;background:' + deadlineColor + '"></div>';
  if (resultsPct > 0) {
    html += '<div style="width:' + resultsPct + '%;background:' + resultsColor + '"></div>';
  }
  html += '</div>';
  bar.innerHTML = html;
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
}

loadSimilar();
