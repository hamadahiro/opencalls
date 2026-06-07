#!/usr/bin/env node
// Show prose-coverage status across all calls.
// Usage:
//   node prose-status.js              # summary + next 5 pending
//   node prose-status.js next [N]     # next N pending entries (default 5)
//   node prose-status.js skipped      # list all proseSkipped entries with reasons
//   node prose-status.js done         # list all entries with prose

const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const isOpen = c => c.deadline === 'Continuous' || c.deadline >= today;
const sortKey = c => c.deadline === 'Continuous' ? '9999-99-99' : c.deadline;

const all = data.calls;
const open = all.filter(isOpen);
const closed = all.filter(c => !isOpen(c));
const withProse = all.filter(c => c.prose && c.prose.length);
const skipped = all.filter(c => c.proseSkipped);
const pendingOpen = open
  .filter(c => !c.prose && !c.proseSkipped)
  .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));
const pendingClosed = closed
  .filter(c => !c.prose && !c.proseSkipped)
  .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'next') {
  const n = parseInt(arg, 10) || 5;
  const batch = pendingOpen.slice(0, n);
  if (!batch.length) {
    console.log('No pending open entries. All open calls have prose or are marked proseSkipped.');
    console.log(`Closed pending: ${pendingClosed.length}`);
    process.exit(0);
  }
  console.log(`Next ${batch.length} pending open entries (sorted by furthest deadline first):\n`);
  batch.forEach((c, i) => {
    console.log(`${i + 1}. [${c.deadline}] ${c.title}`);
    console.log(`   org:  ${c.org}`);
    console.log(`   url:  ${c.url}`);
    console.log(`   slug: ${c.slug}`);
    console.log('');
  });
  process.exit(0);
}

if (cmd === 'skipped') {
  if (!skipped.length) { console.log('No entries marked proseSkipped.'); process.exit(0); }
  console.log(`${skipped.length} entries marked proseSkipped:\n`);
  skipped.forEach(c => {
    console.log(`- ${c.title}`);
    console.log(`  reason: ${c.proseSkipped}`);
    console.log('');
  });
  process.exit(0);
}

if (cmd === 'done') {
  if (!withProse.length) { console.log('No entries have prose yet.'); process.exit(0); }
  console.log(`${withProse.length} entries have prose:\n`);
  withProse.forEach(c => {
    const wc = c.prose.reduce((sum, p) => sum + p.split(/\s+/).length, 0);
    console.log(`- [${c.deadline}] ${c.title} — ${wc} words`);
  });
  process.exit(0);
}

// Default: summary
const openWithProse = open.filter(c => c.prose && c.prose.length).length;
const openSkipped = open.filter(c => c.proseSkipped).length;
const closedWithProse = closed.filter(c => c.prose && c.prose.length).length;

console.log('Prose coverage status');
console.log('---------------------');
console.log(`Total entries:           ${all.length}`);
console.log(`Open (deadline future):  ${open.length}`);
console.log(`  with prose:            ${openWithProse}`);
console.log(`  proseSkipped:          ${openSkipped}`);
console.log(`  pending:               ${pendingOpen.length}`);
console.log(`Closed:                  ${closed.length}`);
console.log(`  with prose:            ${closedWithProse}`);
console.log(`  pending:               ${pendingClosed.length}`);
console.log('');
console.log(`Open coverage: ${openWithProse}/${open.length} (${(open.length ? (openWithProse/open.length)*100 : 0).toFixed(1)}%) — pending ${pendingOpen.length}`);
console.log('');

if (pendingOpen.length) {
  console.log('Next 5 open pending (sorted by furthest deadline):');
  pendingOpen.slice(0, 5).forEach((c, i) => {
    console.log(`  ${i + 1}. [${c.deadline}] ${c.title}`);
  });
  console.log('');
  console.log('Run `node prose-status.js next 10` to see more.');
}
