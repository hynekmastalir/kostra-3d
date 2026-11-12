import { esc } from './ui.js';

/* Taneční skupina: 2 až 6 kostlivců tančí společně. Sestava je sled částí, každá má formaci (řada, véčko, kruh…),
   způsob (unisono, kánon, zrcadlo) a délku v dobách. Mezi formacemi dochází k plynulému přechodu. */
const SP = 54;
const FORMS = {
  line: { label: 'Řada', at: (i, n) => { const c = (n - 1) / 2; return [(i - c) * SP, 0, 0]; } },
  vee: { label: 'Véčko', at: (i, n) => { const c = (n - 1) / 2; return [(i - c) * SP * 0.85, -Math.abs(i - c) * SP * 0.75, 0]; } },
  circle: { label: 'Kruh', at: (i, n) => { const R = Math.max(78, (n * SP) / (2 * Math.PI) * 1.25), a = (i / n) * Math.PI * 2, x = Math.sin(a) * R, z = Math.cos(a) * R; return [x, z - R * 0.2, Math.atan2(-x, -z) * 180 / Math.PI]; } },
  rows: { label: 'Dvě řady', at: (i, n) => { const per = Math.ceil(n / 2), row = i < per ? 0 : 1, k = row ? i - per : i, cnt = row ? n - per : per, c = (cnt - 1) / 2; return [(k - c) * SP * 1.1, row ? -48 : 40, 0]; } },
  diag: { label: 'Schody', at: (i, n) => { const c = (n - 1) / 2; return [(i - c) * SP * 0.8, (c - i) * SP * 0.7 * -1, 0]; } },
  zig: { label: 'Cikcak', at: (i, n) => { const c = (n - 1) / 2; return [(i - c) * SP * 0.8, i % 2 ? -34 : 34, 0]; } },
  cluster: { label: 'Skupinka', at: (i, n) => { const a = (i / n) * Math.PI * 2 + 0.5, r = n === 1 ? 0 : 36; return [Math.sin(a) * r, Math.cos(a) * r * 0.8, 0]; } },
};
const MODES = { unison: 'Unisono', canon: 'Kánon (vlna)', mirror: 'Zrcadlo', both: 'Kánon + zrcadlo' };
const seg = (f, mode, beats) => ({ f, mode, beats });
const PRESETS = {
  'Show: velká choreografie': [seg('line', 'unison', 8), seg('vee', 'canon', 8), seg('circle', 'unison', 8), seg('rows', 'mirror', 8), seg('diag', 'canon', 8), seg('zig', 'both', 8), seg('line', 'unison', 8)],
  'Vlna': [seg('line', 'canon', 8), seg('vee', 'canon', 8)],
  'Zrcadlo a kruh': [seg('line', 'mirror', 8), seg('circle', 'mirror', 8), seg('cluster', 'unison', 8)],
  'Řada v unisonu': [seg('line', 'unison', 8)],
  'Kánon v kruhu': [seg('circle', 'canon', 16)],
};
const TINTS = ['#f59e0b', '#38bdf8', '#a78bfa', '#4ade80', '#fb7185'];
const lerp = (a, b, k) => a + (b - a) * k;
const angLerp = (a, b, k) => a + ((((b - a + 180) % 360) + 360) % 360 - 180) * k;

