// Global search for non-home pages
// Loads data.json, shows suggestion dropdown, navigates to /?q= on search
(function() {
  var searchWrap = document.getElementById('globalSearchWrap');
  if (!searchWrap) return;

  var searchInput = document.getElementById('globalSearchInput');
  var searchClear = document.getElementById('globalSearchClear');
  var searchBack = document.getElementById('globalSearchBack');
  var searchDropdown = document.getElementById('globalSearchDropdown');
  var searchToggle = document.getElementById('searchToggle');
  var allCalls = null;
  var selectedSuggestion = -1;

  function isMobile() { return window.innerWidth <= 640; }

  function openMobileSearch() {
    if (isMobile()) {
      window.scrollTo(0, 0);
      document.body.classList.add('search-active');
      searchInput.focus();
    }
  }

  function closeMobileSearch() {
    document.body.classList.remove('search-active');
    searchInput.blur();
    hideDropdown();
  }

  if (searchToggle) {
    searchToggle.addEventListener('click', function() {
      openMobileSearch();
    });
  }

  if (searchBack) {
    searchBack.addEventListener('mousedown', function(e) {
      e.preventDefault();
      closeMobileSearch();
    });
  }

  function loadData(cb) {
    if (allCalls) return cb();
    fetch('/data.json').then(function(r) { return r.json(); }).then(function(data) {
      allCalls = data.calls;
      cb();
    });
  }

  function getOpenCalls() {
    var now = new Date();
    var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    return allCalls.filter(function(c) { return c.deadline === 'Continuous' || c.deadline >= today; });
  }

  function buildSuggestions(query) {
    var relevant = getOpenCalls();
    var q = (query || '').toLowerCase().trim();
    var groups = {};

    // Categories
    var catCounts = {};
    relevant.forEach(function(c) { catCounts[c.category] = (catCounts[c.category] || 0) + 1; });
    var catItems = Object.entries(categoryLabel).map(function(e) {
      return { type: 'category', value: e[0], label: e[1], count: catCounts[e[0]] || 0 };
    }).filter(function(item) {
      return item.count > 0 && (!q || item.label.toLowerCase().includes(q));
    }).sort(function(a, b) { return b.count - a.count; });
    if (catItems.length) groups['Categories'] = catItems.slice(0, 5);

    // Countries
    var countryCounts = {};
    relevant.forEach(function(c) {
      if (!c.location) return;
      var parts = c.location.split(',');
      var country = parts[parts.length - 1].trim();
      if (country) countryCounts[country] = (countryCounts[country] || 0) + 1;
    });
    var countryExpand = {USA:'United States',UK:'United Kingdom',UAE:'United Arab Emirates'};
    var countryItems = Object.entries(countryCounts).map(function(e) {
      var display = countryExpand[e[0]] || e[0];
      return { type: 'country', value: e[0], label: display, count: e[1] };
    }).filter(function(item) {
      return (!q || item.label.toLowerCase().includes(q));
    }).sort(function(a, b) { return b.count - a.count; });
    if (countryItems.length) groups['Locations'] = countryItems.slice(0, 6);

    // Eligibility
    var eligCounts = {};
    relevant.forEach(function(c) { if (c.eligibility) c.eligibility.forEach(function(e) { eligCounts[e] = (eligCounts[e] || 0) + 1; }); });
    var eligItems = Object.entries(eligibilityLabel).map(function(e) {
      return { type: 'eligibility', value: e[0], label: e[1], count: eligCounts[e[0]] || 0 };
    }).filter(function(item) {
      return item.count > 0 && (!q || item.label.toLowerCase().includes(q));
    }).sort(function(a, b) { return b.count - a.count; });
    if (eligItems.length) groups['Eligibility'] = eligItems.slice(0, 5);

    // Prizes
    var prizeCounts = {};
    relevant.forEach(function(c) {
      if (!c.prize) return;
      derivePrizeCategories(c.prize).forEach(function(pc) { prizeCounts[pc] = (prizeCounts[pc] || 0) + 1; });
    });
    var prizeItems = Object.entries(prizeCategoryLabel).map(function(e) {
      return { type: 'prize', value: e[0], label: e[1], count: prizeCounts[e[0]] || 0 };
    }).filter(function(item) {
      return item.count > 0 && (!q || item.label.toLowerCase().includes(q));
    }).sort(function(a, b) { return b.count - a.count; });
    if (prizeItems.length) groups['Prizes'] = prizeItems.slice(0, 5);

    // Fees
    var freeCount = relevant.filter(function(c) { return c.fee && c.fee.toLowerCase().startsWith('free'); }).length;
    var paidCount = relevant.filter(function(c) { return c.fee && !c.fee.toLowerCase().startsWith('free'); }).length;
    var feeItems = [
      { type: 'fee', value: 'free', label: 'Free', count: freeCount },
      { type: 'fee', value: 'paid', label: 'Paid', count: paidCount }
    ].filter(function(item) {
      return item.count > 0 && (!q || item.label.toLowerCase().includes(q));
    });
    if (feeItems.length) groups['Fees'] = feeItems;

    // Organizations (only when typing)
    if (q) {
      var orgCounts = {};
      relevant.forEach(function(c) { orgCounts[c.org] = (orgCounts[c.org] || 0) + 1; });
      var orgItems = Object.entries(orgCounts).map(function(e) {
        return { type: 'org', value: e[0], label: e[0], count: e[1] };
      }).filter(function(item) {
        return item.label.toLowerCase().includes(q);
      }).sort(function(a, b) { return b.count - a.count; });
      if (orgItems.length) groups['Organizations'] = orgItems.slice(0, 5);
    }

    // Merge Prizes + Fees
    var pf = [];
    if (groups['Fees']) pf = pf.concat(groups['Fees']);
    if (groups['Prizes']) pf = pf.concat(groups['Prizes']);
    delete groups['Fees'];
    delete groups['Prizes'];
    if (pf.length) groups['Prize / Fee'] = pf.slice(0, 5);

    // On focus (no query): skip Categories
    if (!q) {
      var limited = {};
      if (groups['Eligibility']) limited['Eligibility'] = groups['Eligibility'];
      if (groups['Locations']) limited['Locations'] = groups['Locations'];
      if (groups['Prize / Fee']) limited['Prize / Fee'] = groups['Prize / Fee'];
      return limited;
    }
    return groups;
  }

  function showDropdown(groups) {
    var keys = Object.keys(groups);
    if (!keys.length) { searchDropdown.style.display = 'none'; return; }
    var browseLinks = { 'Eligibility': { href: '/eligibility/', text: 'All eligibility options' }, 'Locations': { href: '/locations/', text: 'All locations' }, 'Prize / Fee': { href: '/prize/', text: 'All fees and prizes' }, 'Categories': { href: '/categories/', text: 'All categories' }, 'Organizations': { href: '/organizations/', text: 'All organizations' } };
    var html = '';
    keys.forEach(function(groupName) {
      groups[groupName].forEach(function(item) {
        html += '<div class="search-suggestion" style="padding:10px 20px; cursor:pointer; font-size:var(--fs-tag); color:var(--text); display:flex; justify-content:space-between; align-items:center;" data-type="' + item.type + '" data-value="' + esc(item.value) + '" data-label="' + esc(item.label) + '">';
        html += '<span>' + esc(item.label) + '</span>';
        html += '<span style="color:var(--text-muted);">' + item.count + '</span>';
        html += '</div>';
      });
      if (browseLinks[groupName]) {
        var link = browseLinks[groupName];
        html += '<a href="' + link.href + '" style="display:block; padding:10px 20px; font-size:var(--fs-tag); color:var(--text-muted); text-decoration:none; letter-spacing:0.3px;">' + link.text + ' &rarr;</a>';
      }
    });
    searchDropdown.innerHTML = html;
    searchDropdown.style.display = 'block';
    searchDropdown.style.pointerEvents = 'none';
    setTimeout(function() { searchDropdown.style.pointerEvents = ''; }, 300);
    selectedSuggestion = -1;
    searchDropdown.querySelectorAll('.search-suggestion').forEach(function(el) {
      el.addEventListener('mouseenter', function() { el.style.background = 'var(--card-bg)'; });
      el.addEventListener('mouseleave', function() { el.style.background = ''; });
      el.addEventListener('mousedown', function(e) {
        e.preventDefault();
        navigateToSearch(el.dataset.type, el.dataset.value);
      });
    });
  }

  function hideDropdown() {
    searchDropdown.style.display = 'none';
    selectedSuggestion = -1;
  }

  function navigateToSearch(type, value) {
    // Redirect fee filters to dedicated pages
    if (type === 'fee' && value === 'free') { window.location.href = '/fees/free/'; return; }
    if (type === 'fee' && value === 'paid') { window.location.href = '/fees/entry-fee/'; return; }
    window.location.href = '/?chip=' + encodeURIComponent(type + ':' + value);
  }

  function navigateToFreeText() {
    var q = searchInput.value.trim();
    if (q) window.location.href = '/?q=' + encodeURIComponent(q);
  }

  searchInput.addEventListener('focus', function() {
    loadData(function() {
      showDropdown(buildSuggestions(searchInput.value));
    });
    openMobileSearch();
  });

  searchInput.addEventListener('input', function(e) {
    searchClear.classList.toggle('visible', e.target.value.length > 0);
    loadData(function() {
      showDropdown(buildSuggestions(e.target.value));
    });
  });

  searchInput.addEventListener('blur', function() {
    if (!isMobile()) setTimeout(hideDropdown, 150);
  });

  searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideDropdown();
      if (isMobile()) closeMobileSearch();
      return;
    }
    if (searchDropdown.style.display === 'none') {
      if (e.key === 'Enter') { navigateToFreeText(); return; }
      return;
    }
    var items = searchDropdown.querySelectorAll('.search-suggestion');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedSuggestion = Math.min(selectedSuggestion + 1, items.length - 1);
      items.forEach(function(el, i) { el.style.background = i === selectedSuggestion ? 'var(--card-bg-hover)' : ''; });
      if (selectedSuggestion >= 0) items[selectedSuggestion].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedSuggestion = Math.max(selectedSuggestion - 1, -1);
      items.forEach(function(el, i) { el.style.background = i === selectedSuggestion ? 'var(--card-bg-hover)' : ''; });
      if (selectedSuggestion >= 0) items[selectedSuggestion].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestion >= 0 && items[selectedSuggestion]) {
        var el = items[selectedSuggestion];
        navigateToSearch(el.dataset.type, el.dataset.value);
      } else {
        navigateToFreeText();
      }
    }
  });

  searchClear.addEventListener('click', function() {
    searchInput.value = '';
    searchClear.classList.remove('visible');
    hideDropdown();
    searchInput.focus();
  });

  // Close dropdown on outside click
  document.addEventListener('mousedown', function(e) {
    if (!searchWrap.contains(e.target) && (!searchToggle || !searchToggle.contains(e.target))) {
      hideDropdown();
      if (isMobile()) closeMobileSearch();
    }
  });
})();
