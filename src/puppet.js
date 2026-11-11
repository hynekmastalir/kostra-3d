import { KEYS } from './choreo.js';

/* Hravá kostra: kosti se dají tahat myší nebo prstem, klepnutím strkat a celou kostru chytit za pánev, zvednout a pustit.
   Úhly kloubů jsou pružiny s tlumením, takže se končetiny po puštění rozhoupají a vrátí. Při tvrdém dopadu se kostra rozsype. */
const FIXED = new Set(['tx', 'tz', 'ty', 'fz', 'rx', 'ry', 'rz', 'sp']);
const SPRING = KEYS.filter(k => !FIXED.has(k));
const K = 130, C = 7.5, GRAV = 900;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export function createPuppet(core) {
  const { viewer, blank, THREE } = core;
  let el, pp = blank(), pv = {}, vy = 0, vx = 0, vz = 0, drag = null, last = 0, broken = false, on = false, pinned = new Set(), lastVals = {};
  const $ = s => el.querySelector(s);
  const reset = () => { pp = blank(); pv = {}; vy = vx = vz = 0; broken = false; };

  const segInfo = seg => { const m = /^(uarm|farm|hand|thigh|shank|foot)([RL])$/.exec(seg); return m ? { part: m[1], sd: m[2] } : { part: seg, sd: '' }; };
  const worldPerPx = () => { const cam = viewer.camera, dist = cam.position.distanceTo(viewer.controls.target); return (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * dist) / viewer.canvas.clientHeight; };

  // tažení: úhly kloubů podle posunu prstu od místa dotyku (dx, dy v pixelech)
  function setPin(k, v) { pp[k] = v; pv[k] = 0; pinned.add(k); }
  function dragTo(dx, dy) {
    const { part, sd } = drag.info, out = sd === 'R' ? -dx : dx;
    pinned.clear();
    if (part === 'uarm' || part === 'farm' || part === 'hand') {
      setPin('abd' + sd, clamp(drag.base['abd' + sd] - dy * 0.7, -30, 175));
      setPin('flex' + sd, clamp(drag.base['flex' + sd] + (sd === 'R' ? dx : -dx) * 0.4, -60, 170));
      if (part !== 'uarm') setPin('elbX' + sd, clamp(drag.base['elbX' + sd] - dy * 0.5, 0, 140));
    } else if (part === 'thigh' || part === 'shank' || part === 'foot') {
      setPin('hipAbd' + sd, clamp(drag.base['hipAbd' + sd] + out * 0.4, -12, 70));
      setPin('hipFlex' + sd, clamp(drag.base['hipFlex' + sd] - dy * 0.6, -30, 120));
      if (part !== 'thigh') setPin('knee' + sd, clamp(drag.base['knee' + sd] - dy * 0.5, 0, 130));
    } else if (part === 'head') {
      setPin('hTurn', clamp(dx * 0.4, -70, 70)); setPin('hNod', clamp(dy * 0.4, -40, 45)); setPin('hTilt', clamp(dx * 0.15, -30, 30));
    } else if (part === 'torso') {
      setPin('twist', clamp(dx * 0.3, -45, 45)); setPin('lean', clamp(drag.base.lean + dy * 0.35, -25, 70)); setPin('roll', clamp(dx * 0.1, -25, 25));
    } else if (part === 'pelvis') {
      const w = worldPerPx();
      pp.tx = clamp(drag.base.tx + dx * w, -130, 130); pp.ty = Math.max(0, drag.base.ty - dy * w); vy = 0;
    }
  }
  function poke(seg, side) {
    const { part, sd } = segInfo(seg), s = side >= 0 ? 1 : -1, r = () => (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6);
    if (part === 'uarm' || part === 'farm' || part === 'hand') { pv['abd' + sd] = (pv['abd' + sd] || 0) + 520; pv['flex' + sd] = (pv['flex' + sd] || 0) + 380 * r(); pv['elbX' + sd] = (pv['elbX' + sd] || 0) + 300; }
    else if (part === 'thigh' || part === 'shank' || part === 'foot') { pv['hipAbd' + sd] = (pv['hipAbd' + sd] || 0) + 260; pv['hipFlex' + sd] = (pv['hipFlex' + sd] || 0) + 360; pv['knee' + sd] = (pv['knee' + sd] || 0) + 300; }
    else if (part === 'head') { pv.hTurn = (pv.hTurn || 0) + 700 * r(); pv.hNod = (pv.hNod || 0) + 350; pv.hTilt = (pv.hTilt || 0) + 250 * r(); }
    else if (part === 'torso') { pv.roll = (pv.roll || 0) + 520 * s; pv.lean = (pv.lean || 0) + 320; pv.pRoll = (pv.pRoll || 0) - 200 * s; pv.abdR = (pv.abdR || 0) + 260; pv.abdL = (pv.abdL || 0) + 260; }
    else { vy = 330; pv.kneeR = (pv.kneeR || 0) - 120; pv.pRoll = (pv.pRoll || 0) + 300 * s; }
    viewer.requestRender();
  }

  function down(e) {
    if (!on || core.phys || e.button > 0) return;
    const id = viewer.pick(e.clientX, e.clientY); if (!id) return;
    if (broken) { reset(); }
    const seg = core.rig.seg[id]; viewer.controls.enabled = false;
    drag = { seg, info: segInfo(seg), x0: e.clientX, y0: e.clientY, t0: performance.now(), moved: false, base: { ...pp }, side: e.clientX - viewer.canvas.getBoundingClientRect().left - viewer.canvas.clientWidth / 2, px: e.clientX, py: e.clientY, pt: performance.now(), vxp: 0, vyp: 0 };
    lastVals = {}; viewer.requestRender();
  }
  function move(e) {
    if (!drag) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && dx * dx + dy * dy < 36) return;
    drag.moved = true;
    const now = performance.now(), dt = Math.max(1, now - drag.pt) / 1000;
    drag.vxp = 0.6 * drag.vxp + 0.4 * (e.clientX - drag.px) / dt; drag.vyp = 0.6 * drag.vyp + 0.4 * (e.clientY - drag.py) / dt; drag.px = e.clientX; drag.py = e.clientY; drag.pt = now;
    const before = { ...pp }; dragTo(dx, dy);
    for (const k of pinned) lastVals[k] = ((pp[k] - before[k]) / dt) * 0.5 + (lastVals[k] || 0) * 0.5;
    viewer.requestRender();
  }
  function up() {
    if (!drag) return;
    viewer.controls.enabled = true;
    const d = drag; drag = null;
    if (!d.moved) { if (performance.now() - d.t0 < 500) poke(d.seg, d.side); pinned.clear(); return; }
    for (const k of pinned) pv[k] = clamp(lastVals[k] || 0, -900, 900);     // setrvačnost při puštění
    if (d.info.part === 'pelvis') { const w = worldPerPx(); vx = clamp(d.vxp * w, -400, 400); vy = pp.ty > 0 ? clamp(-d.vyp * w, -400, 500) : 0; }
    pinned.clear(); viewer.requestRender();
  }

  function onFrame(now) {
    if (!on) return undefined;
    if (core.phys) { broken = true; return undefined; }
    const dt = Math.min(0.1, Math.max(0.001, (now - (last || now)) / 1000)); last = now;
    let energy = 0;
    const n = Math.max(2, Math.ceil(dt / 0.012));
    for (let s = 0; s < n; s++) {
      const h = dt / n;
      for (const k of SPRING) {
        if (pinned.has(k)) continue;
        const v = pv[k] || 0, a = -K * pp[k] - C * v;
        pv[k] = v + a * h; pp[k] = clamp(pp[k] + pv[k] * h, -180, 180);
        energy += Math.abs(pp[k]) + Math.abs(pv[k]) * 0.05;
      }
      if (!(drag && drag.info.part === 'pelvis' && drag.moved)) {
        // pád a odraz celého těla
        if (pp.ty > 0 || vy > 0) {
          vy -= GRAV * h; pp.ty += vy * h;
          if (pp.ty <= 0) {
            pp.ty = 0;
            const imp = -vy;
            if (imp > 360) { broken = true; core.scatter(); return true; }
            if (imp > 60) { for (const k of ['kneeR', 'kneeL']) pv[k] = (pv[k] || 0) + imp * 0.9; pv.hipFlexR = (pv.hipFlexR || 0) + imp * 0.5; pv.hipFlexL = (pv.hipFlexL || 0) + imp * 0.5; pv.lean = (pv.lean || 0) + imp * 0.4; pv.abdR = (pv.abdR || 0) + imp * 0.6; pv.abdL = (pv.abdL || 0) + imp * 0.6; }
            vy = imp > 120 ? imp * 0.15 : 0;
          }
        }
        pp.tx = clamp(pp.tx + vx * h, -130, 130); vx *= Math.pow(pp.ty > 0 ? 0.9 : 0.04, h);
        if (Math.abs(vx) < 0.5) vx = 0;
      }
    }
    energy += Math.abs(pp.ty) + Math.abs(vx) * 0.1 + Math.abs(vy) * 0.1;
    core.apply(pp);
    return !!drag || energy > 1.2;
  }

  return {
    id: 'puppet', label: '🎮 Fyzika',
    mount(e) {
      el = e;
      el.innerHTML = `<p class="muted small">Táhni za ruku, nohu, hlavu nebo trup a kosti se pohnou. Klepnutí kost šťouchne. Chyť pánev, zvedni kostru a pusť ji: z malé výšky dopadne na nohy, z velké se rozsype.</p>
        <div class="row"><button class="btn grow" id="pp-reset" type="button">↺ Postavit</button><button class="btn grow" id="pp-scatter" type="button">💥 Rozsypat</button><button class="btn grow" id="pp-assemble" type="button">🧩 Složit</button></div>
        <p class="muted small" id="pp-hint">Při tažení se otáčení kamery vypne, otáčet ji můžeš tahem do prázdného místa.</p>`;
      $('#pp-reset').onclick = () => { if (core.phys) return; reset(); core.apply(pp); viewer.requestRender(); };
      $('#pp-scatter').onclick = () => { if (core.phys) return; broken = true; core.scatter(); };
      $('#pp-assemble').onclick = () => { if (core.phys) { core.assemble(); } };
      const c = viewer.canvas;
      c.addEventListener('pointerdown', down, true);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    enter() { on = true; reset(); last = 0; core.apply(pp); },
    leave() { on = false; drag = null; pinned.clear(); viewer.controls.enabled = true; reset(); },
    onFrame,
    cleanup() { on = false; drag = null; viewer.controls.enabled = true; },
  };
}