export function createGroup(core) {
  const { DANCES, THREE, viewer, music, blank, mix, sm, store } = core;
  let el, rigs = [], shadows = [], st = null, segs = PRESETS['Show: velká choreografie'].map(s => ({ ...s })), N = 4;
  const $ = s => el.querySelector(s);
  const opts = () => Object.entries(DANCES).filter(([, d]) => d.group !== 'custom').map(([id, d]) => `<option value="${id}">${d.emoji} ${esc(d.name)}</option>`).join('');
  const mirrorPose = p => core.mirror ? core.mirror(p) : p;

  function build(n) {
    teardown();
    rigs = [core.rig];
    for (let i = 1; i < n; i++) rigs.push(core.cloneRig(TINTS[(i - 1) % TINTS.length]));
    shadows = [core.shadow];
    for (let i = 1; i < n; i++) { const s = new THREE.Mesh(core.shadow.geometry, core.shadow.material.clone()); s.rotation.x = -Math.PI / 2; s.renderOrder = -1; viewer.scene.add(s); shadows.push(s); }
  }
  function teardown() {
    for (let i = 1; i < rigs.length; i++) rigs[i].dispose();
    for (let i = 1; i < shadows.length; i++) { viewer.scene.remove(shadows[i]); shadows[i].material.dispose(); }
    rigs = []; shadows = [];
    if (core.stage) core.stage.scale.setScalar(1);
  }
  function frameGroup() {
    let ext = 80;
    for (const s of segs) for (let i = 0; i < N; i++) { const [x, z] = FORMS[s.f].at(i, N); ext = Math.max(ext, Math.abs(x) + 50, Math.abs(z) * 0.6 + 50); }
    const c = core.rig.P.center, tanV = Math.tan(THREE.MathUtils.degToRad(viewer.camera.fov / 2)), asp = viewer.camera.aspect;
    const dist = Math.max(160 / tanV, (ext * 2) / (tanV * asp)) * 1.02 + Math.abs(ext) * 0.1;
    viewer._flyTo(new THREE.Vector3(0, c.y + 35 + dist * 0.38, c.z + dist * 0.92), new THREE.Vector3(0, c.y - 5, c.z), 800);
    core.stage.scale.setScalar(Math.max(1, ext / 70));
  }
  function start() {
    if (!segs.length) return;
    core.stopDance(); N = +$('#gr-n').value; build(N);
    const A = $('#gr-a').value, B = $('#gr-two').checked ? $('#gr-b').value : A, dA = DANCES[A];
    core.stage.material.color.set(dA.color);
    const delay = core.mcfg.on ? music.start(dA.song, 1) : 0, now = performance.now() / 1000;
    st = { A, B, startAt: now + delay, lastSec: now, playT: 0, seg: -1 };
    $('#gr-go').disabled = true; $('#gr-stop').disabled = false;
    frameGroup(); viewer.requestRender();
  }
  function stop() {
    music.stop(0.4); core.setBadge(''); st = null;
    $('#gr-go').disabled = false; $('#gr-stop').disabled = true;
    for (let i = 0; i < rigs.length; i++) { const [x, z, ry] = FORMS.line.at(i, rigs.length); core.applyRig(rigs[i], { ...blank(), tx: x, ry: 0 }, 0); }
    viewer.requestRender();
  }
  // vlastnosti části: poloha tanečníka, zpoždění v dobách, zrcadlení
  const segInfo = (s, i, n) => { const [x, z, ry] = FORMS[s.f].at(i, n); return { x, z, ry, delay: (s.mode === 'canon' || s.mode === 'both') ? i * 1 : 0, mir: (s.mode === 'mirror' || s.mode === 'both') ? (i % 2) : 0 }; };

  function onFrame(now) {
    if (!st) return undefined;
    const sec = now / 1000;
    if (sec >= st.startAt) st.playT += Math.min(0.1, sec - Math.max(st.lastSec, st.startAt));
    st.lastSec = sec;
    const dA = DANCES[st.A], dB = DANCES[st.B], u = st.playT / dA.B, total = segs.reduce((s, x) => s + x.beats, 0), uu = ((u % total) + total) % total;
    let k = 0, acc = 0; while (k < segs.length - 1 && uu >= acc + segs[k].beats) { acc += segs[k].beats; k++; }
    const prev = segs[(k - 1 + segs.length) % segs.length], cur = segs[k], s = sm(0, 2, uu - acc);
    for (let i = 0; i < rigs.length; i++) {
      const a = segInfo(prev, i, rigs.length), b = segInfo(cur, i, rigs.length);
      const x = lerp(a.x, b.x, s), z = lerp(a.z, b.z, s), ry = angLerp(a.ry, b.ry, s), delay = lerp(a.delay, b.delay, s), mir = lerp(a.mir, b.mir, s);
      const d = (st.A !== st.B && i % 2) ? dB : dA, scale = d === dA ? 1 : dB.bpm / dA.bpm;
      const t = (st.playT - delay * dA.B) * scale, tt = ((t % d.period) + d.period) % d.period;
      let p = { ...blank(), ...d.pose(tt) };
      if (mir > 0.001) p = mir >= 0.999 ? core.mirror(p) : mix(p, core.mirror(p), mir);
      p.tx += x; p.tz += z; p.ry = (p.ry || 0) + ry;
      core.applyRig(rigs[i], p, 0);
      const c = core.rig.P.center;
      shadows[i].position.set(c.x + p.tx, core.shadow.position.y, c.z + p.tz); shadows[i].scale.setScalar(1 / (1 + Math.max(0, p.ty) / 60));
    }
    if (k !== st.seg) { st.seg = k; core.setBadge(`${k + 1}/${segs.length} · ${FORMS[cur.f].label}, ${MODES[cur.mode]}`, dA.color); }
    return true;
  }

  function renderSegs() {
    $('#gr-segs').innerHTML = segs.map((s, k) => `<li><span class="muted small">${k + 1}</span>
      <select data-k="${k}" data-p="f" aria-label="Formace">${Object.entries(FORMS).map(([id, f]) => `<option value="${id}"${id === s.f ? ' selected' : ''}>${f.label}</option>`).join('')}</select>
      <select data-k="${k}" data-p="mode" aria-label="Způsob">${Object.entries(MODES).map(([id, n]) => `<option value="${id}"${id === s.mode ? ' selected' : ''}>${n}</option>`).join('')}</select>
      <select data-k="${k}" data-p="beats" aria-label="Délka">${[4, 8, 16].map(b => `<option value="${b}"${b === s.beats ? ' selected' : ''}>${b} dob</option>`).join('')}</select>
      <button type="button" class="icon-sm" data-rm="${k}" aria-label="Odebrat">✕</button></li>`).join('') || '<li class="muted">Žádné části.</li>';
  }
  function renderSaved() {
    const l = store.get('groupChoreos', []);
    $('#gr-saved').innerHTML = l.length ? l.map((c, k) => `<li><span class="grow">${esc(c.name)}</span><button type="button" class="btn small" data-load="${k}">Načíst</button><button type="button" class="icon-sm" data-del="${k}" aria-label="Smazat">🗑</button></li>`).join('') : '<li class="muted">Žádné uložené.</li>';
  }

  return {
    id: 'group', label: '👯 Skupina',
    mount(e) {
      el = e;
      el.innerHTML = `<p class="muted small">Víc kostlivců tančí společně. Sestava se skládá z částí, každá má formaci, způsob a délku. Mezi formacemi se kostlivci plynule přesouvají.</p>
        <label class="field"><span>Tanec</span><select id="gr-a">${opts()}</select></label>
        <label class="check"><input type="checkbox" id="gr-two"><span>Druhý tanec pro každého druhého tanečníka</span></label>
        <label class="field" id="gr-bw" hidden><span>Druhý tanec</span><select id="gr-b">${opts()}</select></label>
        <label class="field"><span>Počet tanečníků: <b id="gr-nv">4</b></span><input type="range" id="gr-n" min="2" max="6" step="1" value="4"></label>
        <label class="field"><span>Hotová choreografie</span><select id="gr-pre">${Object.keys(PRESETS).map(n => `<option>${esc(n)}</option>`).join('')}</select></label>
        <h3 class="dgroup">Části sestavy</h3><ol class="cp-list" id="gr-segs"></ol>
        <div class="row"><button class="btn small" id="gr-add" type="button">＋ Přidat část</button></div>
        <div class="row" style="margin-top:10px"><button class="btn primary grow" id="gr-go" type="button">👯 Spustit</button><button class="btn" id="gr-stop" type="button" disabled>Zastavit</button></div>
        <div class="row" style="margin-top:8px"><input type="text" id="gr-name" placeholder="Název choreografie" maxlength="40"><button class="btn" id="gr-save" type="button">💾 Uložit</button></div>
        <h3 class="dgroup">Uložené</h3><ul class="cp-list" id="gr-saved"></ul>`;
      $('#gr-a').value = 'hiphop'; $('#gr-b').value = 'popping';
      $('#gr-two').onchange = ev => { $('#gr-bw').hidden = !ev.target.checked; };
      $('#gr-n').oninput = ev => { $('#gr-nv').textContent = ev.target.value; };
      $('#gr-pre').onchange = ev => { segs = PRESETS[ev.target.value].map(s => ({ ...s })); renderSegs(); };
      $('#gr-add').onclick = () => { segs.push(seg('line', 'unison', 8)); renderSegs(); };
      $('#gr-go').onclick = start; $('#gr-stop').onclick = stop;
      $('#gr-segs').addEventListener('change', ev => { const t = ev.target; if (t.dataset.k === undefined) return; const s = segs[+t.dataset.k]; s[t.dataset.p] = t.dataset.p === 'beats' ? +t.value : t.value; });
      el.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return; const d = b.dataset;
        if (d.rm !== undefined && b.closest('#gr-segs')) { segs.splice(+d.rm, 1); renderSegs(); }
        else if (d.load) { const c = store.get('groupChoreos', [])[+d.load]; if (c) { segs = c.segs.map(s => ({ ...s })); $('#gr-name').value = c.name; renderSegs(); } }
        else if (d.del) { const l = store.get('groupChoreos', []); l.splice(+d.del, 1); store.set('groupChoreos', l); renderSaved(); }
      });
      $('#gr-save').onclick = () => { if (!segs.length) return; const l = store.get('groupChoreos', []); l.push({ name: $('#gr-name').value.trim() || `Choreografie ${l.length + 1}`, segs }); store.set('groupChoreos', l.slice(-20)); renderSaved(); };
      renderSegs(); renderSaved();
    },
    leave() { if (st) { music.stop(0.2); core.setBadge(''); st = null; } teardown(); $('#gr-go').disabled = false; $('#gr-stop').disabled = true; },
    onFrame, get state() { return st; },
    cleanup() { st = null; teardown(); },
  };
}
