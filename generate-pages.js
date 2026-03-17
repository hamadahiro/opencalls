const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const SITE = 'https://opencalls.monographica.com';
const RESERVED = ['index', 'style', 'data', 'favicon', 'apple-touch-icon', 'og-image', 'bg', 'call-detail', 'cards', 'generate-pages', 'sitemap', 'CNAME', 'robots', 'photography', 'exhibitions', 'grants', 'residencies', 'zines', 'education', 'categories', 'countries', 'organizations'];

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
  const deadline = call.deadline === 'Continuous' ? 'Rolling deadline.' : `Deadline: ${formatDeadline(call.deadline)}.`;
  const maxLen = 157 - deadline.length - 1;
  const first = desc.split('. ').slice(0, 2).join('. ');
  const trimmed = first.length > maxLen ? first.substring(0, maxLen - 3) + '...' : first + '.';
  return escapeHtml(trimmed + ' ' + deadline);
}

function buildKeywords(call) {
  const words = [call.title, call.org, categoryLabel(call.category), 'open call', 'call for entries'];
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

// Compute countries for landing pages (including Online)
const countryCounts = {};
data.calls.forEach(call => {
  const country = getCountry(call.location);
  if (country) {
    countryCounts[country] = (countryCounts[country] || 0) + 1;
  }
});
const countryPages = Object.keys(countryCounts).map(c => slugify(c));

// Compute orgs for landing pages
const orgCounts = {};
data.calls.forEach(call => { orgCounts[call.org] = (orgCounts[call.org] || 0) + 1; });
const orgPages = Object.keys(orgCounts).map(o => slugify(o));

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
  <title>${escapeHtml(call.title)} - Monographica Open Calls</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${escapeHtml(buildKeywords(call))}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(call.title)} - Monographica Open Calls">
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

      <div class="call-detail-meta" id="detailMeta"></div>

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
    const CURRENT_CALL = ${JSON.stringify({ prize: call.prize || '', category: call.category, org: call.org, location: call.location || '', fee: call.fee || '', deadline: call.deadline })};
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
  'photography': { title: 'Photography Open Calls', desc: 'Competitions, awards, and call for entries for photographers worldwide. Submit your work to juried exhibitions, contests, and portfolio reviews.', keywords: 'photography open calls, call for entries photography, photo competitions 2026, photography submissions, photography awards, photography grants, photography contests' },
  'exhibition': { title: 'Exhibition Open Calls', desc: 'Call for entries for group and solo exhibitions worldwide. Gallery shows, curated exhibitions, and art fair opportunities for visual artists.', keywords: 'exhibition open calls, call for entries exhibition, art exhibition submissions, gallery open call, group exhibition, art show submissions' },
  'grant': { title: 'Grants for Photographers & Visual Artists', desc: 'Funding opportunities for photographers and visual artists. Project grants, production funds, and artist support programs — apply now.', keywords: 'photography grants 2026, artist grants, call for entries grants, art funding, project grants for photographers, artist funding opportunities' },
  'residency': { title: 'Artist Residencies for Photographers', desc: 'Residency programs for photographers and visual artists worldwide. Studio residencies, international programs, and creative retreats.', keywords: 'artist residency 2026, photography residency, call for entries residency, art residency programs, international artist residency' },
  'zine': { title: 'Zine & Photobook Open Calls', desc: 'Submit to photobook prizes, zine publications, and dummy awards. Publishing opportunities for photographers and visual artists.', keywords: 'photobook open call, call for entries photobook, zine submissions, photography publications, dummy award, photo book prize' },
  'education': { title: 'Photography Workshops & Education', desc: 'Workshops, masterclasses, mentoring programs, and educational opportunities for photographers and visual artists worldwide.', keywords: 'photography workshops, photography masterclass, call for entries education, photography mentoring, photography education, artist development' }
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
  <title>${info.title} 2026 - Monographica Open Calls</title>
  <meta name="description" content="${escapeHtml(info.desc)}">
  <meta name="keywords" content="${escapeHtml(info.keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${info.title} 2026 - Monographica Open Calls">
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
      <nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/categories">Categories</a> / <span>${categoryLabel(cat)}</span></nav>
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
  .forEach(([country, count]) => {
    const fullName = countryNames[country] || country;
    const slug = slugify(country);
    const isOnline = country === 'Online';
    const title = isOnline ? 'Online Open Calls for Artists' : `Open Calls for Artists in ${fullName}`;
    const desc = isOnline
      ? 'Online open calls, competitions, and submissions for photographers and visual artists. No travel required — apply from anywhere.'
      : `Find open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullName}. Browse and apply today.`;
    const keywords = isOnline
      ? 'online open calls, online photography competitions, remote art submissions, virtual exhibitions, online call for entries, photography contests online'
      : `open calls ${fullName}, call for entries ${fullName}, photography opportunities ${fullName}, art exhibitions ${fullName}, photography grants ${fullName}, artist residency ${fullName}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(title)} 2026 - Monographica Open Calls</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(title)} 2026 - Monographica Open Calls">
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
      <nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/countries">Countries</a> / <span>${escapeHtml(fullName)}</span></nav>
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

// === Org landing pages ===
Object.entries(orgCounts)
  .forEach(([org, count]) => {
    const slug = slugify(org);
    const title = `${org} - Open Calls`;
    const desc = `Open calls and submission opportunities from ${org}. Browse exhibitions, grants, residencies, and more for photographers and visual artists.`;
    const keywords = `${org} open call, ${org} call for entries, ${org} submissions, ${org} photography, ${org} exhibition, ${org} artists`;

    // Check for slug collision with call pages
    if (slugMap[slug]) {
      console.warn(`  SKIPPED org page: ${slug} collides with call "${slugMap[slug]}"`);
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(title)} - Monographica Open Calls</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(title)} - Monographica Open Calls">
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
    "name": "${escapeHtml(org)} - Open Calls",
    "description": "${escapeHtml(desc)}",
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
      <nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/organizations">Organizations</a> / <span>${escapeHtml(org)}</span></nav>
      <h1>${escapeHtml(org)}</h1>
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
    const FILTER_ORG = '${org.replace(/'/g, "\\'")}';
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const container = document.getElementById('callsList');

      let calls = data.calls
        .filter(c => c.org === FILTER_ORG)
        .map(processCall);

      // Show all calls (open + closed) for org pages
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

      if (!calls.length) container.innerHTML = '<p class="empty-state">No calls from this organization.</p>';
    }
    loadFiltered();
  </script>

</body>
</html>`;

    fs.writeFileSync(`${slug}.html`, html);
    sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Org page: ${slug} (${count} calls)`);
  });

// Add index pages to sitemap
sitemapEntries.push(`${SITE}/categories`);
sitemapEntries.push(`${SITE}/countries`);
sitemapEntries.push(`${SITE}/organizations`);

// Update countryPages and orgPages lists in cards.js
const countryPageSlugs = Object.keys(countryCounts).map(c => slugify(c));
const orgPageSlugs = Object.keys(orgCounts).map(o => slugify(o));
let cardsJs = fs.readFileSync('cards.js', 'utf8');
cardsJs = cardsJs.replace(
  /const countryPages = \[.*?\];/,
  `const countryPages = ${JSON.stringify(countryPageSlugs)};`
);
cardsJs = cardsJs.replace(
  /const orgPages = \[.*?\];/,
  `const orgPages = ${JSON.stringify(orgPageSlugs)};`
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
