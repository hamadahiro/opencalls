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

  // Track all outbound link clicks
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (!link) return;
    var href = link.href;
    if (!href || href.indexOf('http') !== 0) return;
    try {
      var linkHost = new URL(href).hostname;
      if (linkHost === location.hostname) return;
      gtag('event', 'click', {
        event_category: 'outbound',
        event_label: href,
        link_url: href,
        transport_type: 'beacon'
      });
    } catch(ex) {}
  });
})();
