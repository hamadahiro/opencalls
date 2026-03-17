const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const SITE = 'https://opencalls.monographica.com';
const RESERVED = ['index', 'style', 'data', 'favicon', 'apple-touch-icon', 'og-image', 'bg', 'call-detail', 'cards', 'generate-pages', 'sitemap', 'CNAME', 'robots', 'photography', 'exhibitions', 'grants', 'residencies', 'zines', 'education'];

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getCountry(location) {
  if (!location) return '';
  const parts = location.split(',');
  return parts[parts.length - 1].trim();
}

function formatDeadline(deadline) {
  if (deadline === 'Continuous') return 'Continuous';
  const d = new Date(deadline);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function metaDescription(call) {
  const desc = call.description;
  const first = desc.split('. ').slice(0, 2).join('. ');
  const trimmed = first.length > 155 ? first.substring(0, 152) + '...' : first + '.';
  const deadline = call.deadline === 'Continuous' ? 'Rolling deadline.' : `Deadline: ${formatDeadline(call.deadline)}.`;
  return escapeHtml(trimmed + ' ' + deadline);
}

function buildKeywords(call) {
  const words = [call.title, call.org, categoryLabel(call.category), 'open call'];
  if (call.location && call.location !== 'Online') words.push(call.location);
  if (call.category === 'photography') words.push('photography competition', 'photo contest');
  if (call.category === 'grant') words.push('artist grant', 'photography grant');
  if (call.category === 'residency') words.push('artist residency');
  if (call.category === 'exhibition') words.push('art exhibition');
  if (call.category === 'zine') words.push('photobook', 'zine submission');
  words.push('open calls for artists', 'photography submissions');
  return words.join(', ');
}

function categoryLabel(cat) {
  const labels = {
    'photography': 'Photography', 'exhibition': 'Exhibition', 'grant': 'Grant',
    'zine': 'Zines & Books', 'residency': 'Residency', 'education': 'Education'
  };
  return labels[cat] || cat;
}

function buildInfoRows(call) {
  const rows = [];
  rows.push(`<div><dt>Deadline</dt><dd>${formatDeadline(call.deadline)}</dd></div>`);
  if (call.fee) rows.push(`<div><dt>Entry Fee</dt><dd>${escapeHtml(call.fee)}</dd></div>`);
  rows.push(`<div><dt>Category</dt><dd>${categoryLabel(call.category)}</dd></div>`);
  if (call.location) rows.push(`<div><dt>Location</dt><dd>${escapeHtml(call.location)}</dd></div>`);
  rows.push(`<div><dt>Organizer</dt><dd>${escapeHtml(call.org)}</dd></div>`);
  if (call.prize) rows.push(`<div><dt>Prize</dt><dd>${escapeHtml(call.prize)}</dd></div>`);
  if (call.instagram) {
    const handle = call.instagram.replace('@', '');
    rows.push(`<div><dt>Instagram</dt><dd><a href="https://instagram.com/${handle}" target="_blank" rel="nofollow noopener">${escapeHtml(call.instagram)}</a></dd></div>`);
  }
  return rows.join('\n        ');
}

const catSlugs = {
  'photography': 'photography', 'exhibition': 'exhibitions', 'grant': 'grants',
  'zine': 'zines', 'residency': 'residencies', 'education': 'education'
};
// Compute countries with 2+ calls for landing pages
const countryCounts = {};
data.calls.forEach(call => {
  const country = getCountry(call.location);
  if (country && country !== 'Online') {
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  }
});
const countryPages = Object.keys(countryCounts).filter(c => countryCounts[c] >= 2).map(c => slugify(c));

function buildMetaTags(call) {
  const tags = [];
  if (call.prize) tags.push(`<span class="meta-tag call-prize">${escapeHtml(call.prize)}</span>`);
  tags.push(`<a href="/${catSlugs[call.category]}" class="meta-tag meta-tag-link">${categoryLabel(call.category)}</a>`);
  tags.push(`<span class="meta-tag">${escapeHtml(call.org)}</span>`);
  if (call.location) {
    const country = getCountry(call.location);
    const countrySlug = slugify(country);
    if (country !== 'Online' && countryPages.includes(countrySlug)) {
      tags.push(`<a href="/${countrySlug}" class="meta-tag meta-tag-link"><svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${escapeHtml(call.location)}</a>`);
    } else {
      tags.push(`<span class="meta-tag"><svg class="pin-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>${escapeHtml(call.location)}</span>`);
    }
  }
  if (call.fee && call.fee !== 'Check website') tags.push(`<span class="meta-tag">${escapeHtml(call.fee)}</span>`);
  return tags.join('\n        ');
}

function buildJsonLd(call, slug) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": call.title,
    "description": call.description,
    "url": call.url,
    "organizer": { "@type": "Organization", "name": call.org }
  };
  if (call.location) ld.location = { "@type": "Place", "name": call.location };
  if (call.deadline !== 'Continuous') ld.endDate = call.deadline;
  if (call.fee === 'Free') ld.isAccessibleForFree = true;
  return JSON.stringify(ld, null, 2);
}

