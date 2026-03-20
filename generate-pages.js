const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const SITE = 'https://opencalls.monographica.com';
const YEAR = new Date().getFullYear();
const TITLE_SUFFIX = ' - Monographica';
const RESERVED = ['index', 'style', 'data', 'favicon', 'apple-touch-icon', 'og-image', 'bg', 'call-detail', 'cards', 'generate-pages', 'sitemap', 'CNAME', 'robots', '404', 'photography', 'exhibitions', 'grants', 'residencies', 'zines', 'education', 'categories', 'locations', 'organizations', 'free', 'prize', 'united-states', 'eligibility', 'browse'];
const MANUAL_FILES = ['index.html', '404.html'];

// GA — single external file
const GA_SNIPPET = `<script src="/analytics.js"></script>`;
const PRELOAD = `<link rel="preload" href="/data.json" as="fetch" crossorigin>
  <link rel="alternate" type="application/rss+xml" title="Open Calls for Artists — Monographica" href="/feed.xml">`;

// Shared header and footer
function buildHeader(active) {
  return `<header>
    <div class="header-inner">
      <a href="https://monographica.com" class="logo">Monographica</a>
      <nav>
        <a href="/" class="nav-link${active === 'open' ? ' active' : ''}">Open</a>
        <a href="/?view=past" class="nav-link${active === 'closed' ? ' active' : ''}">Closed</a>
        <a href="/browse" class="nav-link nav-desktop${active === 'browse' ? ' active' : ''}">Browse</a>
      </nav>
    </div>
  </header>`;
}
const HEADER = buildHeader();

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

// Compute orgs for landing pages
const orgCounts = {};
data.calls.forEach(call => { orgCounts[call.org] = (orgCounts[call.org] || 0) + 1; });

function buildJsonLd(call) {
  const pageUrl = `${SITE}/${slugify(call.title)}`;
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": call.title,
    "description": call.description,
    "url": pageUrl,
    "publisher": {
      "@type": "Organization",
      "name": "Monographica",
      "url": "https://monographica.com"
    }
  };
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
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${escapeHtml(call.title)}${TITLE_SUFFIX}</title>
  <meta name="description" content="${desc}">
  <meta name="keywords" content="${escapeHtml(buildKeywords(call))}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${escapeHtml(call.title)}${TITLE_SUFFIX}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Monographica">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  ${buildJsonLd(call)}
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

      <p class="call-detail-description">${escapeHtml(call.description)}</p>

      <div class="call-detail-info" id="detailInfo"></div>
${call.jury && call.jury.length ? `
      <div class="call-detail-jury">
        <p class="call-detail-description">Jury: ${call.jury.map(j => escapeHtml(j)).join(' · ')}</p>
      </div>
` : ''}
      <div class="call-detail-actions">
        <a href="${escapeHtml(call.url)}" target="_blank" rel="nofollow noopener" class="call-detail-btn call-detail-apply">Go to submission &rarr;</a>
