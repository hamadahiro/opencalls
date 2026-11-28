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
    ['title', 12], ['org', 8], ['jury', 6], ['announced', 6], ['place', 5], ['summary', 4], ['category', 3], ['prize', 3], ['eligibility', 3],
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
        announced: (c.announced || []).map(function (g) { return g.names.join(' · '); }).join(' · '),
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

    // Edit distance: a letter added, dropped, changed, or two neighbours swapped ("grnat" → "grant") count one each.
    // Stops early once every way is past max (a row's smallest value never falls in the rows after it).
    function distance(a, b, max) {
      if (Math.abs(a.length - b.length) > max) return max + 1;
      var pp = null, prev = [], cur, i, j;
      for (j = 0; j <= b.length; j++) prev[j] = j;
      for (i = 1; i <= a.length; i++) {
        cur = [i]; var lo = i;
        for (j = 1; j <= b.length; j++) {
          var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (pp && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, pp[j - 2] + 1);
          cur[j] = v;
          if (v < lo) lo = v;
        }
        if (lo > max) return max + 1;
        pp = prev; prev = cur;
      }
      return prev[b.length];
    }
    // The calls' word nearest to a word that found nothing, one letter off (two in words of 8 letters or more); among
    // equally near words, the one most calls use ("residancy" → "residency").
    function correct(w) {
      if (w.length < 4) return null;
      var max = w.length >= 8 ? 2 : 1, v = vocabulary(), best = null, bestD = max + 1, bestN = 0;
      for (var k in v) {
        var d = distance(w, k, max);
        if (d < bestD || (d === bestD && d <= max && v[k] > bestN)) { best = k; bestD = d; bestN = v[k]; }
      }
      return bestD <= max ? best : null;
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
    var cut = text.slice(start, end).replace(/[\s,;:·–—-]+$/, '');
    if (start > 0) cut = cut.replace(/^[\s,;:·–—-]+/, '');   // a cut never starts or ends on a separator ("…· Richard Hall")
    return (start > 0 ? '…' : '') + cut + (end < text.length ? '…' : '');
  }

  // The words under a result: the call's own summary when it holds the found words (or nothing was found outside the
  // title and organiser); otherwise the sentences of the call's texts where they are, best first, up to two.
  var SNIP_FIELDS = [['summary'], ['description'], ['prose'], ['requirements'], ['prize', 'Prize: '], ['fee', 'Fee: '],
    ['jury', 'Jury: '], ['announced', ''], ['eligibility', 'Who can apply: '], ['place', '']];
  function snippet(result, groups, maxLen) {
    maxLen = maxLen || 240;
    var c = result.row, d = result.doc;
    var inText = groups.filter(function (g) { return SNIP_FIELDS.some(function (f) { return g.any.test(d.n[f[0]]); }); });
    var summary = c.summary || c.description || '';
    if (!inText.length) return escHtml(summary);
    var cands = [];
    SNIP_FIELDS.forEach(function (f, fi) {
      // an announced group: its names, quoted under its label as the call page prints it ("Juror's Choice: …")
      var raw = f[0] === 'announced' ? (c.announced || []).map(function (g) { return { text: g.names.join(' · '), prefix: (g.label || 'Announced') + ': ' }; })
        : f[0] === 'jury' ? (c.jury || []).join(', ') : f[0] === 'prose' ? (c.prose || []).join(' ')
        : f[0] === 'place' ? c.location : f[0] === 'eligibility' ? null : f[0] === 'fee' ? [c.fee, c.additionalFees].filter(Boolean).join('; ') : c[f[0]];
      if (!raw) return;
      var list = f[0] === 'announced' ? raw : f[0] === 'summary' || f[0] === 'jury' || f[0] === 'prize' || f[0] === 'fee' || f[0] === 'place' ? [raw] : sentences(raw);
      list.forEach(function (s, si) {
        var pre = f[1] || '';
        if (typeof s === 'object') { pre = s.prefix; s = s.text; }
        var n = norm(s), got = inText.filter(function (g) { return g.any.test(n); });
        if (got.length) cands.push({ text: s, prefix: pre, got: got, fi: fi, si: si });
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

  // --- Suggestions while typing, as search engines show them (owner, 2026-11-28) ---

  // Words that never start or end a suggestion.
  var SUGGEST_STOP = {};
  ('a an and the of for in on at to by with or from into is are be your our its this that these those as it & ' +
    'open call calls opportunity opportunities edition annual').split(' ').forEach(function (w) { SUGGEST_STOP[w] = 1; });

  // The phrases the box completes to, best first: words and runs of two or three words from the calls' titles,
  // organisers and places, their categories, the jurors' full names and single topic words from the summaries. A call's
  // use counts 3 from a title, organiser, place, category or name and 1 from a summary, twice while it accepts
  // submissions. A phrase is kept when two calls use it (a juror's or organiser's full name: one). Each phrase is shown
  // as the calls write it, lower case, accents and apostrophes kept ("rencontres d'arles"); matched through norm().
  // generate-pages.js writes the list into search-index.js on every build; nothing is kept by hand.
  function suggestions(rows, maps, today) {
    maps = maps || {};
    var score = {}, uses = {}, shown = {}, whole = {};
    rows.forEach(function (r) {
      var open = r.deadline === 'Continuous' || r.deadline >= today, got = {};
      function tokens(part) {
        return part.split(/\s+/).map(function (t) { return t === '&' ? t : t.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); })
          .filter(function (t) { return t === '&' || /[\p{L}\p{N}]/u.test(t); });
      }
      function keep(disp, weight) {
        var key = norm(disp).trim();
        if (key.length < 3) return;
        if (!shown[key]) shown[key] = disp;
        got[key] = Math.max(got[key] || 0, weight);
      }
      function add(text, maxN, weight) {
        if (!text) return;
        String(text).split(/[·,;:()\/|–—.!?"“”]+|\s-\s/).forEach(function (part) {
          var t = tokens(part);
          for (var n = 1; n <= maxN; n++) for (var i = 0; i + n <= t.length; i++) {
            var g = t.slice(i, i + n), first = norm(g[0]).trim(), last = norm(g[n - 1]).trim();
            if (SUGGEST_STOP[first] || SUGGEST_STOP[last]) continue;
            if (g.some(function (x) { var k = norm(x).trim(); return x !== '&' && (k.length < 2 || (/^\d+$/.test(k) && k.length !== 4)); })) continue;
            keep(g.join(' '), weight);
          }
        });
      }
      function name(text) {
        var t = tokens(String(text || '').split(',')[0]);
        if (t.length < 2 || t.length > 6 || t.some(function (x) { return SUGGEST_STOP[norm(x).trim()]; })) return;
        var d = t.join(' '); keep(d, 3); whole[norm(d).trim()] = 1;
      }
      add(r.title, 3, 3); add(r.org, 3, 3); add(r.location, 2, 3);
      add(maps.categoryLabel && maps.categoryLabel[r.category] || r.category, 2, 3);
      add(r.summary, 1, 1);
      name(r.org); (r.jury || []).forEach(name);
      (r.announced || []).forEach(function (g) { g.names.forEach(name); });   // announced artists' full names, as jurors'
      for (var k in got) { score[k] = (score[k] || 0) + got[k] * (open ? 2 : 1); uses[k] = (uses[k] || 0) + 1; }
    });
    return Object.keys(score).filter(function (k) { return uses[k] >= 2 || whole[k]; })
      .sort(function (a, b) { return score[b] - score[a] || (a < b ? -1 : 1); })
      .map(function (k) { return shown[k]; });
  }

  // Completes what is typed, as a list of phrases (up to max): every phrase that starts with the whole typed text, best
  // first; when none does and several words are typed, the last word completed after the others — only those that still
  // find a call whose title, organiser, place, category, jury or summary holds every word, most calls first. So no
  // suggestion leads to an empty page.
  function completer(list, rows, maps) {
    maps = maps || {};
    var keys = list.map(function (p) { return norm(p).trim(); }), texts = null;
    function callTexts() {
      if (!texts) texts = rows.map(function (r) {
        return norm([r.title, r.org, r.location, maps.categoryLabel && maps.categoryLabel[r.category], (r.jury || []).join(' '),
          r.summary].join(' '));
      });
      return texts;
    }
    return function complete(query, max) {
      max = max || 7;
      var nq = norm(query).trim(), out = [], seen = {};
      if (!nq) return out;
      seen[nq] = 1;
      for (var i = 0; i < keys.length && out.length < max; i++)
        if (keys[i].length > nq.length && keys[i].indexOf(nq) === 0 && !seen[keys[i]]) { seen[keys[i]] = 1; out.push(list[i]); }
      var ws = nq.split(' ');
      var typedWords = query.trim().split(/\s+/);
      if (!out.length && ws.length > 1 && typedWords.length === ws.length) {   // "b&w" is one typed word, three of norm's
        var prev = ws.slice(0, -1), last = ws[ws.length - 1], T = callTexts(), scored = [];
        var prevShown = typedWords.slice(0, -1).join(' ');
        for (var j = 0, tried = 0; j < keys.length && tried < 25; j++) {
          if (keys[j].indexOf(last) !== 0 || keys[j] === last) continue;
          tried++;
          var key = prev.join(' ') + ' ' + keys[j];
          if (seen[key]) continue;
          var need = prev.concat(keys[j].split(' ')), n = 0;
          for (var k = 0; k < T.length; k++) if (need.every(function (w) { return T[k].indexOf(' ' + w + ' ') !== -1; })) n++;
          if (n) { seen[key] = 1; scored.push([prevShown + ' ' + list[j], n]); }
        }
        scored.sort(function (a, b) { return b[1] - a[1]; });
        for (var s = 0; s < scored.length && out.length < max; s++) out.push(scored[s][0]);
      }
      return out;
    };
  }

  // A suggestion with the typed part plain and the rest strong, as search engines draw it: the typed letters are matched
  // through foldChar, so accents, case and punctuation do not move the cut ("sao p" in "são paulo").
  function completionHtml(phrase, typed) {
    var want = foldWithMap(String(typed)).text.replace(/[^a-z0-9]/g, '');
    var got = 0, cut = 0, fm = foldWithMap(phrase);
    for (var i = 0; i < fm.text.length && got < want.length; i++) {
      if (!/[a-z0-9]/.test(fm.text[i])) continue;
      if (fm.text[i] !== want[got]) { got = -1; break; }
      got++; cut = fm.map[i] + 1;
    }
    if (got < want.length) return escHtml(phrase);
    return escHtml(phrase.slice(0, cut)) + (cut < phrase.length ? '<b>' + escHtml(phrase.slice(cut)) + '</b>' : '');
  }

  return { create: create, parse: parse, norm: norm, highlight: highlight, snippet: snippet, stem: stem,
    suggestions: suggestions, completer: completer, completionHtml: completionHtml };
});