function generatePage(call, cssVersion) {
  const slug = slugify(call.title);
  const desc = metaDescription(call);
  const country = getCountry(call.location);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(call.title)} - Open Calls for Artists - Monographica</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${escapeHtml(buildKeywords(call))}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(call.title)} - Open Calls for Artists - Monographica">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${SITE}/og-image.jpg">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  ${buildJsonLd(call, slug)}
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=${cssVersion}">
</head>
<body>

  <header>
    <div class="header-inner">
      <a href="https://monographica.com" class="logo">Monographica</a>
      <nav>
        <a href="/" class="nav-link">Open</a>
        <a href="/?view=past" class="nav-link">Closed</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="call-detail">
      <a href="/" class="call-detail-back">&larr; All open calls</a>

      <h1 class="call-detail-title">${escapeHtml(call.title)}</h1>

      <div class="call-detail-meta">
        ${buildMetaTags(call)}
      </div>

      <p class="call-detail-description">${escapeHtml(call.description)}</p>

      <dl class="call-detail-info">
        ${buildInfoRows(call)}
      </dl>

      <div class="call-detail-actions">
        <a href="${escapeHtml(call.url)}" target="_blank" rel="nofollow noopener" class="call-detail-apply">Visit Official Website</a>
        <a href="/" class="call-detail-back">&larr; Back to all calls</a>
      </div>
    </section>

    <section class="related-calls">
      <div id="relatedOrg"></div>
      <div id="relatedCountry"></div>
    </section>

    <footer class="about-section" id="footer">
      <p class="disclaimer">Information is provided for convenience. Details may change. Always verify them on the official call website.</p>
      <p>&copy; ${new Date().getFullYear()} HH &mdash; still making sense of things.</p>
    </footer>
  </main>

  <script>
    const CURRENT_SLUG = '${slug}';
    const CURRENT_ORG = '${call.org.replace(/'/g, "\\'")}';
    const CURRENT_COUNTRY = '${country.replace(/'/g, "\\'")}';
    const CURRENT_DEADLINE = '${call.deadline}';
  </script>
  <script src="cards.js"></script>
  <script src="call-detail.js"></script>

</body>
</html>`;
}

// Get CSS version from index.html
const indexHtml = fs.readFileSync('index.html', 'utf8');
const cssVersionMatch = indexHtml.match(/style\.css\?v=([^"]+)/);
const cssVersion = cssVersionMatch ? cssVersionMatch[1] : '20260317b';

// Track slugs to detect collisions
const slugMap = {};
const sitemapEntries = [];
let generated = 0;
let skipped = 0;

data.calls.forEach(call => {
  const slug = slugify(call.title);

  if (RESERVED.includes(slug)) {
    console.warn(`SKIPPED (reserved name): ${slug} — "${call.title}"`);
    skipped++;
    return;
  }

  if (slugMap[slug]) {
    console.warn(`SKIPPED (duplicate slug): ${slug} — "${call.title}" collides with "${slugMap[slug]}"`);
    skipped++;
    return;
  }

  slugMap[slug] = call.title;
  const html = generatePage(call, cssVersion);
  fs.writeFileSync(`${slug}.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  generated++;
});