${call.deadline !== 'Continuous' ? `        <a href="#" class="call-detail-btn call-detail-calendar" onclick="downloadICS(event)">Add to calendar</a>` : ''}
      </div>
    </section>

    <section class="related-calls">
      <div id="similarCalls"></div>
    </section>

    ${FOOTER}
  </main>

  <script>
    const CURRENT_SLUG = '${slug}';
    const CURRENT_CALL = ${JSON.stringify({ prize: call.prize || '', category: call.category, org: call.org, location: call.location || '', fee: call.fee || '', deadline: call.deadline, instagram: call.instagram || '', eligibility: call.eligibility || [], jury: call.jury || [], submitVia: call.submitVia || '', images: call.images || '', ai: call.ai || '' })};
    function downloadICS(e) {
      e.preventDefault();
      var d = '${call.deadline}'.replace(/-/g, '');
      var t = '${escapeHtml(call.title)}';
      var u = '${escapeHtml(call.url)}';
      var o = '${call.org.replace(/'/g, "\\'")}';
      var dl = new Date('${call.deadline}T00:00:00').toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
      var desc = 'Open call by ' + o + '\\\\n\\\\nDeadline: ' + dl${call.prize ? ` + '\\\\nPrize: ${call.prize.replace(/'/g, "\\'")}'` : ''}${call.fee ? ` + '\\\\nEntry fee: ${call.fee.replace(/'/g, "\\'")}'` : ''};
      var ics = 'BEGIN:VCALENDAR\\r\\nVERSION:2.0\\r\\nBEGIN:VEVENT\\r\\nDTSTART;VALUE=DATE:' + d + '\\r\\nDTEND;VALUE=DATE:' + d + '\\r\\nSUMMARY:' + t + ' - Deadline\\r\\nDESCRIPTION:' + desc + '\\r\\nURL:' + u + '\\r\\nBEGIN:VALARM\\r\\nTRIGGER:-P1D\\r\\nACTION:DISPLAY\\r\\nDESCRIPTION:Deadline tomorrow: ' + t + '\\r\\nEND:VALARM\\r\\nEND:VEVENT\\r\\nEND:VCALENDAR';
      var blob = new Blob([ics.replace(/\\r\\n/g, '\\r\\n')], {type: 'text/calendar'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = CURRENT_SLUG + '.ics';
      a.click();
    }
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
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${info.title} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(info.desc)}">
  <meta name="keywords" content="${escapeHtml(info.keywords + ', ' + YEAR)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${info.title} ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(info.desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
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

  ${buildHeader('browse')}

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
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${fp.title} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(fp.desc)}">
  <meta name="keywords" content="${escapeHtml(fp.keywords)}, ${YEAR}">
  <link rel="canonical" href="${SITE}/${fp.slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${fp.title} ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(fp.desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${fp.slug}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
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

  ${buildHeader('browse')}

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

// === Eligibility pages ===
const eligibilityGroups = {
  'women': { short: 'Women', title: 'Open Calls for Women Photographers', desc: 'Open calls, grants, and awards exclusively for women, nonbinary, and gender-diverse photographers and visual artists.' },
  'united-states': { short: 'United States', title: 'US-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in the United States.' },
  'europe': { short: 'Europe', title: 'Europe-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in Europe.' },
  'italy': { short: 'Italy', title: 'Italy-Only Open Calls', desc: 'Open calls restricted to photographers and artists based in Italy.' },
  'emerging': { short: 'Emerging Artists', title: 'Open Calls for Emerging Artists', desc: 'Open calls, grants, and awards specifically for emerging, early-career, and student photographers and visual artists.' },
  'under-30': { short: 'Under 30', title: 'Open Calls for Under 30', desc: 'Open calls with age restrictions for photographers and artists under 30.' },
  'under-40': { short: 'Under 40', title: 'Open Calls for Under 40', desc: 'Open calls with age restrictions for photographers and artists under 40.' },
  'lgbtq': { short: 'LGBTQ+', title: 'LGBTQ+ Open Calls', desc: 'Open calls, exhibitions, and awards for LGBTQ+ photographers and visual artists.' },
  'analog-photography': { short: 'Analog & Film', title: 'Analog & Film Photography Open Calls', desc: 'Open calls exclusively for analog, film, and non-digital photography.' },
  'alternative-process': { short: 'Alternative Process', title: 'Alternative Process Open Calls', desc: 'Open calls for alternative and historic photographic processes — cyanotype, anthotype, wet plate, and more.' },
  'professional': { short: 'Professional', title: 'Professional Photographers Only', desc: 'Open calls restricted to professional photographers.' },
  'membership-required': { short: 'Membership Required', title: 'Membership Required', desc: 'Open calls that require membership or subscription to the organizing body.' },
  'puerto-rico': { short: 'Puerto Rico', title: 'Puerto Rico Focus', desc: 'Open calls for projects related to Puerto Rico and its diaspora.' },
  'asian-american': { short: 'Asian American', title: 'Asian American Focus', desc: 'Open calls for projects exploring Asian American identity and experience.' },
  'south-asian': { short: 'South Asian', title: 'South Asian Focus', desc: 'Open calls for projects related to South Asian art and culture.' },
  'african-diaspora': { short: 'African Diaspora', title: 'African Diaspora Focus', desc: 'Open calls for projects by or about African and diaspora artists.' }
};

// Collect which eligibility tags actually exist in data
const eligibilityTags = {};
data.calls.forEach(c => {
  (c.eligibility || []).forEach(tag => {
    eligibilityTags[tag] = (eligibilityTags[tag] || 0) + 1;
  });
});

