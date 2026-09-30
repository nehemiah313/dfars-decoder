let DATA = { clauses: [], quiz: [] };
const presence = {}; // clause number -> 'present' | 'missing' | 'na'
const LS_KEY = 'dfars-decoder-v1';
const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function byNum(n) { return DATA.clauses.find(c => c.number === n); }
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify({ presence })); } catch (e) {} }
function load() {
  try { Object.assign(presence, JSON.parse(localStorage.getItem(LS_KEY) || '{}').presence || {}); } catch (e) {}
}

function clauseCard(c) {
  return '<div class="clause" data-clause="' + c.number + '" data-search="' + esc((c.number + ' ' + c.title + ' ' + c.plain).toLowerCase()) + '">' +
    '<div class="clause-head"><span class="clause-num">' + c.number + '</span>' +
    '<span class="seg sm">' +
    ['present', 'missing', 'na'].map(s => '<button data-p="' + s + '" class="' + (presence[c.number] === s ? 'on' : '') + '">' +
      (s === 'present' ? 'In my contract' : s === 'missing' ? 'Missing' : 'N/A') + '</button>').join('') +
    '</span></div>' +
    '<h3>' + esc(c.title) + '</h3>' +
    '<p class="plain">' + esc(c.plain) + '</p>' +
    '<div class="cols">' +
    '<div><h4>What it requires</h4><ul>' + c.requires.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></div>' +
    '<div><h4>Applies to you if</h4><ul>' + c.applies_if.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></div>' +
    '</div>' +
    (c.deadlines.length ? '<h4>Key deadlines</h4><ul class="deadlines">' + c.deadlines.map(d => '<li><strong>' + esc(d.label) + ':</strong> ' + esc(d.value) + '</li>').join('') + '</ul>' : '') +
    '<h4>Watch out</h4><ul class="watch">' + c.watch_out.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul>' +
    '<p class="muted small">Related: ' + c.related.map(r => '<button class="linklike" data-goto="' + r + '">' + r + '</button>').join(', ') + '</p>' +
    '</div>';
}

function buildUI() {
  $('clauses').innerHTML = DATA.clauses.map(clauseCard).join('');
  $('clauses').querySelectorAll('.seg button').forEach(b => {
    b.addEventListener('click', () => {
      const num = b.closest('[data-clause]').dataset.clause;
      presence[num] = presence[num] === b.dataset.p ? '' : b.dataset.p;
      save();
      b.closest('.seg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x.dataset.p === presence[num]));
      buildChecklist();
    });
  });
  $('clauses').querySelectorAll('[data-goto]').forEach(b => {
    b.addEventListener('click', () => {
      const el = document.querySelector('[data-clause="' + b.dataset.goto + '"]');
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
    });
  });
  buildQuiz();
  buildChecklist();
}

function buildQuiz() {
  $('quiz').innerHTML = DATA.quiz.map(q =>
    '<div class="q" data-q="' + q.id + '"><p><strong>' + esc(q.q) + '</strong></p>' +
    '<div class="seg">' +
    '<button data-a="yes" class="">Yes</button><button data-a="no" class="">No</button><button data-a="unsure" class="">Not sure</button>' +
    '</div></div>').join('') +
    '<div class="row"><button id="runQuiz" class="btn primary">Decode my contract</button></div>';
  const answers = {};
  $('quiz').querySelectorAll('.q .seg button').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.closest('.q').dataset.q;
      answers[id] = b.dataset.a;
      b.closest('.seg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  });
  $('runQuiz').addEventListener('click', () => {
    const hits = {};
    const notes = [];
    for (const q of DATA.quiz) {
      const a = answers[q.id];
      const key = a === 'yes' ? 'yes_clauses' : a === 'no' ? 'no_clauses' : null;
      if (key && q[key]) for (const n of q[key]) hits[n] = true;
      if ((a === 'yes' || a === 'no') && q[a === 'yes' ? 'yes_note' : 'no_note']) notes.push(q[a === 'yes' ? 'yes_note' : 'no_note']);
      if (a === 'unsure') notes.push('You answered "not sure" to: ' + q.q + ' Find this out before you sign.');
    }
    const nums = Object.keys(hits);
    const box = $('quizResult');
    box.classList.remove('hidden');
    box.innerHTML = nums.length
      ? '<h3>Your clause list</h3><p class="muted">These clauses most likely apply to your situation. Verify against your actual contract.</p>' +
        '<div class="hitlist">' + nums.map(n => { const c = byNum(n); return '<div class="hit"><span class="clause-num">' + n + '</span> ' + esc(c ? c.title : '') + '</div>'; }).join('') + '</div>' +
        '<ul class="watch">' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>'
      : '<p class="muted">Answer the questions above, then run the decoder.</p>';
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function buildChecklist() {
  const missing = DATA.clauses.filter(c => presence[c.number] === 'missing');
  $('checklist').innerHTML = missing.length
    ? '<p><strong>' + missing.length + ' clause(s) missing from your contract:</strong></p><ul class="watch">' +
      missing.map(c => '<li><strong>' + c.number + '</strong> ' + esc(c.title) + '. ' + esc(c.plain) + '</li>').join('') + '</ul>'
    : '<p class="muted">Mark clauses above as In my contract, Missing, or N/A. Anything missing lands here as your action list.</p>';
}

function exportMd() {
  let s = '# DFARS Clause Action List\n\nGenerated ' + new Date().toISOString().slice(0, 10) + '.\n\n';
  for (const c of DATA.clauses) {
    const p = presence[c.number];
    s += '## ' + c.number + ' — ' + c.title + '\n\n';
    s += '**Status:** ' + (p === 'present' ? 'In contract' : p === 'missing' ? 'MISSING — follow up' : p === 'na' ? 'Not applicable' : 'Not reviewed') + '\n\n';
    s += c.plain + '\n\n';
    if (p === 'missing') {
      s += '**Action:** Confirm with your contracting officer whether this clause belongs in your contract, and what you must do to comply.\n\n';
    }
  }
  s += '_Plain-English summaries, not legal advice. Confirm clause text and applicability with your contracting officer and counsel._\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([s], { type: 'text/markdown' }));
  a.download = 'dfars-clause-action-list.md';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

async function init() {
  const res = await fetch('data/dfars-clauses.json');
  DATA = await res.json();
  load();
  buildUI();
  $('search').addEventListener('input', () => {
    const q = $('search').value.toLowerCase();
    document.querySelectorAll('#clauses .clause').forEach(el => {
      el.style.display = (!q || el.dataset.search.includes(q)) ? '' : 'none';
    });
  });
  $('exportMd').addEventListener('click', exportMd);
  $('resetAll').addEventListener('click', () => {
    if (confirm('Clear clause tracking?')) {
      Object.keys(presence).forEach(k => delete presence[k]);
      save(); buildUI();
    }
  });
}
init();
