import * as THREE from 'three';
import { bones } from './data.js';
import { $, esc } from './ui.js';
import { DANCES, KEYS, SIDES, blank, mix, mirror } from './choreo.js';
import { createMusic, SONGS } from './music.js';
import { store } from './storage.js';
import { createFun } from './fun.js';

/* Tanec kostry.
   Model se skládá z 203 pevných kostí, proto vznikne „kostra v kostře“: kosti se rozdělí do segmentů
   (pánev, trup, hlava, paže a nohy po třech článcích) a segmenty se otáčejí kolem kloubů. Klouby se
   spočítají z tvaru kostí (hlavice stehenní kosti, kolenní plocha holeně apod.). Pohyb je dopředná kinematika:
   matice segmentu = matice rodiče x posun do kloubu x otočení x posun zpět. */

const D2R = Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ---------- segmenty a klouby ---------- */
function segmentOf(b) {
  const sd = b.side === 'pravá' ? 'R' : b.side === 'levá' ? 'L' : '';
  switch (b.group) {
    case 'lebka': return 'head';
    case 'pater': return b.la === 'atlas' ? 'head' : b.la === 'os sacrum' ? 'pelvis' : 'torso';
    case 'hrudnik': return 'torso';
    case 'panev': return 'pelvis';
    case 'horni':
      if (b.la === 'clavicula' || b.la === 'scapula') return 'torso';
      if (b.la === 'humerus') return 'uarm' + sd;
      if (b.la === 'radius' || b.la === 'ulna') return 'farm' + sd;
      return 'hand' + sd;
    default:
      if (b.la === 'femur' || b.la === 'patella') return 'thigh' + sd;
      if (b.la === 'tibia' || b.la === 'fibula') return 'shank' + sd;
      return 'foot' + sd;
  }
}

// střed vrcholů v pásu u horního nebo dolního konce kosti
function bandCentroid(mesh, end, frac) {
  const bb = mesh.geometry.boundingBox, a = mesh.geometry.attributes.position;
  const h = bb.max.y - bb.min.y, lim = end === 'top' ? bb.max.y - h * frac : bb.min.y + h * frac;
  let x = 0, z = 0, n = 0;
  for (let i = 0; i < a.count; i++) {
    const y = a.getY(i);
    if (end === 'top' ? y >= lim : y <= lim) { x += a.getX(i); z += a.getZ(i); n++; }
  }
  return n ? new THREE.Vector2(x / n, z / n) : new THREE.Vector2((bb.min.x + bb.max.x) / 2, (bb.min.z + bb.max.z) / 2);
}

