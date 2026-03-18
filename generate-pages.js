const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const SITE = 'https://opencalls.monographica.com';
const YEAR = new Date().getFullYear();
const TITLE_SUFFIX = ' - Monographica';
const RESERVED = ['index', 'style', 'data', 'favicon', 'apple-touch-icon', 'og-image', 'bg', 'call-detail', 'cards', 'generate-pages', 'sitemap', 'CNAME', 'robots', '404', 'photography', 'exhibitions', 'grants', 'residencies', 'zines', 'education', 'categories', 'locations', 'organizations', 'free', 'prize', 'united-states'];
const MANUAL_FILES = ['index.html', '404.html'];

// GA — single external file
const GA_SNIPPET = `<script src="/analytics.js"></script>`;
const PRELOAD = `<link rel="preload" href="/data.json" as="fetch" crossorigin>`;

// Shared header and footer
const HEADER = `<header>
    <div class="header-inner">
      <a href="https://monographica.com" class="logo">Monographica</a>
      <nav>
        <a href="/" class="nav-link">Open</a>
        <a href="/?view=past" class="nav-link">Closed</a>
      </nav>
    </div>
  </header>`;

const FOOTER = `<footer class="about-section" id="footer">
      <p class="disclaimer">Information is provided for convenience. Details may change. Always verify them on the official call website.</p>
      <p>&copy; ${YEAR} HH &mdash; still making sense of things.</p>
    </footer>`;

function buildBreadcrumbs(section, sectionUrl) {
  return `<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="${sectionUrl}">${section}</a></nav>`;
}

function buildHero(breadcrumbs, title, subtitle) {
  return `<section class="hero">
      ${breadcrumbs}
      <h1>${title}</h1>
      <h2 class="subtitle">${subtitle}</h2>
    </section>`;
}

// Track generated files for cleanup at the end
const generatedFiles = new Set();
function writeGenerated(filepath, content) {
  const dir = path.dirname(filepath);
  if (dir !== '.' && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filepath, content);
  generatedFiles.add(filepath);
}

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

function jsonStr(str) {
  return JSON.stringify(str).slice(1, -1);
}

function formatDeadline(deadline) {
  if (deadline === 'Continuous') return 'Continuous';
  const d = new Date(deadline + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function metaDescription(call) {
  const desc = call.description;
  const deadline = call.deadline === 'Continuous' ? 'Rolling deadline.' : `Deadline: ${formatDeadline(call.deadline)}.`;
  const maxLen = 157 - deadline.length - 1;
  const first = desc.split('. ').slice(0, 2).join('. ');
  const trimmed = first.length > maxLen ? first.substring(0, maxLen - 3) + '...' : (first.endsWith('.') ? first : first + '.');
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
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(call.title)}${TITLE_SUFFIX}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${escapeHtml(buildKeywords(call))}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(call.title)}${TITLE_SUFFIX}">
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
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${HEADER}

  <main>
    <section class="call-detail">
      <nav class="breadcrumbs"><a href="/">All open calls</a></nav>

      <h1 class="call-detail-title">${escapeHtml(call.title)}</h1>

      <div class="call-detail-meta" id="detailMeta"></div>

      <p class="call-detail-description">${escapeHtml(call.description)}</p>

      <dl class="call-detail-info" id="detailInfo"></dl>

      <div class="call-detail-actions">
        <a href="${escapeHtml(call.url)}" target="_blank" rel="nofollow noopener" class="call-detail-apply">Go to submission &rarr;</a>
      </div>
    </section>

    <section class="related-calls">
      <div id="relatedOrg"></div>
      <div id="relatedCountry"></div>
    </section>

    ${FOOTER}
  </main>

  <script>
    const CURRENT_SLUG = '${slug}';
    const CURRENT_ORG = '${call.org.replace(/'/g, "\\'")}';
    const CURRENT_COUNTRY = '${country.replace(/'/g, "\\'")}';
    const CURRENT_DEADLINE = '${call.deadline}';
    const CURRENT_CALL = ${JSON.stringify({ prize: call.prize || '', category: call.category, org: call.org, location: call.location || '', fee: call.fee || '', deadline: call.deadline, instagram: call.instagram || '' })};
  </script>
  <script src="/cards.js"></script>
  <script src="/call-detail.js"></script>

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
const createdCountrySlugs = [];
const createdOrgSlugs = [];
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
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  generated++;
});

