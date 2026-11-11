import { esc } from './ui.js';

/* Rytmická hra: noty padají v rytmu hudby, ťukáš do tří drah (kopák, snare, ozdoby). Kostlivec tančí podle toho, jak ti to jde. */
const FALL = 1.6, GOOD = 0.12, PERFECT = 0.07, OK = 0.18, LOOPS = 3;
const LANES = [{ key: 'Kopák', color: '#3b82f6', keys: ['a', 'ArrowLeft'] }, { key: 'Snare', color: '#ef4444', keys: ['s', 'ArrowDown'] }, { key: 'Ozdoba', color: '#facc15', keys: ['d', 'ArrowRight'] }];
const hype = u => {
  const s = Math.sin(Math.PI * u), d = 0.5 + 0.5 * Math.cos(Math.PI * 2 * u);
  return { kneeR: 16 + 12 * d, kneeL: 16 + 12 * d, hipFlexR: 10 + 8 * d, hipFlexL: 10 + 8 * d, lean: 6, hNod: 5 * d, flexR: 70 + 8 * s, flexL: 70 - 8 * s, abdR: 16, abdL: 16, elbXR: 95, elbXL: 95 };
};

export function buildNotes(song, hard) {
  const dr = song.drums, stepDur = 60 / song.bpm / 4, notes = [], total = 16 * song.bars * LOOPS;
  const has = (n, i) => dr[n] && dr[n][i % 16] && dr[n][i % 16] !== '.';
  const secondLane = ['snare', 'clap'].some(n => dr[n]);
  for (let s = 0; s < total; s++) {
    const i = s % 16, t = s * stepDur + (s % 2 ? (song.swing || 0) * stepDur : 0);
    const k = has('kick', i), sn = has('snare', i) || has('clap', i), orn = has('cow', i) || has('ohat', i) || has('ghost', i);
    if (k) notes.push({ t, lane: 0 });
    if (sn) notes.push({ t, lane: 1 });
    else if (!secondLane && i % 8 === 4) notes.push({ t, lane: 1 });
    if (orn && !k && !sn) notes.push({ t, lane: 2 });
    else if (hard && has('hat', i) && i % 4 === 2 && !k && !sn) notes.push({ t, lane: 2 });
    else if (hard && !orn && has('shaker', i) && i % 8 === 6 && !k && !sn) notes.push({ t, lane: 2 });
  }
  return { notes, stepDur, end: total * stepDur };
}