export function buildRig(meshes) {
  const key = (la, side) => `${la}|${side}`;
  const byKey = new Map(bones.map(b => [key(b.la, b.side), b]));
  const mesh = (la, side) => meshes.get(byKey.get(key(la, side)).id);
  const seg = {}; const segMeshes = {};
  for (const b of bones) { const s = segmentOf(b); (segMeshes[s] ??= []).push(meshes.get(b.id)); seg[b.id] = s; }

  const P = {};
  for (const [sd, name, sg] of [['R', 'pravá', -1], ['L', 'levá', 1]]) {
    const fem = mesh('femur', name).geometry.boundingBox, tib = mesh('tibia', name), hum = mesh('humerus', name), rad = mesh('radius', name);
    const medFem = sd === 'R' ? fem.max.x : fem.min.x;
    P['hip' + sd] = new THREE.Vector3(medFem + sg * 2.4, fem.max.y - 3.0, (fem.min.z + fem.max.z) / 2);
    const tb = tib.geometry.boundingBox, kc = bandCentroid(tib, 'top', 0.08);
    P['knee' + sd] = new THREE.Vector3(kc.x, tb.max.y - 0.5, kc.y);
    const ac = bandCentroid(tib, 'bottom', 0.08);
    P['ankle' + sd] = new THREE.Vector3(ac.x, tb.min.y + 1.0, ac.y);
    const hb = hum.geometry.boundingBox, medHum = sd === 'R' ? hb.max.x : hb.min.x;
    P['shoulder' + sd] = new THREE.Vector3(medHum + sg * 2.3, hb.max.y - 2.3, (hb.min.z + hb.max.z) / 2);
    const ec = bandCentroid(hum, 'bottom', 0.1);
    P['elbow' + sd] = new THREE.Vector3(ec.x, hb.min.y + 1.0, ec.y);
    const rb = rad.geometry.boundingBox, wc = bandCentroid(rad, 'bottom', 0.1);
    P['wrist' + sd] = new THREE.Vector3(wc.x, rb.min.y + 1.0, wc.y);
  }
  const sac = mesh('os sacrum', 'střední').geometry.boundingBox, atl = mesh('atlas', 'střední').geometry.boundingBox;
  P.waist = new THREE.Vector3(0, sac.max.y - 1.0, (sac.min.z + sac.max.z) / 2);
  P.neck = new THREE.Vector3(0, (atl.min.y + atl.max.y) / 2, (atl.min.z + atl.max.z) / 2);
  P.center = new THREE.Vector3(0, (P.hipR.y + P.hipL.y) / 2, (P.hipR.z + P.hipL.z) / 2);

  // země: nejnižší bod chodidel v klidové pozici
  let groundY = Infinity;
  for (const [sname, list] of Object.entries(segMeshes)) if (sname.startsWith('foot')) for (const m of list) groundY = Math.min(groundY, m.geometry.boundingBox.min.y);
  P.chest = new THREE.Vector3(0, (P.shoulderR.y + P.waist.y) / 2, (P.shoulderR.z + P.waist.z) / 2);

  // kontaktní body: u každého segmentu krajní vrcholy v 26 směrech; nejnižší bod celého těla se drží země
  // (nohy, ruce při 6-stepu, hlava při headspinu, záda při windmillu)
  const dirs = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) dirs.push(new THREE.Vector3(x, y, z).normalize());
  const contact = {};
  for (const [sname, list] of Object.entries(segMeshes)) {
    const best = dirs.map(() => -Infinity), pts = dirs.map(() => new THREE.Vector3());
    for (const m of list) {
      const a = m.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        const x = a.getX(i), y = a.getY(i), z = a.getZ(i);
        for (let d = 0; d < dirs.length; d++) { const dot = x * dirs[d].x + y * dirs[d].y + z * dirs[d].z; if (dot > best[d]) { best[d] = dot; pts[d].set(x, y, z); } }
      }
    }
    contact[sname] = pts;
  }
  return { P, segMeshes, contact, groundY, seg };
}

/* ---------- pózy (choreografie jsou v choreo.js) ---------- */
const PI2 = Math.PI * 2;