// === Category landing pages ===
const categories = {
  'photography': { title: 'Photography Open Calls', desc: 'Competitions, awards, and call for entries for photographers worldwide. Submit your work to juried exhibitions, contests, and portfolio reviews.', keywords: 'photography open calls, call for entries photography, photo competitions, photography submissions, photography awards, photography grants, photography contests' },
  'exhibition': { title: 'Exhibition Open Calls', desc: 'Call for entries for group and solo exhibitions worldwide. Gallery shows, curated exhibitions, and art fair opportunities for visual artists.', keywords: 'exhibition open calls, call for entries exhibition, art exhibition submissions, gallery open call, group exhibition, art show submissions' },
  'grant': { title: 'Grants for Photographers & Visual Artists', desc: 'Funding opportunities for photographers and visual artists. Project grants, production funds, and artist support programs — apply now.', keywords: 'photography grants, artist grants, call for entries grants, art funding, project grants for photographers, artist funding opportunities' },
  'residency': { title: 'Artist Residencies for Photographers', desc: 'Residency programs for photographers and visual artists worldwide. Studio residencies, international programs, and creative retreats.', keywords: 'artist residency, photography residency, call for entries residency, art residency programs, international artist residency' },
  'zine': { title: 'Zine & Photobook Open Calls', desc: 'Submit to photobook prizes, zine publications, and dummy awards. Publishing opportunities for photographers and visual artists.', keywords: 'photobook open call, call for entries photobook, zine submissions, photography publications, dummy award, photo book prize' },
  'education': { title: 'Photography Workshops & Education', desc: 'Workshops, masterclasses, mentoring programs, and educational opportunities for photographers and visual artists worldwide.', keywords: 'photography workshops, photography masterclass, call for entries education, photography mentoring, photography education, artist development' }
};

Object.entries(categories).forEach(([cat, info]) => {
  const catSlug = cat === 'zine' ? 'zines' : cat === 'exhibition' ? 'exhibitions' : cat === 'residency' ? 'residencies' : cat === 'grant' ? 'grants' : cat;
  const slug = catSlug;
  const count = data.calls.filter(c => c.category === cat).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${info.title} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(info.desc)}">
  <meta name="keywords" content="${escapeHtml(info.keywords + ', ' + YEAR)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.jpg">
  <meta property="og:title" content="${info.title} ${YEAR}${TITLE_SUFFIX}">
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
    "name": "${jsonStr(info.title)} ${YEAR}",
    "description": "${jsonStr(info.desc)}",
    "url": "${SITE}/${slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${HEADER}

  <main>
    ${buildHero(buildBreadcrumbs('Categories', '/categories'), info.title, escapeHtml(info.desc))}

    <section class="calls-list" id="callsList"></section>

    ${FOOTER}
  </main>

  <script src="/cards.js"></script>
  <script>
    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.category === '${cat}').map(processCall);
      renderCallList(calls, document.getElementById('callsList'));
    }
    loadFiltered();
  </script>

</body>
</html>`;

  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Category page: ${slug} (${count} calls)`);
});

// === Special filter pages (Free, Prize) ===
const filterPages = [
  {
    slug: 'free',
    title: 'Free Open Calls for Artists',
    desc: 'Open calls with no entry fee. Free exhibitions, grants, residencies, and submissions for photographers and visual artists.',
    keywords: 'free open calls, free photography competitions, no fee art submissions, free call for entries, free exhibitions',
    filterJs: `c.fee && c.fee.toLowerCase().startsWith('free')`
  },
  {
    slug: 'prize',
    title: 'Open Calls with Prizes',
    desc: 'Open calls offering cash prizes, awards, and grants for photographers and visual artists. Find competitions worth entering.',
    keywords: 'photography prizes, art competition prizes, photography awards money, open call prizes, cash prizes for photographers',
    filterJs: `c.prize && c.prize !== ''`
  }
];