const eligibilityPageSlugs = [];
Object.entries(eligibilityTags).forEach(([tag, count]) => {
  const info = eligibilityGroups[tag];
  if (!info) return;
  const slug = `eligibility/${tag}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${escapeHtml(info.title)} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(info.desc)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${escapeHtml(info.title)} ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(info.desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
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

  ${buildHeader('browse')}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a> / <a href="/eligibility">Eligibility</a></nav>', escapeHtml(info.title), escapeHtml(info.desc))}

    <section class="calls-list" id="callsList"></section>

    ${FOOTER}
  </main>

  <script src="/cards.js"></script>
  <script>
    async function loadFiltered() {
      const res = await fetch('/data.json');
      const data = await res.json();
      const calls = data.calls.filter(c => c.eligibility && c.eligibility.includes('${tag}')).map(processCall);
      renderCallList(calls, document.getElementById('callsList'));
    }
    loadFiltered();
  </script>

</body>
</html>`;

  eligibilityPageSlugs.push(tag);
  writeGenerated(`${slug}/index.html`, html);
  sitemapEntries.push(`${SITE}/${slug}`);
  console.log(`  Eligibility page: ${tag} (${count} calls)`);
});

// Eligibility index page
const eligibilityOrder = [
  { heading: 'Who Can Apply', tags: ['women', 'lgbtq', 'emerging', 'professional', 'under-30', 'under-40'] },
  { heading: 'Where', tags: ['united-states', 'europe', 'italy'] },
  { heading: 'Medium', tags: ['analog-photography', 'alternative-process'] },
  { heading: 'Focus', tags: ['african-diaspora', 'asian-american', 'puerto-rico', 'south-asian'] },
  { heading: 'Other', tags: ['membership-required'] }
];

function buildEligibilityIndexItems() {
  let html = '';
  eligibilityOrder.forEach(group => {
    const activeTags = group.tags.filter(t => eligibilityTags[t]);
    if (!activeTags.length) return;
    html += `<h3 class="section-header">${escapeHtml(group.heading)}</h3>\n`;
    activeTags.forEach(tag => {
      const info = eligibilityGroups[tag];
      const count = eligibilityTags[tag];
      html += `      <a href="/eligibility/${tag}" class="index-item">
          <span class="index-item-name">${escapeHtml(info.short)}</span>
          <span class="dots"></span>
          <span class="index-item-count">${count}</span>
        </a>\n`;
    });
  });
  return html;
}