/* ---------- animátor ---------- */
export function createDance(ctx) {
  const { viewer } = ctx;
  const root = $('#view-dance');
  const music = createMusic();
  const mcfg = Object.assign({ on: true, vol: 0.8 }, store.get('danceMusic', {}));
  music.setEnabled(mcfg.on); music.setVolume(mcfg.vol);
  let rig = null, current = null, startAt = 0, playT = 0, lastSec = 0, speed = 1, blendStart = 0, active = false, stage = null, shadow = null;
  let part = null;                      // aktivní rozšiřující část (bitva, rytmus…); null = běžné tance
  let shown = blank(), blendFrom = blank(), hold = null, phraseShown = '';      // hold: ladicí podržení jedné pózy
  const REST = blank();

  const btn = (id, d) => `<button class="dance-btn" type="button" data-d="${id}" aria-pressed="false"><span class="em" aria-hidden="true">${d.emoji}</span><span>${esc(d.name)}</span></button>`;
  root.innerHTML = `
    <p class="muted small">Vyber tanec. Kostru můžeš při tanci otáčet a přibližovat.</p>
    <h3 class="dgroup">Základní pohyby</h3>
    <div class="dances" id="dances">${Object.entries(DANCES).filter(([, d]) => d.group === 'basic').map(([id, d]) => btn(id, d)).join('')}</div>
    <h3 class="dgroup">Street dance styly</h3>
    <div class="dances street" id="dances-street">${Object.entries(DANCES).filter(([, d]) => d.group === 'street').map(([id, d]) => btn(id, d)).join('')}</div>
    <h3 class="dgroup">Populární tance</h3>
    <div class="dances street" id="dances-pop">${Object.entries(DANCES).filter(([, d]) => d.group === 'pop').map(([id, d]) => btn(id, d)).join('')}</div>
    <div class="dance-info" id="dance-info" hidden></div>
    <div class="row music-row"><label class="check grow"><input type="checkbox" id="dance-music" ${mcfg.on ? 'checked' : ''}><span>🎵 Hudba k tanci</span></label><input type="range" id="dance-vol" min="0" max="100" value="${Math.round(mcfg.vol * 100)}" aria-label="Hlasitost" style="max-width:140px"></div>
    <label class="field"><span>Rychlost: <b id="dance-speed-val">100 %</b></span><input type="range" id="dance-speed" min="50" max="160" step="5" value="100"></label>
    <button class="btn block" type="button" id="dance-stop" disabled>Zastavit a postavit se</button>
    <div class="row scatter-row">
      <button class="btn grow" type="button" id="dance-scatter">💥 Rozsypat</button>
      <button class="btn grow" type="button" id="dance-assemble" disabled>🧩 Složit</button>
    </div>
    <p class="muted small" id="dance-hint">Rozsypání: kosti se uvolní, spadnou a zůstanou ležet na zemi. Složit je zase přivolá zpátky.</p>`;

  const baseHTML = root.innerHTML;
  root.innerHTML = `<div class="seg fun-tabs" id="fun-tabs"></div><div id="sec-tance" class="fun-sec">${baseHTML}</div>`;

  const mat = new THREE.Matrix4(), tmpA = new THREE.Matrix4(), tmpB = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0), AZ = new THREE.Vector3(0, 0, 1);
  const qa = (axis, deg) => new THREE.Quaternion().setFromAxisAngle(axis, deg * D2R);
  const euler = (x, y, z) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x * D2R, y * D2R, z * D2R, 'YXZ'));

  // matice segmentu: rodič x T(pivot) x R x T(-pivot)
  function pivotM(parent, pivot, quat) {
    tmpA.makeTranslation(pivot.x, pivot.y, pivot.z);
    tmpB.makeRotationFromQuaternion(quat);
    const out = new THREE.Matrix4().multiplyMatrices(parent, tmpA).multiply(tmpB);
    tmpA.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
    return out.multiply(tmpA);
  }

  function limbs(parentPelvis, p, r) {
    const M = {}; const P = r.P;
    for (const sd of SIDES) {
      const sg = sd === 'R' ? -1 : 1;
      M['thigh' + sd] = pivotM(parentPelvis, P['hip' + sd], qa(AZ, sg * p['hipAbd' + sd]).multiply(qa(AX, -p['hipFlex' + sd])).multiply(qa(AY, p['hipTw' + sd])));
      M['shank' + sd] = pivotM(M['thigh' + sd], P['knee' + sd], qa(AX, p['knee' + sd]));
      M['foot' + sd] = pivotM(M['shank' + sd], P['ankle' + sd], qa(AX, -p['ankle' + sd]));
    }
    return M;
  }

  // vodorovný bod, kolem kterého se tělo otáčí: -1 pravé chodidlo, 0 střed pánve, 1 levé chodidlo, 2 horní část zad
  function spinPoint(sp, r = rig) {
    const P = r.P; sp = Math.max(-1, Math.min(2, sp)); let a, b, k;
    if (sp <= 0) { a = P.ankleR; b = P.center; k = sp + 1; } else if (sp <= 1) { a = P.center; b = P.ankleL; k = sp; } else { a = P.ankleL; b = P.chest; k = sp - 1; }
    return [a.x + (b.x - a.x) * k, a.z + (b.z - a.z) * k];
  }

  function compute(p, r = rig) {
    const P = r.P;
    // kořen: náklon a předklon kolem středu pánve, pak otočení kolem svislé osy a posun (výška se doplní podle země)
    const [px, pz] = spinPoint(p.sp, r);
    const root = new THREE.Matrix4().makeTranslation(p.tx, 0, p.tz);
    root.multiply(tmpA.makeTranslation(px, 0, pz)).multiply(tmpB.makeRotationY(p.ry * D2R)).multiply(tmpA.makeTranslation(-px, 0, -pz));
    root.multiply(tmpA.makeTranslation(P.center.x, P.center.y, P.center.z)).multiply(tmpB.makeRotationFromQuaternion(euler(p.rx, 0, p.rz)));
    root.multiply(tmpA.makeTranslation(-P.center.x, -P.center.y, -P.center.z));
    const pel = pivotM(root, P.center, euler(p.pTilt, p.pTwist, p.pRoll));
    const M = { pelvis: pel, ...limbs(pel, p, r) };
    M.torso = pivotM(pel, P.waist, euler(p.lean, p.twist, p.roll));
    M.head = pivotM(M.torso, P.neck, euler(p.hNod, p.hTurn, p.hTilt));
    for (const sd of SIDES) {
      const sg = sd === 'R' ? -1 : 1;
      M['uarm' + sd] = pivotM(M.torso, P['shoulder' + sd], qa(AZ, sg * p['abd' + sd]).multiply(qa(AX, -p['flex' + sd])).multiply(qa(AY, p['shTw' + sd])));
      M['farm' + sd] = pivotM(M['uarm' + sd], P['elbow' + sd], qa(AZ, sg * p['elbZ' + sd]).multiply(qa(AX, -p['elbX' + sd])));
      M['hand' + sd] = pivotM(M['farm' + sd], P['wrist' + sd], qa(AZ, sg * p['wrZ' + sd]).multiply(qa(AX, -p['wrX' + sd])));
    }
    // nejnižší bod celého těla se opře o zem (kromě fáze ve vzduchu, kde výšku určuje oblouk skoku)
    let low = Infinity;
    for (const [name, pts] of Object.entries(r.contact)) { const m = M[name]; if (!m) continue; for (const pt of pts) { v.copy(pt).applyMatrix4(m); if (v.y < low) low = v.y; } }
    const Y = (1 - p.fz) * (r.groundY - low) + p.ty;
    for (const m of Object.values(M)) m.elements[13] += Y;
    return { M, Y };
  }

  const hooks = [];       // funkce (M, rig) volané po každém nastavení pózy (převleky)
  function applyRig(r, p, dx = 0) {
    const { M, Y } = compute(dx ? { ...p, tx: p.tx + dx } : p, r);
    for (const [name, list] of Object.entries(r.segMeshes)) {
      const m = M[name]; if (!m) continue;
      for (const mesh of list) { mesh.matrix.copy(m); mesh.matrixWorldNeedsUpdate = true; }
    }
    for (const h of hooks) h(M, r);
    return Y;
  }
  function apply(p) {
    shown = p;
    applyRig(rig, p);
    // stín na zemi: čím výš je pánev, tím je menší a světlejší
    const k = 1 / (1 + Math.max(0, p.ty) / 60);
    shadow.scale.setScalar(k); shadow.material.opacity = 0.55 * k;
    shadow.position.x = rig.P.center.x + p.tx; shadow.position.z = rig.P.center.z + p.tz;
  }

  function setup() {
    if (!rig) rig = buildRig(viewer.meshes);
    for (const list of Object.values(rig.segMeshes)) for (const m of list) m.matrixAutoUpdate = false;
    if (!stage) {
      stage = new THREE.Mesh(new THREE.CircleGeometry(95, 64), new THREE.MeshBasicMaterial({ color: 0x7e8da8, transparent: true, opacity: 0.22, depthWrite: false }));
      stage.rotation.x = -Math.PI / 2;
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(0,0,0,.9)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      shadow = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.55 }));
      shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = -1; stage.renderOrder = -2;
    }
    stage.position.set(0, rig.groundY - 0.4, rig.P.center.z); shadow.position.set(0, rig.groundY - 0.3, rig.P.center.z);
    viewer.scene.add(stage, shadow);
    shown = blank(); blendFrom = blank(); apply(shown);
    viewer.onFrame = onFrame;
  }

  function restore() {
    if (!rig) return;
    for (const list of Object.values(rig.segMeshes)) for (const m of list) { m.matrixAutoUpdate = true; m.position.set(0, 0, 0); m.quaternion.identity(); m.updateMatrix(); m.matrixWorldNeedsUpdate = true; }
    if (stage) { viewer.scene.remove(stage, shadow); }
    viewer.onFrame = null; viewer.requestRender();
  }

  // záběr kamery: celá postava i s prostorem pro skok, nebo (po rozsypání) hromada kostí u země
  function frameDance(pile) {
    const c = rig.P.center, tanV = Math.tan(THREE.MathUtils.degToRad(viewer.camera.fov / 2)), asp = viewer.camera.aspect;
    const h = pile ? 70 : 280, w = pile ? 150 : 130, ty = pile ? rig.groundY + 14 : c.y + 30;
    const dist = Math.max((h / 2) / tanV, (w / 2) / (tanV * asp)) * (pile ? 1.15 : 1.05);
    viewer._flyTo(new THREE.Vector3(0, ty + (pile ? 40 : 0), c.z + dist), new THREE.Vector3(0, ty, c.z), pile ? 1100 : 700);
  }

  /* ---------- rozsypání: každá kost je tuhé těleso s gravitací, odrazem a třením ---------- */
  const DIRS = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) if (x || y || z) DIRS.push(new THREE.Vector3(x, y, z).normalize());
  const G = 900, REST_E = 0.3, ONE = new THREE.Vector3(1, 1, 1);
  const rnd = (a, b) => a + Math.random() * (b - a);
  let phys = null;           // { mode: 'fall' | 'assemble', t, last, bodies }

  // krajní body kosti (v různých směrech) slouží jako body dotyku se zemí
  function extremePoints(mesh, c0) {
    const a = mesh.geometry.attributes.position, best = DIRS.map(() => -Infinity), idx = DIRS.map(() => 0);
    for (let i = 0; i < a.count; i++) {
      const x = a.getX(i) - c0.x, y = a.getY(i) - c0.y, z = a.getZ(i) - c0.z;
      for (let d = 0; d < DIRS.length; d++) { const dot = x * DIRS[d].x + y * DIRS[d].y + z * DIRS[d].z; if (dot > best[d]) { best[d] = dot; idx[d] = i; } }
    }
    return [...new Set(idx)].map(i => new THREE.Vector3(a.getX(i) - c0.x, a.getY(i) - c0.y, a.getZ(i) - c0.z));
  }

  function segmentMatrices(pose) { return compute(pose).M; }   // matice jsou už posunuté o výšku nad zemí

  function scatter() {
    if (phys) return;
    current = null; hold = null; music.stop(0.3); showInfo(null); phraseShown = ''; $('#dance-badge').hidden = true; stage.material.color.set(0x7e8da8);
    const M = segmentMatrices(shown), cm = rig.P.center, bodies = [];
    let minY = Infinity, maxY = -Infinity;
    for (const [name, list] of Object.entries(rig.segMeshes)) for (const mesh of list) {
      const A = M[name];
      if (!mesh.userData.phys) {
        const bb = mesh.geometry.boundingBox, c0 = bb.getCenter(new THREE.Vector3());
        mesh.userData.phys = { c0, pts: extremePoints(mesh, c0), R: Math.max(1.2, mesh.geometry.boundingSphere.radius * 0.55) };
      }
      const ph = mesh.userData.phys, pos = ph.c0.clone().applyMatrix4(A), q = new THREE.Quaternion(), tr = new THREE.Vector3();
      A.decompose(tr, q, new THREE.Vector3());
      minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
      bodies.push({ mesh, ph, pos, q, v: new THREE.Vector3(), w: new THREE.Vector3(), delay: 0, sleepT: 0, asleep: false, seg: name });
    }
    for (const b of bodies) {
      const h = (b.pos.y - minY) / Math.max(1, maxY - minY);      // 0 = dole, 1 = nahoře: nejdřív se zhroutí spodek
      b.delay = h * 0.45 + rnd(0, 0.25);
      b.v.set((b.pos.x - cm.x) * 0.25 + rnd(-22, 22), rnd(10, 90), (b.pos.z - cm.z) * 0.25 + rnd(-22, 22));
      b.w.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 7));
    }
    for (const h of hooks) h(null, null);
    phys = { mode: 'fall', t: 0, last: performance.now() / 1000, bodies };
    shadow.visible = false;
    setButtons();
    setTimeout(() => { if (phys && phys.mode === 'fall') frameDance(true); }, 900);
    viewer.requestRender();
  }

  const _r = new THREE.Vector3(), _ax = new THREE.Vector3(), _dq = new THREE.Quaternion();
  function stepFall(dt) {
    const ground = rig.groundY + 0.15;
    for (const b of phys.bodies) {
      if (phys.t < b.delay || b.asleep) continue;
      b.v.y -= G * dt;
      b.pos.addScaledVector(b.v, dt);
      const wl = b.w.length();
      if (wl > 1e-6) { _ax.copy(b.w).divideScalar(wl); _dq.setFromAxisAngle(_ax, wl * dt); b.q.premultiply(_dq).normalize(); }
      // nejhlubší bod kosti pod zemí: vytlačit ven
      let pen = 0;
      for (const s of b.ph.pts) { _r.copy(s).applyQuaternion(b.q); const y = b.pos.y + _r.y - ground; if (y < pen) pen = y; }
      let touching = false;
      if (pen < 0) {
        b.pos.y -= pen; touching = true;
        const invI = 1 / (0.4 * b.ph.R * b.ph.R);
        for (const s of b.ph.pts) {
          _r.copy(s).applyQuaternion(b.q);
          if (b.pos.y + _r.y - ground > 0.05) continue;
          // rychlost bodu dotyku: v + w x r (jen složka y)
          const vcy = b.v.y + (b.w.z * _r.x - b.w.x * _r.z);
          if (vcy >= 0) continue;
          const j = -(1 + REST_E) * vcy / (1 + invI * (_r.x * _r.x + _r.z * _r.z));
          b.v.y += j; b.w.x += invI * (-_r.z * j); b.w.z += invI * (_r.x * j);
        }
        b.v.x *= 0.95; b.v.z *= 0.95; b.w.multiplyScalar(0.9);
        if (Math.abs(b.v.y) < 16) b.v.y = 0;
      }
      if (touching && b.v.lengthSq() < 100 && b.w.lengthSq() < 9) { b.sleepT += dt; if (b.sleepT > 0.2) { b.asleep = true; b.v.set(0, 0, 0); b.w.set(0, 0, 0); } } else b.sleepT = 0;
    }
  }

  function writeBodies() {
    for (const b of phys.bodies) {
      _r.copy(b.ph.c0).applyQuaternion(b.q);
      b.mesh.matrix.compose(_ax.copy(b.pos).sub(_r), b.q, ONE);
      b.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  function assemble() {
    if (!phys || phys.mode === 'assemble') return;
    const M = segmentMatrices(blank()); let minY = Infinity, maxY = -Infinity;
    for (const b of phys.bodies) {
      const A = M[b.seg], q = new THREE.Quaternion(); A.decompose(_ax, q, ONE.clone());
      b.toPos = b.ph.c0.clone().applyMatrix4(A); b.toQ = q;
      b.fromPos = b.pos.clone(); b.fromQ = b.q.clone();
      minY = Math.min(minY, b.toPos.y); maxY = Math.max(maxY, b.toPos.y);
    }
    for (const b of phys.bodies) b.delay = ((b.toPos.y - minY) / Math.max(1, maxY - minY)) * 0.5 + rnd(0, 0.12);
    phys.mode = 'assemble'; phys.t = 0; phys.last = performance.now() / 1000; setButtons(); frameDance(false); viewer.requestRender();
  }

  // vrací true, dokud se má dál vykreslovat
  function stepPhys(now) {
    const sec = now / 1000, dt = Math.min(0.1, Math.max(0, sec - phys.last)); phys.last = sec; phys.t += dt;   // reálný čas i na pomalém zařízení
    if (phys.mode === 'fall') {
      const n = Math.max(1, Math.ceil(dt / 0.012));
      for (let i = 0; i < n; i++) stepFall(dt / n);
      writeBodies();
      return phys.bodies.some(b => !b.asleep) || phys.t < 1;
    }
    let done = true;
    for (const b of phys.bodies) {
      const k = Math.min(1, Math.max(0, (phys.t - b.delay) / 1.0)); if (k < 1) done = false;
      const e = k * k * (3 - 2 * k);
      b.pos.lerpVectors(b.fromPos, b.toPos, e); b.pos.y += Math.sin(Math.PI * e) * 26;
      b.q.slerpQuaternions(b.fromQ, b.toQ, e);
    }
    writeBodies();
    if (done) {
      phys = null; shown = blank(); blendFrom = blank(); shadow.visible = true; apply(shown); setButtons();
      return false;
    }
    return true;
  }

  function setButtons() {
    const idle = !phys, falling = phys && phys.mode === 'fall';
    $('#dance-scatter').disabled = !idle;
    $('#dance-assemble').disabled = !falling;
    document.querySelectorAll('#view-dance .dance-btn').forEach(b => { b.disabled = !idle; });
    $('#dance-stop').disabled = !(idle && current);
    $('#dance-hint').textContent = !phys ? 'Rozsypání: kosti se uvolní, spadnou a zůstanou ležet na zemi. Složit je zase přivolá zpátky.'
      : phys.mode === 'fall' ? 'Kosti leží na zemi. Můžeš se kolem nich otáčet a přibližovat. Tlačítkem Složit je přivoláš zpátky.' : 'Kosti se skládají…';
  }

  // plynulý přechod mezi pózami: blendFrom -> cíl během 0,4 s
  function onFrame(now) {
    if (!active) return false;
    if (phys) return stepPhys(now);
    if (hold) { apply(hold); return false; }
    if (part && part.onFrame) { const r = part.onFrame(now); if (r !== undefined) return r; }
    const sec = now / 1000, playing = !!current;
    let target = REST;
    if (playing) {
      // čas tance se sčítá po snímcích (i při změně rychlosti zůstane plynulý) a začíná s první dobou hudby
      if (sec >= startAt) playT += Math.min(0.1, sec - Math.max(lastSec, startAt)) * speed;
      const d = DANCES[current], t = ((playT % d.period) + d.period) % d.period;
      target = { ...blank(), ...d.pose(t) };
    }
    lastSec = sec;
    const k = sm(0, 0.4, sec - blendStart);
    apply(k < 1 ? mix(blendFrom, target, k) : target);
    if (playing && sec >= startAt) { const nm = DANCES[current].phrase(playT, true); if (nm !== phraseShown) { phraseShown = nm; const el = $('#dance-badge'); el.hidden = false; el.textContent = nm; } }
    return playing || k < 1;       // po postavení do klidu se vykreslování zastaví
  }

  function start(id) {
    if (phys) return;
    const sec = performance.now() / 1000, d = DANCES[id];
    const delay = mcfg.on ? music.start(d.song, speed) : 0;        // hudba i tanec začínají současně
    hold = null; blendFrom = { ...shown }; current = id; startAt = sec + delay; playT = 0; lastSec = sec; blendStart = startAt;
    stage.material.color.set(d.color); const bd = $('#dance-badge'); bd.style.borderColor = d.color; bd.style.color = '';
    document.querySelectorAll('#view-dance .dance-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.d === id)));
    $('#dance-stop').disabled = false;
    showInfo(id);
    viewer.requestRender();
  }
  function showInfo(id) {
    const el = $('#dance-info'), d = id && DANCES[id];
    el.hidden = !(d && d.info);
    if (d && d.info) el.innerHTML = `<p>${esc(d.info)}</p>${d.tell ? `<p><b>Poznáš ho podle:</b> ${esc(d.tell)}.</p>` : ''}<p class="muted small">🎵 Hudba: originální skladba (${esc(SONGS[d.song].label)}), ne původní nahrávka.</p>`;
  }
  function stopDance() {
    if (!current) return;
    blendFrom = { ...shown }; current = null; blendStart = performance.now() / 1000; music.stop(0.4); stage.material.color.set(0x7e8da8);
    document.querySelectorAll('#view-dance .dance-btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
    $('#dance-stop').disabled = true; showInfo(null); phraseShown = ''; $('#dance-badge').hidden = true; viewer.requestRender();
  }

  /* ---------- rozšiřující části (bitva, rytmus, vlastní choreografie, fyzika, studio) ---------- */
  const core = {
    THREE, viewer, music, mcfg, DANCES, SONGS, store, root, hooks,
    get rig() { return rig; }, get stage() { return stage; }, get shadow() { return shadow; }, get shown() { return shown; }, get current() { return current; }, get speed() { return speed; }, get phys() { return phys; },
    compute, applyRig, apply, frameDance, mirror, start, stopDance, scatter, assemble, blank, mix, sm, setButtons,
    setBadge(text, color) { const el = $('#dance-badge'); el.hidden = !text; if (text) { el.textContent = text; el.style.borderColor = color || ''; } },
    cloneRig(tint) {                       // druhá kostra: kopie kostí se sdílenou geometrií
      const segMeshes = {}, meshes = [];
      for (const [name, list] of Object.entries(rig.segMeshes)) segMeshes[name] = list.map(m => {
        const c = new THREE.Mesh(m.geometry, m.material.clone()); c.material.color.lerp(new THREE.Color(tint), 0.65); c.matrixAutoUpdate = false; c.matrix.copy(m.matrix); c.matrixWorldNeedsUpdate = true; meshes.push(c); return c;
      });
      meshes.forEach(m => viewer.scene.add(m));
      return { ...rig, segMeshes, meshes, dispose() { meshes.forEach(m => { viewer.scene.remove(m); m.material.dispose(); }); } };
    },
  };
  const fun = createFun(core);
  const tabsEl = $('#fun-tabs', root), secEls = { tance: $('#sec-tance', root) };
  const tabDefs = [{ id: 'tance', label: '💃 Tance' }, ...fun.sections.map(s => ({ id: s.id, label: s.label }))];
  tabsEl.innerHTML = tabDefs.map(t => `<button type="button" data-sec="${t.id}" aria-pressed="${t.id === 'tance'}">${t.label}</button>`).join('');
  const byId = Object.fromEntries(fun.sections.map(s => [s.id, s]));
  for (const s of fun.sections) { const el = document.createElement('div'); el.className = 'fun-sec'; el.id = 'sec-' + s.id; el.hidden = true; root.appendChild(el); secEls[s.id] = el; s.mount(el); }
  function setSection(id) {
    if (phys) return;
    if (part) part.leave?.();
    stopDance(); hold = null;
    part = byId[id] || null;
    for (const [k, el] of Object.entries(secEls)) el.hidden = k !== id;
    tabsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sec === id)));
    blendFrom = { ...blank() }; shown = blank(); apply(shown);
    frameDance(false);
    if (part) part.enter?.();
    viewer.requestRender();
  }
  tabsEl.addEventListener('click', e => { const b = e.target.closest('[data-sec]'); if (b) setSection(b.dataset.sec); });
  core.setSection = setSection;

  root.addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (b && !b.closest('.fun-sec:not(#sec-tance)')) start(b.dataset.d); });
  $('#dance-stop', root).onclick = stopDance;
  $('#dance-scatter', root).onclick = scatter;
  $('#dance-assemble', root).onclick = assemble;
  $('#dance-speed', root).oninput = e => { speed = e.target.value / 100; music.setSpeed(speed); $('#dance-speed-val', root).textContent = e.target.value + ' %'; };
  $('#dance-music', root).onchange = e => { mcfg.on = e.target.checked; music.setEnabled(mcfg.on); store.set('danceMusic', mcfg); if (mcfg.on && current) music.start(DANCES[current].song, speed); else if (!mcfg.on) music.stop(0.1); };
  $('#dance-vol', root).oninput = e => { mcfg.vol = e.target.value / 100; music.setVolume(mcfg.vol); store.set('danceMusic', mcfg); };

  return {
    enter() {
      active = true; root.hidden = false;
      viewer.setFocus(null); viewer.setMark(null); viewer.showAll(); viewer.setExplode(0); viewer.setGhost(false);
      setup();
      frameDance(false);
      viewer.requestRender();
    },
    leave() { if (part) part.leave?.(); part = null; for (const [k, el] of Object.entries(secEls)) el.hidden = k !== 'tance'; tabsEl.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sec === 'tance'))); fun.cleanup?.(); active = false; root.hidden = true; current = null; music.stop(0); phys = null; phraseShown = ''; $('#dance-badge').hidden = true; if (shadow) shadow.visible = true; restore(); setButtons(); },
    _debug: { fun, music, get rig() { return rig; }, scatter, assemble, get phys() { return phys; }, Y(id, t) { return compute({ ...blank(), ...DANCES[id].pose(t) }).Y; }, period: id => DANCES[id].period, phraseAt: (id, t) => DANCES[id].phrase(t), pose: (id, t) => ({ ...blank(), ...DANCES[id].pose(t) }), start, show(id, t) { current = null; hold = { ...blank(), ...DANCES[id].pose(t) }; viewer.requestRender(); } },
  };
}