filterPages.forEach(fp => {
  const count = data.calls.filter(c => fp.slug === 'free' ? c.fee && c.fee.toLowerCase().startsWith('free') : c.prize && c.prize !== '').length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${fp.title} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(fp.desc)}">
  <meta name="keywords" content="${escapeHtml(fp.keywords)}, ${YEAR}">
  <link rel="canonical" href="${SITE}/${fp.slug}">
  <link rel="icon" href="/favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.jpg">
  <meta property="og:title" content="${fp.title} ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(fp.desc)}">
  <meta property="og:image" content="${SITE}/og-image.jpg">
  <meta property="og:url" content="${SITE}/${fp.slug}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "${jsonStr(fp.title)} ${YEAR}",
    "description": "${jsonStr(fp.desc)}",
    "url": "${SITE}/${fp.slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${HEADER}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a></nav>', fp.title, escapeHtml(fp.desc))}

    <section class="calls-list" id="callsList"></section>

    ${FOOTER}
  </main>

  <script src="/cards.js"></script>
  <script>
    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => ${fp.filterJs}).map(processCall);
      renderCallList(calls, document.getElementById('callsList'));
    }
    loadFiltered();
  </script>

</body>
</html>`;

  writeGenerated(`${fp.slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${fp.slug}`);
  console.log(`  Filter page: ${fp.slug} (${count} calls)`);
});

// === Country landing pages ===
// Only create pages for countries with 2+ calls
const countryNames = {
  'USA': 'the United States', 'UK': 'the United Kingdom', 'UAE': 'the United Arab Emirates', 'Netherlands': 'the Netherlands'
};
const countrySlugs = {
  'USA': 'united-states', 'UK': 'united-kingdom', 'UAE': 'united-arab-emirates'
};

Object.entries(countryCounts)
  .forEach(([country, count]) => {
    const fullName = countryNames[country] || country;
    const countrySlug = countrySlugs[country] || slugify(country);
    const slug = countrySlug;
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
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}">
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
    "name": "${jsonStr(title)} ${YEAR}",
    "description": "${jsonStr(desc)}",
    "url": "${SITE}/${slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${HEADER}

  <main>
    ${buildHero(buildBreadcrumbs('Locations', '/locations'), escapeHtml(title), escapeHtml(desc))}

    <section class="calls-list" id="callsList"></section>

    ${FOOTER}
  </main>

  <script src="/cards.js"></script>
  <script>
    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
${country === 'USA' ? `
      // State index for USA
      const stateNames = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};
      const counts = {};
      data.calls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
        const parts = c.location.split(',');
        const state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
        if (state) counts[state] = (counts[state] || 0) + 1;
      });
      const sorted = Object.entries(counts).sort((a, b) => {
        const nameA = (stateNames[a[0]] || a[0]).toLowerCase();
        const nameB = (stateNames[b[0]] || b[0]).toLowerCase();
        return nameA.localeCompare(nameB);
      });
      const container = document.getElementById('callsList');
      container.className = 'index-list';
      let html = '';
      sorted.forEach(([state, count]) => {
        const fullName = stateNames[state] || state;
        html += '<a href="/united-states/' + slugify(fullName) + '" class="index-item">' +
          '<span class="index-item-name">' + esc(fullName) + '</span>' +
          '<span class="index-item-dots"></span>' +
          '<span class="index-item-count">' + count + '</span></a>';
      });
      container.innerHTML = html;
` : `
      const calls = data.calls.filter(c => getCountryFromLocation(c.location) === '${country.replace(/'/g, "\\'")}').map(processCall);
      renderCallList(calls, document.getElementById('callsList'));
`}
    }
    loadFiltered();
  </script>

</body>
</html>`;

    slugMap[slug] = `country: ${fullName}`;
    createdCountrySlugs.push(slug);
    writeGenerated(`${slug}/index.html`, html);
    sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Country page: ${slug} (${count} calls)`);
  });

// === US State landing pages ===
const usStateNames = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'Washington DC'};

const stateCounts = {};
data.calls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
  const parts = c.location.split(',');
  const state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
  if (state) stateCounts[state] = (stateCounts[state] || 0) + 1;
});

Object.entries(stateCounts).forEach(([state, count]) => {
  const fullStateName = usStateNames[state] || state;
  const stateSlug = slugify(fullStateName);
  const slug = `united-states/${stateSlug}`;
  const title = `Open Calls for Artists in ${fullStateName}`;
  const desc = `Find open calls, exhibitions, grants, and residencies for photographers and visual artists in ${fullStateName}. Browse and apply today.`;
  const keywords = `open calls ${fullStateName}, call for entries ${fullStateName}, photography opportunities ${fullStateName}, art exhibitions ${fullStateName}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}, ${YEAR}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}">
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
    "name": "${jsonStr(title)} ${YEAR}",
    "description": "${jsonStr(desc)}",
    "url": "${SITE}/${slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${HEADER}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/locations">Locations</a> / <a href="/united-states">United States</a></nav>', escapeHtml(title), escapeHtml(desc))}

    <section class="calls-list" id="callsList"></section>

    ${FOOTER}
  </main>

  <script src="/cards.js"></script>
  <script>
    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.location && c.location.includes(', ${state},') || c.location && c.location.includes(', ${state}, USA')).map(processCall);
      renderCallList(calls, document.getElementById('callsList'));
    }
    loadFiltered();
  </script>

