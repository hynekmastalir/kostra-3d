import { bones, byId, GROUPS, groupName, search } from './data.js';
import { store } from './storage.js';
import { $, $$, esc } from './ui.js';

export function createBrowse(ctx) {
  const { viewer } = ctx;
  const root = $('#view-browse');
  const info = $('#info');
  const cfg = Object.assign({ color: 'real', ghost: true, strength: 0.85 }, store.get('browse', {}));
  let selected = null;
  let infoOpen = store.get('infoOpen', false);

  root.innerHTML = `
    <div class="section search">
      <label class="field"><span>Hledat kost</span>
        <input id="q" type="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="např. stehenní, femur, žebro, lopatka…"
          role="combobox" aria-expanded="false" aria-controls="sug" aria-autocomplete="list"></label>
      <ul id="sug" class="suggest" role="listbox" hidden></ul>
    </div>
    <div class="section">
      <h3>Zobrazení částí</h3>
      <div class="chips" id="groups"></div>
      <div class="row" style="margin-top:8px">
        <button class="btn small" id="show-all">Zobrazit vše</button>
        <button class="btn small" id="hide-all">Skrýt vše</button>
      </div>
    </div>
    <div class="section">
      <h3>Barvy</h3>
      <div class="seg" id="colors">
        <button data-v="real">Realistické</button><button data-v="distinct">Rozlišené</button>
      </div>
    </div>
    <div class="section">
      <h3>Průhlednost</h3>
      <label class="check"><input type="checkbox" id="ghost"> <span>Vybraná kost plná, ostatní vyblednou</span></label>
      <label class="field"><span>Síla vyblednutí: <b id="ghost-val"></b></span><input type="range" id="strength" min="0" max="95" step="1"></label>
    </div>
    <div class="section">
      <h3>Rozložení kostry</h3>
      <div class="row">
        <button class="btn small" id="explode-btn">Rozložit</button>
        <input type="range" id="explode" min="0" max="100" step="1" class="grow" aria-label="Míra rozložení">
      </div>
    </div>
    <div class="section tree">
      <h3>Seznam kostí</h3>
      <div id="tree"></div>
    </div>`;

  // ---------- skupiny ----------
  const chipsEl = $('#groups', root);
  chipsEl.innerHTML = GROUPS.map(g => `<button class="chip" data-g="${g.id}" aria-pressed="true">${g.name}</button>`).join('');
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return;
    const ids = bones.filter(x => x.group === b.dataset.g).map(x => x.id);
    const allOn = ids.every(id => viewer.isVisible(id));
    viewer.setMany(ids, !allOn);
    if (selected && !viewer.isVisible(selected)) deselect();
  });
  $('#show-all', root).onclick = () => viewer.showAll();
  $('#hide-all', root).onclick = () => { viewer.setMany(bones.map(b => b.id), false); deselect(); };

  // ---------- strom ----------
  const treeEl = $('#tree', root);
  treeEl.innerHTML = GROUPS.map(g => {
    const list = bones.filter(b => b.group === g.id);
    return `<details data-g="${g.id}"><summary><span class="arrow">▸</span>
      <input type="checkbox" class="gcheck" aria-label="Zobrazit skupinu ${g.name}" style="width:22px;height:22px;accent-color:var(--accent)">
      <span>${g.name}</span><span class="count"></span></summary>
      ${list.map(b => `<div class="bone" data-id="${b.id}">
        <input type="checkbox" aria-label="Zobrazit: ${esc(b.label)}">
        <span class="swatch" style="background:${b.color}" hidden></span>
        <button>${esc(b.cs)}${b.side !== 'střední' ? `<span class="side">${b.side[0] === 'p' ? 'P' : 'L'}</span>` : ''}</button></div>`).join('')}
    </details>`;
  }).join('');

  treeEl.addEventListener('click', e => {
    if (e.target.closest('.gcheck')) {
      e.stopPropagation();
      const g = e.target.closest('details').dataset.g;
      viewer.setMany(bones.filter(b => b.group === g).map(b => b.id), e.target.checked);
      if (selected && !viewer.isVisible(selected)) deselect();
      return;
    }
    const row = e.target.closest('.bone'); if (!row) return;
    const id = row.dataset.id;
    if (e.target.matches('input')) {
      viewer.setVisible(id, e.target.checked);
      if (!e.target.checked && selected === id) deselect();
    } else if (e.target.closest('button')) {
      select(id, { reveal: true });
    }
  });

  function syncUI() {
    for (const g of GROUPS) {
      const ids = bones.filter(b => b.group === g.id).map(b => b.id);
      const on = ids.filter(id => viewer.isVisible(id)).length;
      const chip = $(`.chip[data-g="${g.id}"]`, chipsEl);
      chip.setAttribute('aria-pressed', on === ids.length ? 'true' : on === 0 ? 'false' : 'mixed');
      const det = $(`details[data-g="${g.id}"]`, treeEl);
      const gc = $('.gcheck', det); gc.checked = on === ids.length; gc.indeterminate = on > 0 && on < ids.length;
      $('.count', det).textContent = `${on}/${ids.length}`;
    }
    for (const row of $$('.bone', treeEl)) {
      const vis = viewer.isVisible(row.dataset.id);
      $('input', row).checked = vis; row.classList.toggle('off', !vis);
      $('button', row).classList.toggle('sel', row.dataset.id === selected);
    }
    const sw = cfg.color === 'distinct';
    $$('.swatch', treeEl).forEach(s => s.hidden = !sw);
  }
  viewer.onVisibility = () => { if (ctx.mode === 'browse') syncUI(); };

  // ---------- barvy, průhlednost, rozložení ----------
  const colorsEl = $('#colors', root);
  function applyColor() {
    viewer.setColorMode(cfg.color);
    $$('button', colorsEl).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === cfg.color)));
    syncUI();
  }
  colorsEl.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; cfg.color = b.dataset.v; store.set('browse', cfg); applyColor(); });

  const ghostEl = $('#ghost', root), strEl = $('#strength', root);
  function applyGhost() {
    ghostEl.checked = cfg.ghost; strEl.value = Math.round(cfg.strength * 100); strEl.disabled = !cfg.ghost;
    $('#ghost-val', root).textContent = Math.round(cfg.strength * 100) + ' %';
    viewer.setGhost(cfg.ghost, cfg.strength);
  }
  ghostEl.onchange = () => { cfg.ghost = ghostEl.checked; store.set('browse', cfg); applyGhost(); };
  strEl.oninput = () => { cfg.strength = strEl.value / 100; store.set('browse', cfg); applyGhost(); };

  const exEl = $('#explode', root), exBtn = $('#explode-btn', root);
  const syncExplode = t => { exEl.value = Math.round(t * 100); exBtn.textContent = t > 0.5 ? 'Složit' : 'Rozložit'; };
  exEl.oninput = () => { viewer.stopAnims(); viewer.setExplode(exEl.value / 100); syncExplode(viewer.explode); };
  exBtn.onclick = () => { const to = viewer.explode > 0.5 ? 0 : 1; viewer.animateExplode(to, syncExplode); viewer.fitAll(true, to); };

  // ---------- výběr kosti + info ----------
  function select(id, { reveal = false, focus = true } = {}) {
    const b = byId.get(id); if (!b) return;
    if (reveal && !viewer.isVisible(id)) viewer.setVisible(id, true);
    selected = id;
    viewer.setFocus(id, 'focus');
    if (focus) viewer.focusBone(id);
    info.hidden = false;
    const open = infoOpen;
    info.innerHTML = `<div class="info-head"><h2>${esc(b.cs)}</h2>
        <button class="icon-sm" data-a="toggle" aria-expanded="${open}" aria-label="${open ? 'Skrýt podrobnosti' : 'Zobrazit podrobnosti'}">${open ? '▲' : '▼'}</button>
        <button class="icon-sm" data-a="close" aria-label="Zavřít">✕</button></div>
      <div class="info-body" ${open ? '' : 'hidden'}><p class="la">${esc(b.la)}</p>
      <div><span class="badge">${groupName(b.group)}</span>${b.side !== 'střední' ? `<span class="badge">${b.side} strana</span>` : ''}</div>
      <p class="desc">${esc(b.desc)}</p>
      <div class="row"><button class="btn small" data-a="hide">Skrýt</button><button class="btn small" data-a="iso">Jen tato</button>
      <button class="btn small" data-a="fly">Najet</button></div></div>`;
    syncUI();
    const det = $(`details[data-g="${b.group}"]`, treeEl); if (det) det.open = true;
    $(`.bone[data-id="${id}"]`, treeEl)?.scrollIntoView({ block: 'nearest' });
  }
  function deselect() {
    selected = null; viewer.setFocus(null); info.hidden = true; info.innerHTML = ''; syncUI();
  }
  info.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a || !selected) return;
    if (a === 'hide') { const id = selected; deselect(); viewer.setVisible(id, false); }
    else if (a === 'iso') { const id = selected; viewer.setMany(bones.map(b => b.id), false); viewer.setVisible(id, true); viewer.focusBone(id); }
    else if (a === 'fly') viewer.focusBone(selected);
    else if (a === 'toggle') { infoOpen = !infoOpen; store.set('infoOpen', infoOpen); select(selected, { focus: false }); }
    else deselect();
  });

  viewer.onTap((id) => {
    if (ctx.mode !== 'browse') return;
    if (id) select(id, { focus: false }); else deselect();
  });

  // ---------- vyhledávání ----------
  const q = $('#q', root), sug = $('#sug', root); let items = [], act = -1;
  function renderSug() {
    items = search(q.value);
    sug.hidden = !items.length; q.setAttribute('aria-expanded', String(!!items.length));
    sug.innerHTML = items.map((b, i) => `<li role="option" data-i="${i}" aria-selected="${i === act}"><span>${esc(b.cs)}${b.side !== 'střední' ? ` <span class="muted">· ${b.side}</span>` : ''}</span><span class="s-la">${esc(b.la)} · ${groupName(b.group)}</span></li>`).join('');
  }
  function pick(i) {
    const b = items[i]; if (!b) return;
    sug.hidden = true; q.value = b.cs + (b.side !== 'střední' ? ` (${b.side})` : ''); q.blur();
    select(b.id, { reveal: true });
  }
  q.addEventListener('input', () => { act = -1; renderSug(); });
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { act = Math.min(items.length - 1, act + 1); renderSug(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { act = Math.max(0, act - 1); renderSug(); e.preventDefault(); }
    else if (e.key === 'Enter') { pick(act >= 0 ? act : 0); e.preventDefault(); }
    else if (e.key === 'Escape') { sug.hidden = true; }
  });
  sug.addEventListener('pointerdown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); pick(+li.dataset.i); } });
  q.addEventListener('blur', () => setTimeout(() => { sug.hidden = true; }, 120));
  q.addEventListener('focus', () => { if (q.value) renderSug(); });

  $('#reset-view').onclick = () => viewer.resetView();

  applyColor(); applyGhost(); syncExplode(viewer.explode); syncUI();

  return {
    enter() { root.hidden = false; viewer.setGhost(cfg.ghost, cfg.strength); applyColor(); syncExplode(viewer.explode); syncUI(); if (selected) { select(selected, { focus: false }); } },
    leave() { root.hidden = true; info.hidden = true; },
    select,
  };
}