// === Category landing pages ===
const categories = {
  'photography': { title: 'Photography Open Calls', desc: 'Open calls, competitions, and submission opportunities for photographers. Awards, exhibitions, grants, and more.', keywords: 'photography open calls, photo competitions 2026, photography submissions, photography awards, photography grants, photography contests' },
  'exhibition': { title: 'Exhibition Open Calls', desc: 'Open calls for art exhibitions worldwide. Group shows, solo exhibitions, and curated exhibitions for visual artists and photographers.', keywords: 'exhibition open calls, art exhibition submissions, group exhibition call for artists, gallery open call, art show submissions' },
  'grant': { title: 'Photography Grants', desc: 'Grants and funding opportunities for photographers and visual artists. Project grants, production funds, and artist support programs.', keywords: 'photography grants 2026, artist grants, art funding, project grants for photographers, artist funding opportunities' },
  'residency': { title: 'Artist Residencies', desc: 'Artist residency programs for photographers and visual artists. Studio residencies, international programs, and creative retreats.', keywords: 'artist residency 2026, photography residency, art residency programs, international artist residency, creative residency' },
  'zine': { title: 'Zine & Photobook Open Calls', desc: 'Open calls for zines, photobooks, and publications. Dummy awards, publishing opportunities, and editorial submissions.', keywords: 'photobook open call, zine submissions, photography publications, dummy award, photo book prize, zine call for artists' },
  'education': { title: 'Photography Education', desc: 'Workshops, masterclasses, mentoring programs, and educational opportunities for photographers and visual artists.', keywords: 'photography workshops, photography masterclass, photography mentoring, photography education, artist development programs' }
};

Object.entries(categories).forEach(([cat, info]) => {
  const slug = cat === 'zine' ? 'zines' : cat === 'exhibition' ? 'exhibitions' : cat === 'residency' ? 'residencies' : cat === 'grant' ? 'grants' : cat;
  const count = data.calls.filter(c => c.category === cat).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${info.title} 2026 - Open Calls for Artists - Monographica</title>
  <meta name="description" content="${escapeHtml(info.desc)}">
  <meta name="keywords" content="${escapeHtml(info.keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${info.title} 2026 - Open Calls for Artists - Monographica">
  <meta property="og:description" content="${escapeHtml(info.desc)}">
  <meta property="og:image" content="${SITE}/og-image.jpg">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${info.title} 2026",
    "description": "${info.desc}",
    "url": "${SITE}/${slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=${cssVersion}">
</head>
<body>

  <header>
    <div class="header-inner">
      <a href="https://monographica.com" class="logo">Monographica</a>
      <nav>
        <a href="/" class="nav-link">Open</a>
        <a href="/?view=past" class="nav-link">Closed</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <h1>${info.title}</h1>
      <h2 class="subtitle">${escapeHtml(info.desc)}</h2>
    </section>

    <section class="calls-list" id="callsList"></section>

    <footer class="about-section" id="footer">
      <p class="disclaimer">Information is provided for convenience. Details may change. Always verify them on the official call website.</p>
      <p>&copy; ${new Date().getFullYear()} HH &mdash; still making sense of things.</p>
    </footer>
  </main>

  <script src="cards.js"></script>
  <script>
    const FILTER_CATEGORY = '${cat}';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const now = new Date();
      const container = document.getElementById('callsList');

      let calls = data.calls
        .filter(c => c.category === FILTER_CATEGORY)
        .map(processCall)
        .filter(c => c.urgencyClass !== 'closed');

      calls.sort((a, b) => {
        if (a.deadline === 'Continuous' && b.deadline === 'Continuous') return 0;
        if (a.deadline === 'Continuous') return 1;
        if (b.deadline === 'Continuous') return -1;
        return a.deadlineDate - b.deadlineDate;
      });

      let currentSection = '';
      calls.forEach(call => {
        const section = call.deadline === 'Continuous' ? 'Continuous' : monthNames[call.deadlineDate.getMonth()] + ' ' + call.deadlineDate.getFullYear();
        if (section !== currentSection) {
          currentSection = section;
          container.insertAdjacentHTML('beforeend', '<h3 class="section-header">' + section + '</h3>');
        }
        container.insertAdjacentHTML('beforeend', renderCard(call, 'h4'));
      });

      if (!calls.length) container.innerHTML = '<p class="empty-state">No open calls in this category right now.</p>';
    }
    loadFiltered();
  </script>

</body>
</html>`;

  fs.writeFileSync(`${slug}.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Category page: ${slug} (${count} calls)`);
});

// === Country landing pages ===
// Only create pages for countries with 2+ calls
const countryNames = {
  'USA': 'United States', 'UK': 'United Kingdom', 'UAE': 'United Arab Emirates'
};

Object.entries(countryCounts)
  .filter(([country, count]) => count >= 2)
  .forEach(([country, count]) => {
    const fullName = countryNames[country] || country;
    const slug = slugify(country);
    const title = `Open Calls for Artists in ${fullName}`;
    const desc = `Open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullName}. Updated regularly.`;
    const keywords = `open calls ${fullName}, art exhibitions ${fullName}, photography grants ${fullName}, artist residency ${fullName}, art submissions ${fullName}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(title)} 2026 - Monographica</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(title)} 2026 - Monographica">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${SITE}/og-image.jpg">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${title} 2026",
    "description": "${desc}",
    "url": "${SITE}/${slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;700&family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css?v=${cssVersion}">
