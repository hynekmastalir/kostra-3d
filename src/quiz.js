import { bones, byId, GROUPS, groupName, answerIndex } from './data.js';
import { checkAnswer } from './text.js';
import { store } from './storage.js';
import { $, esc, shuffle, isCoarse } from './ui.js';

export function createQuiz(ctx) {
  const { viewer } = ctx;
  const root = $('#view-quiz');
  const banner = $('#banner');
  const cfg = Object.assign({ type: 'identify', answer: 'type', scope: 'all', count: 10 }, store.get('quizCfg', {}));
  let stats = store.get('quizStats', {});           // id -> { r, w }
  let active = false, run = null;

  const poolFor = scope => bones.filter(b => scope === 'all' || b.group === scope);
  const saveStats = () => store.set('quizStats', stats);
  const errorList = () => Object.entries(stats).filter(([id, s]) => s.w > 0 && byId.has(id))
    .sort((a, b) => b[1].w / (b[1].r + b[1].w) - a[1].w / (a[1].r + a[1].w) || b[1].w - a[1].w).map(([id]) => id);

  // ---------- nastavení ----------
  function showSetup() {
    run = null; banner.hidden = true; viewer.setFocus(null); viewer.setMark(null); viewer.showAll(); viewer.resetView();
    const errs = errorList();
    root.innerHTML = `
      <div class="section"><h3>Typ otázek</h3>
        <div class="seg" id="type">
          <button data-v="identify">Poznej kost</button><button data-v="locate">Najdi kost</button><button data-v="mix">Mix</button></div>
        <p class="muted small" id="type-help"></p></div>
      <div class="section" id="ans-sec"><h3>Odpověď u „Poznej kost“</h3>
        <div class="seg" id="ans"><button data-v="type">Psaním</button><button data-v="choice">Výběrem</button></div></div>
      <label class="field"><span>Okruh</span><select id="scope"><option value="all">Celá kostra</option>${GROUPS.map(g => `<option value="${g.id}" ${cfg.scope === g.id ? 'selected' : ''}>${g.name}</option>`).join('')}</select></label>
      <label class="field"><span>Počet otázek</span><select id="count">${[5, 10, 20, 30, 50].map(n => `<option ${cfg.count === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn primary block" id="start">Začít test</button>
      <div class="section"><h3>Moje chyby</h3>
        ${errs.length ? `<p class="muted small">Máš ${errs.length} kostí, které ses někdy spletl/a. Nejčastěji chybované jdou první.</p>
        <button class="btn block" id="start-err">Procvičit moje chyby (${Math.min(errs.length, cfg.count)})</button>
        <button class="btn small" id="clear-stats" style="margin-top:8px">Smazat statistiku chyb</button>` : '<p class="muted small">Zatím žádné. Chyby se ukládají i mezi návštěvami.</p>'}</div>`;
    syncSeg();
  }
  function syncSeg() {
    for (const [id, key] of [['type', 'type'], ['ans', 'answer']]) {
      $('#' + id, root)?.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === cfg[key])));
    }
    const help = { identify: 'Kost je zvýrazněná v modelu, napiš nebo vyber její název.', locate: 'Zobrazí se název a ty kost klepneš (klikneš) v modelu.', mix: 'Střídají se oba typy otázek.' };
    const h = $('#type-help', root); if (h) h.textContent = help[cfg.type];
    const s = $('#ans-sec', root); if (s) s.hidden = cfg.type === 'locate';
  }

  // ---------- průběh ----------
  // Při testu z jedné části kostry se zobrazí jen tato část (u opakování chyb z celé kostry se zobrazí vše).
  function applyScope(onlyScope) {
    if (onlyScope && cfg.scope !== 'all') {
      const keep = new Set(poolFor(cfg.scope).map(b => b.id));
      viewer.setMany(bones.filter(b => !keep.has(b.id)).map(b => b.id), false);
      viewer.setMany([...keep], true);
    } else viewer.showAll();
  }

  function start(ids, onlyScope = true) {
    const kinds = ids.map(() => cfg.type === 'mix' ? (Math.random() < 0.5 ? 'identify' : 'locate') : cfg.type);
    run = { qs: ids.map((id, i) => ({ id, kind: kinds[i] })), i: 0, results: [], waiting: false, scoped: onlyScope };
    applyScope(onlyScope); viewer.setExplode(0); viewer.setGhost(true, 0.88);
    viewer.resetView();
    nextQuestion();
  }

  function nextQuestion() {
    banner.hidden = true; viewer.setMark(null);
    if (run.i >= run.qs.length) return showSummary();
    const q = run.qs[run.i]; const b = byId.get(q.id); run.waiting = true;
    const head = `<div class="progress"><i style="width:${Math.round(100 * run.i / run.qs.length)}%"></i></div>
      <div class="row"><span class="muted small grow">Otázka ${run.i + 1} z ${run.qs.length}</span><button class="btn small" id="quit">Ukončit</button></div>`;
    if (q.kind === 'identify') {
      viewer.setFocus(b.id, 'focus'); viewer.focusBone(b.id);
      let input;
      if (cfg.answer === 'choice') {
        const others = shuffle(bones.filter(x => x.cs !== b.cs));
        const same = others.filter(x => x.group === b.group);
        const names = [];
        for (const x of [...same, ...others]) { if (names.length >= 3) break; if (!names.includes(x.cs)) names.push(x.cs); }
        q.options = shuffle([b.cs, ...names]);
        input = `<div class="choices">${q.options.map((n, k) => `<button data-k="${k}">${esc(n)}</button>`).join('')}</div>`;
      } else {
        input = `<form id="f" autocomplete="off"><input type="text" id="ans-in" placeholder="Název kosti (česky nebo latinsky)" autocapitalize="off" spellcheck="false" enterkeyhint="done">
          <div class="row" style="margin-top:8px"><button class="btn primary grow" type="submit">Zkontrolovat</button><button class="btn grow" type="button" id="show">Ukázat</button></div></form>`;
      }
      root.innerHTML = `${head}<div class="card"><div class="q">Která kost je zvýrazněna?</div><span class="badge">${groupName(b.group)}</span>${b.side !== 'střední' ? `<span class="badge">${b.side} strana</span>` : ''}</div>${input}<div id="fb"></div>`;
      if (cfg.answer !== 'choice' && !isCoarse()) $('#ans-in', root).focus();
    } else {
      viewer.setFocus(null);
      root.innerHTML = `${head}<div class="card"><div class="q">Najdi kost a klepni na ni v modelu:</div>
        <div class="name">${esc(b.label)}</div><span class="badge">${groupName(b.group)}</span></div>
        <button class="btn block" id="show">Ukázat, kde je</button><div id="fb"></div>`;
    }
  }

  function finish(ok, given, how) {
    const q = run.qs[run.i]; const b = byId.get(q.id);
    run.waiting = false;
    run.results.push({ id: b.id, kind: q.kind, ok, given });
    const s = stats[b.id] ??= { r: 0, w: 0 }; ok ? s.r++ : s.w++; saveStats();
    viewer.setFocus(b.id, ok || q.kind === 'locate' ? 'ok' : 'bad'); viewer.focusBone(b.id);
    const last = run.i === run.qs.length - 1;
    const fb = `<div class="feedback ${ok ? 'ok' : 'bad'}">${ok ? '✓ Správně!' : how === 'show' ? 'Zobrazeno:' : '✗ Špatně.'}
      <div>${esc(b.label)} <span class="la">· ${esc(b.la)}</span></div></div>
      <button class="btn primary block" id="next">${last ? 'Zobrazit výsledek' : 'Další otázka'}</button>`;
    $('#fb', root).innerHTML = fb;
    root.querySelector('form')?.querySelectorAll('input,button').forEach(el => el.disabled = true);
    root.querySelectorAll('.choices button').forEach(el => el.disabled = true);
    $('#show', root) && ($('#show', root).disabled = true);
    if (q.kind === 'locate') { banner.hidden = false; banner.className = ok ? 'ok' : 'bad'; banner.textContent = ok ? '✓ Správně!' : '✗ Špatně – správná kost je zvýrazněna'; }
    $('#next', root).focus({ preventScroll: true });
    $('#next', root).scrollIntoView({ block: 'nearest' });
  }

  function showSummary() {
    const total = run.results.length; const ok = run.results.filter(r => r.ok).length;
    const wrong = run.results.filter(r => !r.ok);
    viewer.setFocus(null); viewer.setMark(null);
    root.innerHTML = `<div class="score">${ok} / ${total}</div>
      <p style="text-align:center" class="muted">${Math.round(100 * ok / total)} % správně</p>
      ${wrong.length ? `<h3 class="muted small">Chyby (${wrong.length})</h3><ul class="mistakes">${wrong.map(r => { const b = byId.get(r.id); return `<li><b>${esc(b.label)}</b> <i class="muted">${esc(b.la)}</i>${r.given ? `<small>Tvoje odpověď: ${esc(r.given)}</small>` : ''}</li>`; }).join('')}</ul>
        <button class="btn primary block" id="redo">Procvičit jen chyby</button>` : '<p style="text-align:center">🎉 Bez jediné chyby!</p>'}
      <button class="btn block" id="again" style="margin-top:8px">Nový test</button>`;
    run.wrongIds = wrong.map(r => r.id);
  }

  // ---------- události ----------
  root.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.closest('#type')) { cfg.type = t.dataset.v; store.set('quizCfg', cfg); syncSeg(); return; }
    if (t.closest('#ans')) { cfg.answer = t.dataset.v; store.set('quizCfg', cfg); syncSeg(); return; }
    if (t.id === 'start') start(shuffle(poolFor(cfg.scope).map(b => b.id)).slice(0, cfg.count));
    else if (t.id === 'start-err') start(errorList().slice(0, cfg.count), false);
    else if (t.id === 'clear-stats') { if (confirm('Smazat uloženou statistiku chyb?')) { stats = {}; saveStats(); showSetup(); } }
    else if (t.id === 'quit') showSetup();
    else if (t.id === 'next') { run.i++; nextQuestion(); }
    else if (t.id === 'again') showSetup();
    else if (t.id === 'redo') start(shuffle(run.wrongIds), run.scoped);
    else if (t.id === 'show' && run?.waiting) finish(false, null, 'show');
    else if (t.closest('.choices') && run?.waiting) {
      const q = run.qs[run.i]; const b = byId.get(q.id); const pick = q.options[+t.dataset.k];
      const ok = pick === b.cs;
      t.classList.add(ok ? 'right' : 'wrong');
      finish(ok, ok ? null : pick);
      if (!ok) [...root.querySelectorAll('.choices button')].find(x => q.options[+x.dataset.k] === b.cs)?.classList.add('right');
    }
  });
  root.addEventListener('change', e => {
    if (e.target.id === 'scope') { cfg.scope = e.target.value; store.set('quizCfg', cfg); }
    if (e.target.id === 'count') { cfg.count = +e.target.value; store.set('quizCfg', cfg); const b = $('#start-err', root); if (b) b.textContent = `Procvičit moje chyby (${Math.min(errorList().length, cfg.count)})`; }
  });
  root.addEventListener('submit', e => {
    e.preventDefault();
    if (!run?.waiting) return;
    const val = $('#ans-in', root).value.trim(); if (!val) return;
    const b = byId.get(run.qs[run.i].id);
    finish(checkAnswer(val, b, answerIndex), val);
  });

  viewer.onTap(id => {
    if (!active || !run?.waiting) return;
    const q = run.qs[run.i]; if (q.kind !== 'locate' || !id) return;
    const ok = id === q.id;
    if (!ok) viewer.setMark(id, 'bad');
    finish(ok, ok ? null : byId.get(id).label);
  });

  return {
    enter() { active = true; root.hidden = false; viewer.showAll(); viewer.setExplode(0); showSetup(); },
    leave() { active = false; root.hidden = true; banner.hidden = true; viewer.setFocus(null); viewer.setMark(null); },
  };
}