export function createRhythm(core) {
  const { DANCES, SONGS, music, blank, mix, store } = core;
  let el, ov = null, st = null, dance = null;
  const $ = s => el.querySelector(s);
  const opts = () => Object.entries(DANCES).filter(([, d]) => d.group !== 'custom').map(([id, d]) => `<option value="${id}">${d.emoji} ${esc(d.name)} · ${SONGS[d.song].bpm | 0} BPM</option>`).join('');

  function buildOverlay() {
    ov = document.createElement('div'); ov.id = 'rhythm'; ov.hidden = true;
    ov.innerHTML = `<div id="rh-hud"><b id="rh-score">0</b><span id="rh-combo"></span></div><div id="rh-msg"></div>
      <div id="rh-lanes">${LANES.map((l, i) => `<div class="rh-lane" data-l="${i}" style="--c:${l.color}"><div class="rh-line"></div><button type="button" class="rh-pad" data-l="${i}" aria-label="${l.key}">${l.key}<small>${l.keys[0].toUpperCase()}</small></button></div>`).join('')}</div>
      <div id="rh-end" hidden></div>`;
    document.querySelector('#stage').appendChild(ov);
    const lanes = ov.querySelector('#rh-lanes');
    lanes.addEventListener('pointerdown', e => { const l = e.target.closest('[data-l]'); if (l) { e.preventDefault(); tap(+l.dataset.l); } });
  }
  function msg(text, color) {
    const m = ov.querySelector('#rh-msg'); m.textContent = text; m.style.color = color; m.classList.remove('pop'); void m.offsetWidth; m.classList.add('pop');
  }
  function onKey(e) {
    if (!st || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, l = LANES.findIndex(x => x.keys.includes(k) || (k === 'j' && x === LANES[0]) || (k === 'k' && x === LANES[1]) || (k === 'l' && x === LANES[2]));
    if (l >= 0) { e.preventDefault(); if (!e.repeat) tap(l); }
  }
  function tap(l) {
    if (!st || performance.now() / 1000 < st.t0 - 0.3) return;
    const now = performance.now() / 1000 - st.t0, pad = ov.querySelectorAll('.rh-pad')[l]; pad.classList.add('hit'); setTimeout(() => pad.classList.remove('hit'), 90);
    let best = null;
    for (const n of st.notes) { if (n.lane !== l || n.done) continue; const d = Math.abs(n.t - now); if (d <= OK && (!best || d < best.d)) best = { n, d }; if (n.t - now > OK) break; }
    if (!best) { st.combo = 0; st.stumble = performance.now() / 1000; msg('Vedle', '#94a3b8'); updateHud(); return; }
    const n = best.n; n.done = true; n.el.style.display = 'none';
    const kind = best.d <= PERFECT ? 'p' : best.d <= GOOD ? 'g' : 'o', base = { p: 300, g: 150, o: 50 }[kind];
    st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo); st.hits[kind]++;
    st.score += Math.round(base * (1 + Math.min(4, Math.floor(st.combo / 10)) * 0.25));
    msg(kind === 'p' ? 'Perfektní!' : kind === 'g' ? 'Dobře' : 'Skoro', kind === 'p' ? '#4ade80' : kind === 'g' ? '#60a5fa' : '#fbbf24'); updateHud();
  }
  function updateHud() { ov.querySelector('#rh-score').textContent = st.score; ov.querySelector('#rh-combo').textContent = st.combo > 1 ? `${st.combo}× combo` : ''; }
  function start() {
    core.stopDance();
    const id = $('#rh-song').value, d = DANCES[id], song = SONGS[d.song], hard = $('#rh-diff').value === 'hard';
    const { notes, end } = buildNotes(song, hard);
    const lanes = ov.querySelector('#rh-lanes');
    lanes.querySelectorAll('.note').forEach(n => n.remove());
    for (const n of notes) { n.el = document.createElement('i'); n.el.className = 'note'; n.el.style.setProperty('--c', LANES[n.lane].color); n.el.style.display = 'none'; lanes.children[n.lane].appendChild(n.el); }
    const delay = core.mcfg.on ? music.start(d.song, 1) : 0, now = performance.now() / 1000;
    st = { id, d, hard, notes, end, t0: now + delay, lastMiss: 0, score: 0, combo: 0, maxCombo: 0, hits: { p: 0, g: 0, o: 0 }, miss: 0, stumble: -9, playT: 0, lastSec: now, w: 0 };
    ov.hidden = false; ov.querySelector('#rh-end').hidden = true; updateHud(); msg('', ''); core.stage.material.color.set(d.color);
    $('#rh-go').disabled = true; $('#rh-stop').disabled = false;
    core.viewer.requestRender();
  }
  function finish() {
    const s = st; music.stop(0.6); st = null;
    const total = s.notes.length, acc = total ? (s.hits.p * 1 + s.hits.g * 0.6 + s.hits.o * 0.25) / total : 0;
    const rank = acc > 0.92 ? 'S' : acc > 0.8 ? 'A' : acc > 0.62 ? 'B' : acc > 0.4 ? 'C' : 'D';
    const key = s.id + (s.hard ? '-h' : '-e'), best = store.get('rhythmBest', {}), prev = best[key] || 0;
    if (s.score > prev) { best[key] = s.score; store.set('rhythmBest', best); }
    const e = ov.querySelector('#rh-end'); e.hidden = false;
    e.innerHTML = `<div class="rh-card"><div class="rh-rank">${rank}</div><p><b>${s.score}</b> bodů${s.score > prev ? ' · nový rekord!' : ` · rekord ${prev}`}</p><p class="muted small">Perfektní ${s.hits.p}, dobře ${s.hits.g}, skoro ${s.hits.o}, vedle ${s.miss} · nejdelší combo ${s.maxCombo}×</p><button class="btn primary" type="button" id="rh-again">Znovu</button></div>`;
    e.querySelector('#rh-again').onclick = start;
    $('#rh-go').disabled = false; $('#rh-stop').disabled = true; core.setBadge('');
    core.applyRig(core.rig, blank(), 0);
  }
  function onFrame(now) {
    if (!st) return undefined;
    const sec = now / 1000, t = sec - st.t0;
    st.playT = Math.max(0, t);
    // zmeškané noty
    for (const n of st.notes) { if (!n.done && t - n.t > OK) { n.done = true; n.el.style.display = 'none'; st.combo = 0; st.miss++; st.stumble = sec; msg('Vedle', '#f87171'); updateHud(); } if (n.t - t > FALL) break; }
    // pozice not
    const h = ov.querySelector('#rh-lanes').clientHeight, line = h * 0.8;
    for (const n of st.notes) {
      const dt = n.t - t;
      if (n.done) continue;
      if (dt > FALL) break;
      n.el.style.display = ''; n.el.style.transform = `translateY(${(line * (1 - dt / FALL)).toFixed(1)}px)`;
    }
    // tanec: čím delší combo, tím plnější tanec
    const d = st.d, tt = ((st.playT % d.period) + d.period) % d.period, wt = Math.min(1, st.combo / 8);
    st.w += (wt - st.w) * 0.08;
    const p = mix({ ...blank(), ...hype(st.playT / d.B) }, { ...blank(), ...d.pose(tt) }, st.w);
    const e = Math.exp(-Math.max(0, sec - st.stumble) * 5) * (sec - st.stumble < 1 ? 1 : 0);
    if (e > 0.01) { p.lean = (p.lean || 0) + 28 * e; p.roll = (p.roll || 0) + 12 * e * Math.sin(sec * 40); p.hNod = (p.hNod || 0) + 20 * e; p.flexR = (p.flexR || 0) - 30 * e; p.flexL = (p.flexL || 0) - 30 * e; }
    core.apply(p);
    if (t >= st.end + 1.2) { finish(); return false; }
    return true;
  }

  return {
    id: 'rhythm', label: '🎯 Rytmus',
    mount(e) {
      el = e;
      el.innerHTML = `<p class="muted small">Noty padají z hora. Klepni do dráhy (nebo klávesy A, S, D) ve chvíli, kdy dopadnou na čáru. Čím víc trefíš za sebou, tím lépe kostlivec tančí.</p>
        <label class="field"><span>Skladba</span><select id="rh-song">${opts()}</select></label>
        <label class="field"><span>Obtížnost</span><select id="rh-diff"><option value="easy">Lehká</option><option value="hard">Těžká</option></select></label>
        <div class="row"><button class="btn primary grow" id="rh-go" type="button">🎯 Hrát</button><button class="btn" id="rh-stop" type="button" disabled>Zastavit</button></div>
        <p class="muted small" id="rh-best"></p>`;
      $('#rh-song').value = 'hiphop';
      $('#rh-go').onclick = start; $('#rh-stop').onclick = () => { music.stop(0.3); st = null; ov.hidden = true; $('#rh-go').disabled = false; $('#rh-stop').disabled = true; core.applyRig(core.rig, blank(), 0); };
      const showBest = () => { const b = store.get('rhythmBest', {}), k = $('#rh-song').value + ($('#rh-diff').value === 'hard' ? '-h' : '-e'); $('#rh-best').textContent = b[k] ? `Tvůj rekord: ${b[k]} bodů` : ''; };
      $('#rh-song').onchange = showBest; $('#rh-diff').onchange = showBest; showBest();
      buildOverlay();
    },
    enter() { document.addEventListener('keydown', onKey); },
    leave() {
      document.removeEventListener('keydown', onKey);
      if (st) { music.stop(0.2); st = null; }
      ov.hidden = true; $('#rh-go').disabled = false; $('#rh-stop').disabled = true;
    },
    onFrame, get state() { return st; },
    cleanup() { if (ov) ov.hidden = true; st = null; document.removeEventListener('keydown', onKey); },
  };
}