</body>
</html>`;

  slugMap[slug] = `state: ${fullStateName}`;
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  State page: ${slug} (${count} calls)`);
});

// === Org landing pages ===
Object.entries(orgCounts)
  .forEach(([org, count]) => {
    const orgSlug = slugify(org);
    const slug = orgSlug;
    const title = `${org} - Open Calls`;
    const desc = `Open calls and submission opportunities from ${org}. Browse exhibitions, grants, residencies, and more for photographers and visual artists.`;
    const keywords = `${org} open call, ${org} call for entries, ${org} submissions, ${org} photography, ${org} exhibition, ${org} artists`;

    // Check for slug collision with call/country pages
    if (slugMap[slug]) {
      console.warn(`  SKIPPED org page: ${slug} collides with "${slugMap[slug]}"`);
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed">
  <title>${escapeHtml(title)}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.jpg" type="image/jpeg">
  <link rel="apple-touch-icon" href="/apple-touch-icon.jpg">
  <meta property="og:title" content="${escapeHtml(title)}${TITLE_SUFFIX}">
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
    "name": "${jsonStr(org)} - Open Calls",
    "description": "${jsonStr(desc)}",
    "url": "${SITE}/${slug}",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${HEADER}

  <main>
    ${buildHero(buildBreadcrumbs('Organizations', '/organizations'), escapeHtml(org), escapeHtml(desc))}

    <section class="calls-list" id="callsList"></section>

    ${FOOTER}
  </main>

  <script src="/cards.js"></script>
  <script>
    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.org === '${org.replace(/'/g, "\\'")}').map(processCall);
      renderCallList(calls, document.getElementById('callsList'));
    }
    loadFiltered();
  </script>

