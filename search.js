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
    }).catch(function() {});
  }

  function getOpenCalls() {
    var now = new Date();
    var today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    return allCalls.filter(function(c) { return c.deadline === 'Continuous' || c.deadline >= today; });
  }

  function buildSuggestions(query) {
    // Delegate to the shared logic in cards.js so home and non-home stay in sync.
    // No chip exclusion on detail pages; same on-focus behavior as home (skip
    // Categories) for consistency.
    return buildSearchSuggestions(allCalls, query, { skipCategoriesOnFocus: true });
  }

  function showDropdown(groups) {
    var keys = Object.keys(groups);
    if (!keys.length) { searchDropdown.style.display = 'none'; searchWrap.classList.remove('has-suggestions'); return; }
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
    searchWrap.classList.add('has-suggestions');
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
    searchWrap.classList.remove('has-suggestions');
    selectedSuggestion = -1;
  }

  function navigateToSearch(type, value) {
    var url = chipToUrl(type, value);
    if (url) { window.location.href = url; return; }
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

  // Debounce expensive suggestion-build (~4000 iterations over ~600 calls) so
  // mobile typing isn't blocked. Clear-button toggle stays immediate; the
  // dropdown render fires 150ms after the user stops typing.
  var searchInputTimer = null;
  searchInput.addEventListener('input', function(e) {
    var val = e.target.value;
    searchClear.classList.toggle('visible', val.length > 0);
    if (searchInputTimer) clearTimeout(searchInputTimer);
    searchInputTimer = setTimeout(function() {
      loadData(function() {
        showDropdown(buildSuggestions(val));
      });
    }, 150);
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