</head>
<body>

  <header>
    <div class="header-inner">
      <a href="https://monographica.com" class="logo">Monographica</a>
      <nav>
        <a href="/" class="nav-link">Open</a>
        <a href="/?view=past" class="nav-link">Closed</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      <h2 class="subtitle">${escapeHtml(desc)}</h2>
    </section>

    <section class="calls-list" id="callsList"></section>

    <footer class="about-section" id="footer">
      <p class="disclaimer">Information is provided for convenience. Details may change. Always verify them on the official call website.</p>
      <p>&copy; ${new Date().getFullYear()} HH &mdash; still making sense of things.</p>
    </footer>
  </main>

  <script src="cards.js"></script>
  <script>
    const FILTER_COUNTRY = '${country.replace(/'/g, "\\'")}';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    function getCountry(loc) {
      if (!loc) return '';
      const parts = loc.split(',');
      return parts[parts.length - 1].trim();
    }

    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const container = document.getElementById('callsList');

      let calls = data.calls
        .filter(c => getCountry(c.location) === FILTER_COUNTRY)
        .map(processCall)
        .filter(c => c.urgencyClass !== 'closed');

      calls.sort((a, b) => {
        if (a.deadline === 'Continuous' && b.deadline === 'Continuous') return 0;
        if (a.deadline === 'Continuous') return 1;
        if (b.deadline === 'Continuous') return -1;
        return a.deadlineDate - b.deadlineDate;
      });

      let currentSection = '';
      calls.forEach(call => {
        const section = call.deadline === 'Continuous' ? 'Continuous' : monthNames[call.deadlineDate.getMonth()] + ' ' + call.deadlineDate.getFullYear();
        if (section !== currentSection) {
          currentSection = section;
          container.insertAdjacentHTML('beforeend', '<h3 class="section-header">' + section + '</h3>');
        }
        container.insertAdjacentHTML('beforeend', renderCard(call, 'h4'));
      });

      if (!calls.length) container.innerHTML = '<p class="empty-state">No open calls in this country right now.</p>';
    }
    loadFiltered();
  </script>

</body>
</html>`;

    fs.writeFileSync(`${slug}.html`, html);
    sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Country page: ${slug} (${count} calls)`);
  });

// Update countryPages list in cards.js
const countryPageSlugs = Object.keys(countryCounts).filter(c => countryCounts[c] >= 2).map(c => slugify(c));
let cardsJs = fs.readFileSync('cards.js', 'utf8');
cardsJs = cardsJs.replace(
  /const countryPages = \[.*?\];/,
  `const countryPages = ${JSON.stringify(countryPageSlugs)};`
);
fs.writeFileSync('cards.js', cardsJs);

// Generate sitemap.xml
const today = new Date().toISOString().split('T')[0];
const allUrls = [`${SITE}/`, ...sitemapEntries];

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${today}</lastmod>
  </url>`).join('\n')}
</urlset>`;

fs.writeFileSync('sitemap.xml', sitemapXml);

console.log(`Generated ${generated} pages, skipped ${skipped}, sitemap has ${allUrls.length} URLs`);