</body>
</html>`;

    slugMap[slug] = `org: ${org}`;
    createdOrgSlugs.push(slug);
    writeGenerated(`${slug}/index.html`, html);
    sitemapEntries.push(`${SITE}/${slug}`);
    console.log(`  Org page: ${slug} (${count} calls)`);
  });

// Add index pages to sitemap
sitemapEntries.push(`${SITE}/categories`);
sitemapEntries.push(`${SITE}/locations`);
sitemapEntries.push(`${SITE}/organizations`);

// Build state pages map for cards.js
const statePageMap = {};
Object.keys(stateCounts).forEach(state => {
  const fullName = usStateNames[state] || state;
  statePageMap[state] = 'united-states/' + slugify(fullName);
});

// Update page lists in cards.js (between markers) — only include actually created pages
const pageListsBlock = `// ==AUTO-GENERATED-START== (do not edit manually)
const countryPages = ${JSON.stringify(createdCountrySlugs)};
const orgPages = ${JSON.stringify(createdOrgSlugs)};
const statePages = ${JSON.stringify(statePageMap)};
// ==AUTO-GENERATED-END==`;
let cardsJs = fs.readFileSync('cards.js', 'utf8');
cardsJs = cardsJs.replace(
  /\/\/ ==AUTO-GENERATED-START==[\s\S]*?\/\/ ==AUTO-GENERATED-END==/,
  pageListsBlock
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

// Generate index pages for categories, countries, organizations
const indexPages = [
  { src: 'categories/index.html', fallback: 'categories.html' },
  { src: 'locations/index.html', fallback: 'locations.html' },
  { src: 'organizations/index.html', fallback: 'organizations.html' }
];
indexPages.forEach(({ src, fallback }) => {
  // Read from new location if exists, else from old location
  const readFrom = fs.existsSync(src) ? src : (fs.existsSync(fallback) ? fallback : null);
  if (readFrom) {
    let html = fs.readFileSync(readFrom, 'utf8');
    // Sync CSS version
    html = html.replace(/href="[^"]*style\.css\?v=[^"]+"/g, `href="/style.css?v=${cssVersion}"`);
    html = html.replace(/Open Calls for Artists \d{4}/g, `Open Calls for Artists ${YEAR}`);
    html = html.replace(/photography grants \d{4}/g, `photography grants ${YEAR}`);
    html = html.replace(/&copy; \d{4} HH/g, `&copy; ${YEAR} HH`);
    html = html.replace(/(<title>[^<]+?)(\s*-\s*Monographica)?<\/title>/g, (m, content) => {
      const clean = content.replace(/\s*-\s*Monographica$/, '');
      return `${clean}${TITLE_SUFFIX}</title>`;
    });
    html = html.replace(/(og:title"\s+content="[^"]+?)(\s*-\s*Monographica)?"/g, (m, content) => {
      const clean = content.replace(/\s*-\s*Monographica$/, '');
      return `${clean}${TITLE_SUFFIX}"`;
    });
    html = html.replace(/<footer class="about-section"[\s\S]*?<\/footer>/, FOOTER);
    html = html.replace(/<header>[\s\S]*?<\/header>/, HEADER);
    const dir = path.dirname(src);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(src, html);
    generatedFiles.add(src);
  }
});

// Update manual HTML files: CSS version, year, and title suffix
const manualFiles = ['index.html', '404.html'];
manualFiles.forEach(file => {
  let html = fs.readFileSync(file, 'utf8');
  // Sync CSS version
  html = html.replace(/href="[^"]*style\.css\?v=[^"]+"/g, `href="/style.css?v=${cssVersion}"`);
  // Update year everywhere (titles, keywords, footer)
  html = html.replace(/Open Calls for Artists \d{4}/g, `Open Calls for Artists ${YEAR}`);
  html = html.replace(/photography grants \d{4}/g, `photography grants ${YEAR}`);
  html = html.replace(/&copy; \d{4} HH/g, `&copy; ${YEAR} HH`);
  // Ensure title suffix — remove any existing then re-add
  html = html.replace(/(<title>[^<]+?)(\s*-\s*Monographica)?<\/title>/g, (m, content) => {
    const clean = content.replace(/\s*-\s*Monographica$/, '');
    return `${clean}${TITLE_SUFFIX}</title>`;
  });
  html = html.replace(/(og:title"\s+content="[^"]+?)(\s*-\s*Monographica)?"/g, (m, content) => {
    const clean = content.replace(/\s*-\s*Monographica$/, '');
    return `${clean}${TITLE_SUFFIX}"`;
  });
  // Update header (skip index.html which has its own nav with data-view attributes)
  if (file !== 'index.html') {
    html = html.replace(/<header>[\s\S]*?<\/header>/, HEADER);
  }
  // Update footer
  html = html.replace(/<footer class="about-section"[\s\S]*?<\/footer>/, FOOTER);
  // Update open count in index.html hero
  if (file === 'index.html') {
    const now = new Date();
    const openCount = data.calls.filter(c => c.deadline === 'Continuous' || new Date(c.deadline) >= now).length;
    const roundedCount = Math.floor(openCount / 10) * 10;
    html = html.replace(/over \d+ open calls/, `over ${roundedCount} open calls`);
  }
  fs.writeFileSync(file, html);
});

// Final cleanup: recursively remove stale HTML files and empty directories
let cleaned = 0;
function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(item => {
    if (item.startsWith('.')) return; // skip hidden dirs (.git, .claude, etc.)
    const fp = path.join(dir, item);
    if (fs.statSync(fp).isDirectory()) {
      cleanDir(fp);
      // Remove empty directories
      if (fs.readdirSync(fp).length === 0) fs.rmdirSync(fp);
    } else if (fp.endsWith('.html') && !generatedFiles.has(fp) && !MANUAL_FILES.includes(fp)) {
      fs.unlinkSync(fp);
      cleaned++;
    }
  });
}
cleanDir('.');
if (cleaned) console.log(`Cleaned up ${cleaned} stale/duplicate files`);

console.log(`Generated ${generated} pages, skipped ${skipped}, sitemap has ${allUrls.length} URLs`);
