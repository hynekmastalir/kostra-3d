import { bones, byId, GROUPS, groupName } from './data.js';
import { store } from './storage.js';
import { $, $$, esc, shuffle } from './ui.js';

// Leitnerův systém, 5 krabiček. Krabička 1 = hned znovu, vyšší krabičky se opakují po delších odstupech.
const DAY = 86400000;
const INTERVAL = [0, 0, 1 * DAY, 3 * DAY, 7 * DAY, 14 * DAY]; // index = číslo krabičky
const KEY = 'leitner';

export function createCards(ctx) {
  const { viewer } = ctx;
  const root = $('#view-cards');
  let cfg = Object.assign({ scope: 'all' }, store.get('cardsCfg', {}));
  let state = store.get(KEY, {});       // id -> { b, due }
  let queue = [], current = null, flipped = false, doneCount = 0, active = false;

  const inScope = () => bones.filter(b => cfg.scope === 'all' || b.group === cfg.scope);
  const st = id => state[id] ?? { b: 1, due: 0 };
  const save = () => store.set(KEY, state);

  // Zobrazí jen vybraný okruh (celá kostra = vše).
  function applyScope() {
    const keep = new Set(inScope().map(b => b.id));
    viewer.setMany(bones.filter(b => !keep.has(b.id)).map(b => b.id), false);
    viewer.setMany([...keep], true);
  }

  function buildQueue(force = false) {
    applyScope();
    const now = Date.now();
    let pool = inScope().filter(b => force || st(b.id).due <= now);
    pool = shuffle(pool).sort((a, b) => st(a.id).b - st(b.id).b);   // slabší krabičky dřív, v rámci krabičky náhodně
    queue = pool.map(b => b.id);
    doneCount = 0;
  }

  function render() {
    const scopeOpts = `<option value="all">Celá kostra</option>` + GROUPS.map(g => `<option value="${g.id}" ${cfg.scope === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
    const counts = [1, 2, 3, 4, 5].map(n => inScope().filter(b => st(b.id).b === n).length);
    const boxes = `<div class="boxes">${counts.map((c, i) => `<div>Krabička ${i + 1}<b>${c}</b></div>`).join('')}</div>`;
    let body;
    if (!current) {
      const next = Math.min(...inScope().map(b => st(b.id).due).filter(d => d > Date.now()), Infinity);
      body = `<div class="card"><div class="q">🎉 Hotovo</div>
        <p class="muted">${doneCount ? `Zopakováno ${doneCount} kartiček.` : 'Na teď není nic k opakování.'}
        ${isFinite(next) ? `Další kartička přijde na řadu ${new Date(next).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}.` : ''}</p>
        <button class="btn primary block" id="again-all">Procvičit i tak (od nejslabších)</button></div>`;
    } else {
      const b = byId.get(current);
      const left = queue.length;
      body = flipped ? `
        <div class="card">
          <div class="name">${esc(b.cs)}</div><div class="la">${esc(b.la)}</div>
          <div><span class="badge">${groupName(b.group)}</span>${b.side !== 'střední' ? `<span class="badge">${b.side} strana</span>` : ''}</div>
          <p class="desc">${esc(b.desc)}</p>
        </div>
        <div class="row"><button class="btn bad grow" id="no">✗ Neumím</button><button class="btn ok grow" id="yes">✓ Umím</button></div>
        <p class="muted small" style="text-align:center">Klávesy: ← neumím, → umím</p>`
        : `
        <div class="card">
          <div class="q">Která kost je zvýrazněna v modelu?</div>
          <div><span class="badge">${groupName(b.group)}</span></div>
          <p class="muted small">Model můžeš otáčet a přibližovat. Pak kartičku otoč.</p>
        </div>
        <button class="btn primary block" id="flip">Otočit kartičku</button>
        <p class="muted small" style="text-align:center">Klávesa: mezerník</p>`;
      body = `<div class="progress" aria-hidden="true"><i style="width:${Math.round(100 * doneCount / (doneCount + left || 1))}%"></i></div>
        <div class="muted small">Ve frontě ${left} · krabička ${st(current).b}</div>` + body;
    }
    root.innerHTML = `<label class="field"><span>Okruh</span><select id="scope">${scopeOpts}</select></label>${boxes}${body}
      <button class="btn small" id="reset-prog" style="margin-top:14px">Smazat postup v tomto okruhu</button>`;
  }

  function showCurrent() {
    current = queue[0] ?? null; flipped = false;
    if (current) { viewer.setFocus(current, 'focus'); viewer.focusBone(current); } else viewer.setFocus(null);
    render();
  }

  function answer(known) {
    const id = current; const s = st(id); const now = Date.now();
    queue.shift();
    if (known) {
      const nb = Math.min(5, s.b + 1); state[id] = { b: nb, due: now + INTERVAL[nb] };
      doneCount++;
    } else {
      state[id] = { b: 1, due: now };
      queue.splice(Math.min(queue.length, 3), 0, id);      // za pár kartiček znovu
    }
    save(); showCurrent();
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.id === 'flip') { flipped = true; render(); $('#yes', root)?.focus({ preventScroll: true }); }
    else if (t.id === 'yes') answer(true);
    else if (t.id === 'no') answer(false);
    else if (t.id === 'again-all') { buildQueue(true); showCurrent(); }
    else if (t.id === 'reset-prog') {
      if (confirm('Opravdu smazat postup kartiček v tomto okruhu?')) { inScope().forEach(b => delete state[b.id]); save(); buildQueue(); showCurrent(); }
    }
  });
  root.addEventListener('change', e => {
    if (e.target.id === 'scope') { cfg.scope = e.target.value; store.set('cardsCfg', cfg); buildQueue(); showCurrent(); }
  });
  document.addEventListener('keydown', e => {
    if (!active || e.target.matches('input, select, textarea') || !current) return;
    if (!flipped && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); flipped = true; render(); }
    else if (flipped && e.key === 'ArrowRight') answer(true);
    else if (flipped && e.key === 'ArrowLeft') answer(false);
  });

  return {
    enter() {
      active = true; root.hidden = false;
      viewer.showAll(); viewer.setExplode(0); viewer.setMark(null); viewer.setGhost(true, 0.88);
      buildQueue(); showCurrent();
    },
    leave() { active = false; root.hidden = true; viewer.setFocus(null); },
  };
}