if (eligibilityPageSlugs.length) {
  const eligIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>Open Calls by Eligibility ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="Browse open calls by eligibility. Find calls for women, emerging artists, LGBTQ+ photographers, regional restrictions, analog photography, and more.">
  <link rel="canonical" href="${SITE}/eligibility">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="Open Calls by Eligibility ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="Browse open calls by eligibility. Find calls for women, emerging artists, LGBTQ+ photographers, regional restrictions, analog photography, and more.">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/eligibility">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${buildHeader('browse')}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a></nav>', 'Eligibility', 'Browse open calls by eligibility. Find calls for women, emerging artists, LGBTQ+ photographers, regional restrictions, analog photography, and more.')}

    <section class="index-list" id="indexList">
      ${buildEligibilityIndexItems()}
    </section>

    <p class="browse-more"><a href="/browse">Browse by category, location, organization &rarr;</a></p>

    ${FOOTER}
  </main>

</body>
</html>`;

  writeGenerated('eligibility/index.html', eligIndexHtml);
  sitemapEntries.push(`${SITE}/eligibility`);
  console.log(`  Eligibility index page (${eligibilityPageSlugs.length} groups)`);
}

// === Country landing pages ===
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
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
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

  ${buildHeader('browse')}

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
      const nameToAbbr = {};
      Object.entries(stateNames).forEach(([abbr, name]) => { nameToAbbr[name] = abbr; });
      const counts = {};
      data.calls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
        const parts = c.location.split(',');
        let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
        if (state && nameToAbbr[state]) state = nameToAbbr[state];
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
          '<span class="dots"></span>' +
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

// Build reverse lookup: full state name → abbreviation
const stateNameToAbbr = {};
Object.entries(usStateNames).forEach(([abbr, name]) => { stateNameToAbbr[name] = abbr; });

const stateCounts = {};
data.calls.filter(c => c.location && c.location.endsWith('USA')).forEach(c => {
  const parts = c.location.split(',');
  let state = parts.length >= 3 ? parts[parts.length - 2].trim() : '';
  // Normalize full state names to abbreviations to prevent duplicate pages
  if (state && stateNameToAbbr[state]) state = stateNameToAbbr[state];
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
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}, ${YEAR}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${escapeHtml(title)} ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
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

  ${buildHeader('browse')}

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
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>${escapeHtml(title)}${TITLE_SUFFIX}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <link rel="canonical" href="${SITE}/${slug}">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="${escapeHtml(title)}${TITLE_SUFFIX}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/${slug}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
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

  ${buildHeader('browse')}

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

// === Browse directory page (auto-generated hub linking all sections) ===
function midTruncateHtml(str, minLen) {
  minLen = minLen || 25;
  if (!str || str.length <= minLen) return escapeHtml(str);
  const words = str.split(' ');
  if (words.length <= 2) return escapeHtml(str);
  const splitAt = Math.ceil(words.length * 0.6);
  const front = words.slice(0, splitAt).join(' ');
  const back = words.slice(splitAt).join(' ');
  return `<span class="tag-front">${escapeHtml(front)}</span><span class="tag-back">${escapeHtml(back)}</span>`;
}

function buildBrowseSection(heading, items, headingLink) {
  if (!items.length) return '';
  const headingHtml = headingLink ? `<a href="${headingLink}">${escapeHtml(heading)}</a>` : escapeHtml(heading);
  let html = `<h3 class="section-header">${headingHtml}</h3>\n`;
  items.forEach(({ label, href, count }) => {
    html += `      <a href="${href}" class="index-item">
        <span class="index-item-name">${midTruncateHtml(label)}</span>
        <span class="dots"></span>
        <span class="index-item-count">${count}</span>
      </a>\n`;
  });
  return html;
}

const browseCategoryLabels = {
  'photography': 'Photography', 'exhibition': 'Exhibitions', 'grant': 'Grants',
  'residency': 'Residencies', 'zine': 'Zines & Books', 'education': 'Education'
};
const browseCategories = Object.entries(categories).map(([cat]) => {
  const catSlug = cat === 'zine' ? 'zines' : cat === 'exhibition' ? 'exhibitions' : cat === 'residency' ? 'residencies' : cat === 'grant' ? 'grants' : cat;
  return { label: browseCategoryLabels[cat] || cat, href: `/${catSlug}`, count: data.calls.filter(c => c.category === cat).length };
}).sort((a, b) => b.count - a.count);

const browseFilters = [
  { label: 'Free to Enter', href: '/free', count: data.calls.filter(c => c.fee && c.fee.toLowerCase().startsWith('free')).length },
  { label: 'Has Prize', href: '/prize', count: data.calls.filter(c => c.prize && c.prize !== '').length }
];

const browseCountries = Object.entries(countryCounts)
  .map(([country, count]) => {
    const countrySlug = countrySlugs[country] || slugify(country);
    const label = countryNames[country] ? countryNames[country].replace(/^the /, '') : country;
    return { label, href: `/${countrySlug}`, count };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

const browseStates = Object.entries(stateCounts)
  .sort((a, b) => {
    const nameA = (usStateNames[a[0]] || a[0]).toLowerCase();
    const nameB = (usStateNames[b[0]] || b[0]).toLowerCase();
    return nameA.localeCompare(nameB);
  })
  .map(([state, count]) => {
    const fullName = usStateNames[state] || state;
    return { label: fullName, href: `/united-states/${slugify(fullName)}`, count };
  });

const browseEligibility = [];
eligibilityOrder.forEach(group => {
  group.tags.filter(t => eligibilityTags[t]).forEach(tag => {
    const info = eligibilityGroups[tag];
    browseEligibility.push({ label: info.short, href: `/eligibility/${tag}`, count: eligibilityTags[tag] });
  });
});

const browseOrgs = Object.entries(orgCounts)
  .filter(([org]) => createdOrgSlugs.includes(slugify(org)))
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([org, count]) => ({ label: org, href: `/${slugify(org)}`, count }));

const browseHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  ${GA_SNIPPET}
  ${PRELOAD}
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#1a1a1a" media="(prefers-color-scheme: dark)">
  <title>Browse All Open Calls ${YEAR}${TITLE_SUFFIX}</title>
  <meta name="description" content="Browse open calls for photographers and visual artists by category, location, eligibility, and organization. Find exhibitions, grants, residencies, and competitions worldwide.">
  <meta name="keywords" content="open calls for artists, photography open calls, call for entries, art exhibitions, photography grants, artist residency, browse open calls ${YEAR}">
  <link rel="canonical" href="${SITE}/browse">
  <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
  <link rel="icon" href="/favicon.png" type="image/png" sizes="48x48">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta property="og:title" content="Browse All Open Calls ${YEAR}${TITLE_SUFFIX}">
  <meta property="og:description" content="Browse open calls for photographers and visual artists by category, location, eligibility, and organization.">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta property="og:url" content="${SITE}/browse">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Monographica">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="robots" content="index, follow">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Browse All Open Calls ${YEAR}",
    "description": "Browse open calls for photographers and visual artists by category, location, eligibility, and organization.",
    "url": "${SITE}/browse",
    "publisher": { "@type": "Organization", "name": "Monographica", "url": "https://monographica.com" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/style.css?v=${cssVersion}">
</head>
<body>

  ${buildHeader('browse')}

  <main>
    ${buildHero('<nav class="breadcrumbs"><a href="/">All open calls</a></nav>', 'Browse', 'Explore all open calls by category, location, eligibility, and organization.')}

    <section class="index-list">
${buildBrowseSection('Categories', browseCategories, '/categories')}
${buildBrowseSection('Fee & Prizes', browseFilters)}
${buildBrowseSection('Locations', browseCountries, '/locations')}
${buildBrowseSection('US States', browseStates, '/united-states')}
${buildBrowseSection('Eligibility', browseEligibility, '/eligibility')}
${buildBrowseSection('Organizations', browseOrgs, '/organizations')}
    </section>

    ${FOOTER}
  </main>

</body>
</html>`;

writeGenerated('browse/index.html', browseHtml);
sitemapEntries.push(`${SITE}/browse`);
console.log(`  Browse directory page`);

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

// Generate RSS feed
const now = new Date();
const openCalls = data.calls
  .filter(c => c.deadline === 'Continuous' || new Date(c.deadline) >= now)
  .sort((a, b) => {
    if (a.deadline === 'Continuous') return 1;
    if (b.deadline === 'Continuous') return -1;
    return new Date(a.deadline) - new Date(b.deadline);
  })
  .slice(0, 50);

const rssItems = openCalls.map(call => {
  const slug = slugify(call.title);
  const deadlineText = call.deadline === 'Continuous' ? 'Continuous' :
    new Date(call.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const desc = `${escapeHtml(call.description)} — Deadline: ${deadlineText}. Fee: ${escapeHtml(call.fee || 'See website')}. Prize: ${escapeHtml(call.prize || 'None listed')}.`;
  return `  <item>
    <title>${escapeHtml(call.title)}</title>
    <link>${SITE}/${slug}</link>
    <guid>${SITE}/${slug}</guid>
    <description>${desc}</description>
    <category>${escapeHtml(call.category)}</category>
    <pubDate>${new Date().toUTCString()}</pubDate>
  </item>`;
}).join('\n');

const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Open Calls for Artists — Monographica</title>
  <link>${SITE}</link>
  <description>Curated list of open calls for photographers and visual artists. Exhibitions, grants, residencies, and publications worldwide.</description>
  <language>en</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${rssItems}
</channel>
</rss>`;

fs.writeFileSync('feed.xml', rssXml);

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
    // favicon.ico + favicon.png links are already correct in templates
    if (!html.includes('og:site_name')) {
      html = html.replace(/<meta name="twitter:card"/, '<meta property="og:site_name" content="Monographica">\n  <meta name="twitter:card"');
    }
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
    html = html.replace(/<header>[\s\S]*?<\/header>/, buildHeader('browse'));
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
  // Update open count in index.html hero (uses total calls to avoid timezone issues)
  if (file === 'index.html') {
    const roundedCount = Math.floor(data.calls.length / 10) * 10;
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
