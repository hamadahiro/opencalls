// Google Analytics
(function() {
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=G-PGN8M3LZMZ';
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-PGN8M3LZMZ');

  // Helper: detect page type from URL
  function getPageType() {
    var p = location.pathname;
    if (p === '/') return 'home';
    if (p === '/browse/') return 'browse';
    if (p === '/submit/') return 'submit';
    if (p === '/404.html') return '404';
    if (p.startsWith('/categories/')) return 'categories_index';
    if (p.startsWith('/locations/')) return 'locations_index';
    if (p.startsWith('/organizations/')) return 'organizations_index';
    if (p.startsWith('/eligibility/')) return p === '/eligibility/' ? 'eligibility_index' : 'eligibility';
    if (p.startsWith('/prize/')) return p === '/prize/' ? 'prize_index' : 'prize';
    if (p.startsWith('/fees/')) return p === '/fees/' ? 'fees_index' : 'fee';
    if (p.startsWith('/deadlines/')) return p === '/deadlines/' ? 'deadlines_index' : 'deadline';
    if (p.startsWith('/united-states/')) return 'state';
    // Individual call detail pages have CURRENT_CALL defined
    if (typeof CURRENT_CALL !== 'undefined') return 'call_detail';
    return 'collection';
  }

  // Set page type as a custom dimension on every page
  gtag('set', { page_type: getPageType() });

  // --- Outbound link clicks ---
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.href;
    if (!href || href.indexOf('http') !== 0) return;
    try {
      var linkHost = new URL(href).hostname;
      if (linkHost === location.hostname) return;

      // Classify the outbound link
      var linkType = 'other';
      if (link.id === 'applyBtn' || link.closest('.call-detail-actions')) linkType = 'apply_button';
      else if (linkHost.includes('instagram.com')) linkType = 'instagram';
      else if (link.closest('.info-row')) linkType = 'detail_info_link';
      else if (link.closest('.call-card')) linkType = 'card_link';
      else if (link.closest('footer') || link.closest('.site-footer')) linkType = 'footer';

      gtag('event', 'outbound_click', {
        link_url: href,
        link_type: linkType,
        page_type: getPageType(),
        transport_type: 'beacon'
      });
    } catch(ex) {}
  });

  // --- Internal navigation clicks ---
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.indexOf('http') === 0) return;

    // Meta tag clicks (category, location, eligibility, prize, fee tags on cards)
    if (link.classList.contains('meta-tag-link')) {
      gtag('event', 'tag_click', {
        tag_url: href,
        tag_text: link.textContent.trim(),
        page_type: getPageType()
      });
      return;
    }

    // Deadline badge clicks
    if (link.classList.contains('call-deadline')) {
      gtag('event', 'deadline_click', {
        deadline_text: link.textContent.trim(),
        deadline_url: href,
        page_type: getPageType()
      });
      return;
    }

    // Call card title clicks (user opening a call detail page)
    if (link.closest('.call-title')) {
      gtag('event', 'call_open', {
        call_url: href,
        call_title: link.textContent.trim(),
        page_type: getPageType()
      });
      return;
    }

    // Breadcrumb clicks
    if (link.closest('.breadcrumbs')) {
      gtag('event', 'breadcrumb_click', {
        breadcrumb_url: href,
        breadcrumb_text: link.textContent.trim()
      });
      return;
    }

    // Browse index clicks (category/location/org/eligibility index items)
    if (link.closest('.index-list') || link.closest('.index-item')) {
      gtag('event', 'index_click', {
        index_url: href,
        index_text: link.textContent.trim(),
        page_type: getPageType()
      });
      return;
    }

    // Info row links on detail pages (organizer, category, location, etc.)
    if (link.closest('.info-row')) {
      var label = link.closest('.info-row').querySelector('.info-label');
      gtag('event', 'detail_link_click', {
        detail_field: label ? label.textContent.trim() : 'unknown',
        detail_url: href,
        detail_text: link.textContent.trim()
      });
      return;
    }

    // Navigation links (Open, Closed, New, Browse, Submit)
    if (link.closest('.nav-bar') || link.closest('.responsive-nav')) {
      gtag('event', 'nav_click', {
        nav_text: link.textContent.trim(),
        nav_url: href
      });
    }
  });

  // --- Filter button clicks (home page) ---
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('.filter-btn');
    if (!btn) return;
    gtag('event', 'filter_click', {
      filter_value: btn.dataset.filter || btn.textContent.trim()
    });
  });

  // --- View toggle (Open / Closed / New) ---
  document.addEventListener('click', function(e) {
    var viewLink = e.target.closest('[data-view]');
    if (!viewLink) return;
    gtag('event', 'view_change', {
      view_name: viewLink.dataset.view
    });
  });

  // --- Search events ---
  (function() {
    var searchInput = document.getElementById('searchInput') || document.getElementById('globalSearchInput');
    if (!searchInput) return;

    // Track search usage (debounced — fires after user stops typing)
    var searchTimer = null;
    searchInput.addEventListener('input', function() {
      clearTimeout(searchTimer);
      var val = searchInput.value.trim();
      if (!val) return;
      searchTimer = setTimeout(function() {
        gtag('event', 'search', {
          search_term: val,
          page_type: getPageType()
        });
      }, 1500);
    });
  })();

  // --- Search suggestion / chip selection ---
  document.addEventListener('mousedown', function(e) {
    var suggestion = e.target.closest('.search-suggestion');
    if (!suggestion) return;
    gtag('event', 'search_suggestion_click', {
      suggestion_type: suggestion.dataset.type,
      suggestion_value: suggestion.dataset.value,
      suggestion_label: suggestion.dataset.label,
      page_type: getPageType()
    });
  });

  // --- Chip removal ---
  document.addEventListener('click', function(e) {
    var chip = e.target.closest('.meta-tag[onclick*="removeChip"]');
    if (!chip) return;
    gtag('event', 'chip_remove', {
      chip_text: chip.textContent.trim().replace(/\u00d7$/, '').trim()
    });
  });

  // --- Calendar download (call detail pages) ---
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#calBtn, [onclick*="downloadICS"]');
    if (!btn) return;
    gtag('event', 'calendar_download', {
      call_title: typeof CURRENT_CALL !== 'undefined' ? CURRENT_CALL.title : document.title,
      call_url: location.pathname
    });
  });

  // --- "More like this" / similar call clicks ---
  document.addEventListener('click', function(e) {
    var card = e.target.closest('#similarCalls .call-card');
    if (!card) return;
    var titleLink = card.querySelector('.call-title a');
    if (!titleLink) return;
    gtag('event', 'similar_call_click', {
      similar_call_url: titleLink.getAttribute('href'),
      similar_call_title: titleLink.textContent.trim(),
      source_call: location.pathname
    });
  });

  // --- Empty state / no results ---
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(node) {
        if (node.nodeType === 1 && node.classList && node.classList.contains('empty-state')) {
          gtag('event', 'empty_results', {
            page_type: getPageType(),
            page_url: location.pathname + location.search
          });
        }
      });
    });
  });
  var callsList = document.getElementById('callsList');
  if (callsList) observer.observe(callsList, { childList: true, subtree: true });

  // --- Scroll depth tracking (25%, 50%, 75%, 100%) ---
  (function() {
    var thresholds = [25, 50, 75, 100];
    var reached = {};
    function getScrollPercent() {
      var h = document.documentElement;
      var b = document.body;
      var scrollTop = h.scrollTop || b.scrollTop;
      var scrollHeight = (h.scrollHeight || b.scrollHeight) - h.clientHeight;
      if (scrollHeight <= 0) return 100;
      return Math.round((scrollTop / scrollHeight) * 100);
    }
    window.addEventListener('scroll', function() {
      var pct = getScrollPercent();
      thresholds.forEach(function(t) {
        if (pct >= t && !reached[t]) {
          reached[t] = true;
          gtag('event', 'scroll_depth', {
            depth_threshold: t,
            page_type: getPageType()
          });
        }
      });
    }, { passive: true });
  })();

  // --- Time on page milestones ---
  (function() {
    var milestones = [30, 60, 120, 300];
    var elapsed = 0;
    var interval = setInterval(function() {
      if (document.hidden) return;
      elapsed++;
      var idx = milestones.indexOf(elapsed);
      if (idx !== -1) {
        gtag('event', 'engaged_time', {
          seconds: elapsed,
          page_type: getPageType()
        });
        if (idx === milestones.length - 1) clearInterval(interval);
      }
    }, 1000);
  })();

  // --- 404 page tracking ---
  if (location.pathname === '/404.html' || document.title.indexOf('404') !== -1) {
    gtag('event', 'page_not_found', {
      page_url: location.href,
      referrer: document.referrer
    });
  }

  // --- Mobile hamburger menu ---
  document.addEventListener('click', function(e) {
    if (e.target.closest('.hamburger-click-area')) {
      gtag('event', 'hamburger_menu', {
        action: document.body.classList.contains('show-responsive-nav') ? 'open' : 'close'
      });
    }
  });

  // --- RSS feed link clicks ---
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href*="feed.xml"]');
    if (link) {
      gtag('event', 'rss_click', {
        page_type: getPageType()
      });
    }
  });
})();
