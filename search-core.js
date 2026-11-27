// search-core.js — the site search: which calls a query finds, in what order, and the words shown under each result.
// One file for the /search/ page (browser) and the build's Search gate (node), so what the gate proves is what readers get.
// It reads only the rows of search-index.js, which the build writes from data.json: nothing here is kept by hand per call.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SearchCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Words that say nothing on a site of open calls: dropped from a query unless the query is nothing else.
  var STOP = {};
  ('a an and the of for in on at to by with or from into is are be my me i we you your our it this that these those ' +
    'call calls open opportunity opportunities').split(' ').forEach(function (w) { STOP[w] = 1; });

  // The same thing written another way: a query word or phrase finds all of its group.
  var SAME = [
    ['uk', 'united kingdom', 'great britain', 'britain'],
    ['usa', 'us', 'united states', 'america'],
    ['nyc', 'new york city', 'new york'],
    ['b&w', 'bw', 'black and white', 'black & white', 'monochrome'],
    ['photobook', 'photo book', 'photobooks', 'photo books'],
    ['analog', 'analogue'],
    ['ai', 'artificial intelligence', 'a i'],
    ['color', 'colour'], ['gray', 'grey'], ['catalog', 'catalogue'], ['center', 'centre'], ['program', 'programme']
  ];

  // Letters without accents, lower case; every other character a space. One input character can become 0, 1 or 2
  // output characters (ß → ss), and map[] remembers, for each output character, the input character it came from.
  var FOLD_EXTRA = { 'ø': 'o', 'ł': 'l', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };
  function foldChar(ch) {
    var lo = ch.toLowerCase();
    if (FOLD_EXTRA[lo]) return FOLD_EXTRA[lo];
    var base = lo.normalize ? lo.normalize('NFD').replace(/[̀-ͯ]/g, '') : lo;
    return /^[a-z0-9]+$/.test(base) ? base : (ch === '&' ? '&' : ' ');
  }
  function foldWithMap(s) {
    var out = '', map = [];
    for (var i = 0; i < s.length; i++) {
      var f = foldChar(s[i]);
      for (var k = 0; k < f.length; k++) { out += f[k]; map.push(i); }
    }
    return { text: out, map: map };
  }
  // The searchable form of a text: its words, one space apart, with a space at each end, "&" its own word.
  function norm(s) {
    return ' ' + foldWithMap(String(s || '')).text.replace(/&/g, ' & ').split(/\s+/).filter(Boolean).join(' ') + ' ';
  }
  function words(s) { return norm(s).trim().split(' ').filter(Boolean); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  // Plural and singular find each other: residency / residencies, portrait / portraits, gallery / galleries.
  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3);
    if (w.length > 4 && /y$/.test(w)) return w.slice(0, -1);
    if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) return w.slice(0, -2);
    if (w.length > 3 && /[^su]s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  // The endings a stem may take: plural, singular, -er/-ers, -ed/-ing (no ending matches the stem alone).
  var ENDINGS = '|s|es|y|ies|er|ers|ed|ing';

  // A SAME phrase over folded text: its words with anything that is not a letter between them ("B&W", "black & white").
  function phrasePattern(alt) {
    return alt.split(' ').map(escRe).join('[^a-z0-9]*');
  }

  // A query → groups. A group is one thing the reader asked for: a word (with its plural or singular), or a SAME phrase.
  // Each group carries two patterns over norm() text: `any` (where it is found) and `exact` (the word as typed).
  // The last word may be unfinished (results show while typing), so it also matches as the start of a longer word.
  var SAME_W = SAME.map(function (set) { return set.map(words); });
  function parse(query) {
    var ws = words(query);
    var kept = ws.filter(function (w) { return !STOP[w]; });
    if (!kept.length) kept = ws;
    var groups = [], i = 0;
    while (i < kept.length) {
      var hit = null;
      for (var s = 0; s < SAME_W.length && !hit; s++) {
        for (var m = 0; m < SAME_W[s].length; m++) {
          var p = SAME_W[s][m];
          if (p.length && p.every(function (w, j) { return kept[i + j] === w; })) { hit = { set: SAME_W[s], len: p.length }; break; }
        }
      }
      if (hit) {
        var alts = hit.set.map(function (p) { return p.join(' '); });
        var re = alts.map(function (a) { return escRe(a); }).join('|');
        groups.push({ label: kept.slice(i, i + hit.len).join(' '), same: true, any: new RegExp(' (?:' + re + ') '),
          exact: new RegExp(' (?:' + re + ') '), mark: alts.map(phrasePattern).join('|'), whole: true });
        i += hit.len;
        continue;
      }
      // A word: as typed, or its stem with an English ending (residenc → residency, residencies; portrait → portraits);
      // one or two letters only as a whole word ("ai" is not "paid"); the last word also as the start of any longer word.
      var w = kept[i], last = i === kept.length - 1, st = stem(w);
      var body = w.length <= 2 ? escRe(w)
        : last ? '(?:' + escRe(w) + '|' + escRe(st) + ')[a-z0-9]*'
        : escRe(st) + '(?:' + ENDINGS + ')';
      groups.push({ label: w, any: new RegExp(' ' + body + ' '), exact: new RegExp(' ' + escRe(w) + ' '), mark: body, whole: true });
      i++;
    }
    return groups;
  }

  // The fields a call is found by, and how much a match in each counts. Title and organiser count most; the long texts
  // (description, the call page's prose) least, so a call about the thing ranks above one that mentions it once.
  var FIELDS = [
    ['title', 12], ['org', 8], ['jury', 6], ['place', 5], ['summary', 4], ['category', 3], ['prize', 3], ['eligibility', 3],
    ['fee', 2], ['requirements', 2], ['description', 1], ['prose', 1]
  ];

  function create(rows, maps) {
    maps = maps || {};
    var docs = rows.map(function (c) {
      var place = c.location || '';
      if (c.location) c.location.split(',').forEach(function (lp) {
        lp = lp.trim();
        if (maps.usStateNames && maps.usStateNames[lp]) place += ' ' + maps.usStateNames[lp];
        if (maps.countryLongNames && maps.countryLongNames[lp]) place += ' ' + maps.countryLongNames[lp];
      });
      var f = {
        title: c.title, org: c.org, jury: (c.jury || []).join(' · '), place: place, summary: c.summary,
        category: maps.categoryLabel && maps.categoryLabel[c.category] || c.category,
        prize: c.prize, fee: [c.fee, c.additionalFees].filter(Boolean).join(' '),
        eligibility: (c.eligibility || []).map(function (e) { return maps.eligibilityLabel && maps.eligibilityLabel[e] || e; }).join(' · '),
        requirements: c.requirements, description: c.description, prose: (c.prose || []).join(' ')
      };
      var n = {}, all = '';
      FIELDS.forEach(function (fw) { n[fw[0]] = norm(f[fw[0]]); all += n[fw[0]]; });
      return { row: c, n: n, all: all };
    });

    var vocab = null;
    function vocabulary() {
      if (vocab) return vocab;
      var count = {};
      docs.forEach(function (d) {
        var seen = {};
        d.all.split(' ').forEach(function (w) { if (w.length > 2 && !seen[w]) { seen[w] = 1; count[w] = (count[w] || 0) + 1; } });
      });
      vocab = count;
      return vocab;
    }

    // Edit distance, stopping early once it passes max.
    function distance(a, b, max) {
      if (Math.abs(a.length - b.length) > max) return max + 1;
      var prev = [], cur = [], i, j;
      for (j = 0; j <= b.length; j++) prev[j] = j;
      for (i = 1; i <= a.length; i++) {
        cur = [i]; var lo = i;
        for (j = 1; j <= b.length; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          lo = Math.min(lo, cur[j]);
        }
        if (lo > max) return max + 1;
        prev = cur;
      }
      return prev[b.length];
    }
    // The word most calls use within one or two letters of a word that found nothing ("residancy" → "residency").
    function correct(w) {
      if (w.length < 4) return null;
      var max = w.length >= 8 ? 2 : 1, v = vocabulary(), best = null, bestN = 0;
      for (var k in v) {
        if (v[k] <= bestN) continue;
        if (distance(w, k, max) <= max) { best = k; bestN = v[k]; }
      }
      return best;
    }

    // Finds the calls for a query. Every group must be found (all the words); when no call has them all, the calls with
    // the most of them. Within that, the score orders: each group counts the weight of the best field it is found in,
    // doubled when the word is there as typed; the whole query as a phrase adds more.
    function search(query) {
      var groups = parse(query);
      if (!groups.length) return { groups: groups, results: [], partial: false, suggestion: null };
      var phrase = groups.length > 1 ? new RegExp(' ' + groups.map(function (g) { return escRe(g.label); }).join(' ') + '[a-z0-9]* ') : null;
      var found = [], most = 0;
      docs.forEach(function (d) {
        var hits = 0;
        for (var g = 0; g < groups.length; g++) if (groups[g].any.test(d.all)) hits++;
        if (!hits) return;
        found.push({ d: d, hits: hits });
        if (hits > most) most = hits;
      });
      var suggestion = null;
      var missing = groups.filter(function (g) { return !g.same && !docs.some(function (d) { return g.any.test(d.all); }); });
      if (missing.length) {
        var fixed = groups.map(function (g) { return missing.indexOf(g) !== -1 ? (correct(g.label) || g.label) : g.label; }).join(' ');
        if (fixed !== groups.map(function (g) { return g.label; }).join(' ')) suggestion = fixed;
      }
      var results = found.filter(function (x) { return x.hits === most; }).map(function (x) {
        var score = 0, d = x.d;
        groups.forEach(function (g) {
          var best = 0;
          FIELDS.forEach(function (fw) {
            var t = d.n[fw[0]];
            if (!g.any.test(t)) return;
            var v = fw[1] * (g.exact.test(t) ? 2 : 1);
            if (v > best) best = v;
          });
          score += best;
        });
        if (phrase) { if (phrase.test(d.n.title)) score += 30; else if (phrase.test(d.all)) score += 8; }
        return { row: d.row, score: score, doc: d };
      });
      return { groups: groups, results: results, partial: most < groups.length, suggestion: suggestion };
    }

    return { search: search, docs: docs, correct: correct };
  }

  // --- What a result shows ---

  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Where each group is found in a text: [start, end) of the whole words, in the text's own characters.
  function spans(text, groups) {
    var fm = foldWithMap(text), t = fm.text, out = [];
    groups.forEach(function (g) {
      var re = new RegExp('(^|[^a-z0-9])(' + g.mark + ')(?![a-z0-9])', 'g'), m;
      while ((m = re.exec(t))) {
        var s = m.index + m[1].length, e = m.index + m[0].length;
        if (e > s) out.push([fm.map[s], fm.map[e - 1] + 1]);
        re.lastIndex = Math.max(e, m.index + 1);
      }
    });
    out.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    var merged = [];
    out.forEach(function (sp) { var l = merged[merged.length - 1]; if (l && sp[0] <= l[1]) l[1] = Math.max(l[1], sp[1]); else merged.push(sp.slice()); });
    return merged;
  }

  // A text with the found words marked. The marks are the page's strong text, not a colour (the site has no coloured text).
  function highlight(text, groups) {
    text = String(text || '');
    var sp = spans(text, groups), html = '', at = 0;
    sp.forEach(function (s) { html += escHtml(text.slice(at, s[0])) + '<b class="search-hit">' + escHtml(text.slice(s[0], s[1])) + '</b>'; at = s[1]; });
    return html + escHtml(text.slice(at));
  }

  // Sentences of a text (a full stop, ! or ? and a space before a capital, digit or quote).
  function sentences(text) { return String(text || '').split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/).filter(Boolean); }

  // A sentence cut to about max characters around its first found word, at word ends, "…" where it was cut.
  function window_(text, groups, max) {
    if (text.length <= max) return text;
    var sp = spans(text, groups), first = sp.length ? sp[0][0] : 0;
    var start = Math.max(0, first - Math.round(max * 0.35));
    if (start > 0) { var b = text.indexOf(' ', start); start = b === -1 || b > first ? start : b + 1; }
    var end = Math.min(text.length, start + max);
    if (end < text.length) { var e = text.lastIndexOf(' ', end); if (e > first) end = e; }
    return (start > 0 ? '…' : '') + text.slice(start, end).replace(/[\s,;:–—-]+$/, '') + (end < text.length ? '…' : '');
  }

  // The words under a result: the call's own summary when it holds the found words (or nothing was found outside the
  // title and organiser); otherwise the sentences of the call's texts where they are, best first, up to two.
  var SNIP_FIELDS = [['summary'], ['description'], ['prose'], ['requirements'], ['prize', 'Prize: '], ['fee', 'Fee: '],
    ['jury', 'Jury: '], ['eligibility', 'Who can apply: '], ['place', '']];
  function snippet(result, groups, maxLen) {
    maxLen = maxLen || 240;
    var c = result.row, d = result.doc;
    var inText = groups.filter(function (g) { return SNIP_FIELDS.some(function (f) { return g.any.test(d.n[f[0]]); }); });
    var summary = c.summary || c.description || '';
    if (!inText.length) return escHtml(summary);
    var cands = [];
    SNIP_FIELDS.forEach(function (f, fi) {
      var raw = f[0] === 'jury' ? (c.jury || []).join(', ') : f[0] === 'prose' ? (c.prose || []).join(' ')
        : f[0] === 'place' ? c.location : f[0] === 'eligibility' ? null : f[0] === 'fee' ? [c.fee, c.additionalFees].filter(Boolean).join('; ') : c[f[0]];
      if (!raw) return;
      var list = f[0] === 'summary' || f[0] === 'jury' || f[0] === 'prize' || f[0] === 'fee' || f[0] === 'place' ? [raw] : sentences(raw);
      list.forEach(function (s, si) {
        var n = norm(s), got = inText.filter(function (g) { return g.any.test(n); });
        if (got.length) cands.push({ text: s, prefix: f[1] || '', got: got, fi: fi, si: si });
      });
    });
    if (!cands.length) return escHtml(summary);
    cands.sort(function (a, b) { return b.got.length - a.got.length || a.fi - b.fi || a.si - b.si; });
    var first = cands[0], parts = [first];
    var left = inText.filter(function (g) { return first.got.indexOf(g) === -1; });
    if (left.length) {
      var second = cands.filter(function (x) { return x !== first && x.got.some(function (g) { return left.indexOf(g) !== -1; }); })[0];
      if (second) parts.push(second);
    }
    var each = parts.length > 1 ? Math.round(maxLen / 2) : maxLen;
    return parts.map(function (p) {
      var w = window_(p.text, groups, each);
      return (p.prefix ? escHtml(p.prefix) : '') + highlight(w, groups);
    }).join(' … ');
  }

  return { create: create, parse: parse, norm: norm, highlight: highlight, snippet: snippet, stem: stem };
});
