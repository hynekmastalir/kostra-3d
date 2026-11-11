import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bones, byId } from './data.js';

const REAL_COLOR = new THREE.Color('#e6dcc4');
const FOCUS_COLORS = { focus: '#ff9f1c', ok: '#2ecc71', bad: '#ff4d4f' };

// Směr rozložení (cm) podle skupiny; u končetin se znaménko X řídí stranou kosti.
const EXPLODE_DIR = {
  lebka: [0, 30, 8], pater: [0, 0, -28], hrudnik: [0, 8, 32],
  horni: [60, 8, 0], panev: [14, -16, 0], dolni: [26, -36, 0],
};
const EXPLODE_RADIAL = 0.5;

export class Viewer {
  constructor(container) {
    this.container = container;
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.maxDpr = coarse ? 1.5 : 2;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.maxDpr));
    this.canvas = this.renderer.domElement;
    this.canvas.style.touchAction = 'none';
    container.appendChild(this.canvas);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 3000);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f99, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(1.5, 2, 3); key.target.position.set(0, 0, -1);
    const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
    fill.position.set(-2, -0.5, 1.5); fill.target.position.set(0, 0, -1);
    this.camera.add(key, key.target, fill, fill.target);

    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.09, rotateSpeed: 0.85, zoomSpeed: 1.0, panSpeed: 0.9,
      screenSpacePanning: true, minDistance: 4, maxDistance: 900,
    });
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; // 1 prst otáčí, 2 prsty zoom + posun
    this.controls.addEventListener('change', () => this.requestRender());

    this.meshes = new Map();      // id -> Mesh
    this.hidden = new Set();
    this.colorMode = 'real';
    this.ghostOn = true; this.ghostStrength = 0.85;
    this.focusId = null; this.focusKind = 'focus';
    this.markId = null; this.markKind = 'bad';
    this.explode = 0;
    this.anims = new Set(); this._raf = 0; this.onFrame = null;
    this.tapHandlers = [];
    this.onVisibility = () => {};

    this.focusHull = this._makeHull(); this.markHull = this._makeHull();
    this.scene.add(this.focusHull, this.markHull);

    this._initTap();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
  }

  // ---------- načtení ----------
  async load(url, expectedBytes, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Model se nepodařilo stáhnout (' + res.status + ')');
    let buf;
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader(); const chunks = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        onProgress?.(Math.min(0.97, got / expectedBytes));
      }
      const all = new Uint8Array(got); let o = 0;
      for (const c of chunks) { all.set(c, o); o += c.length; }
      buf = all.buffer;
    } else buf = await res.arrayBuffer();
    onProgress?.(0.98);
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    const sums = {};
    const found = [];
    (gltf.scene || gltf.scenes[0]).traverse(o => { if (o.isMesh) found.push(o); });   // nejdřív sebrat, pak přesouvat
    found.forEach(obj => {
      const b = byId.get(obj.name);
      if (!b) return;
      obj.geometry.computeBoundingBox(); obj.geometry.computeBoundingSphere();
      const center = obj.geometry.boundingBox.getCenter(new THREE.Vector3());
      obj.material = new THREE.MeshStandardMaterial({ color: REAL_COLOR, roughness: 0.6, metalness: 0.0 });
      obj.matrixAutoUpdate = true;
      obj.userData = {
        id: b.id, center, radius: obj.geometry.boundingSphere.radius,
        real: REAL_COLOR.clone().offsetHSL(0, 0, ((b.order * 37) % 9 - 4) * 0.006),
        distinct: new THREE.Color(b.color),
      };
      this.meshes.set(b.id, obj);
      this.scene.add(obj);
      const k = b.group + b.side; (sums[k] ??= { n: 0, c: new THREE.Vector3() });
      sums[k].n++; sums[k].c.add(center);
    });
    for (const k in sums) sums[k].c.divideScalar(sums[k].n);
    for (const m of this.meshes.values()) {
      const b = byId.get(m.userData.id); const gc = sums[b.group + b.side].c;
      const d = EXPLODE_DIR[b.group].slice();
      const sx = Math.sign(m.userData.center.x) || 1;
      if (b.group === 'horni' || b.group === 'dolni' || b.group === 'panev') d[0] *= sx;
      m.userData.explodeOffset = new THREE.Vector3(...d).addScaledVector(m.userData.center.clone().sub(gc), EXPLODE_RADIAL);
    }
    this._rebuildPickables();
    this.refreshMaterials();
    this.fitAll(false);
    onProgress?.(1);
  }

  // ---------- vykreslování ----------
  requestRender() { if (!this._raf) this._raf = requestAnimationFrame(t => this._frame(t)); }

  _frame(now) {
    this._raf = 0;
    let again = false;
    for (const a of [...this.anims]) {
      const t = Math.min(1, (now - a.t0) / a.dur); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      a.step(e);
      if (t >= 1) { this.anims.delete(a); a.done?.(); } else again = true;
    }
    if (this.controls.update()) again = true;
    if (this.onFrame && this.onFrame(now)) again = true;     // animace (tance)
    this._updateHullThickness();
    this.renderer.render(this.scene, this.camera);
    if (again) this.requestRender();
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.maxDpr));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  setTheme(dark) {
    this.dark = dark;
    this.renderer.setClearColor(dark ? 0x12161c : 0xe9edf2, 1);
    this.requestRender();
  }

  // ---------- materiály, zvýraznění ----------
  _makeHull() {
    const mat = new THREE.MeshBasicMaterial({ color: FOCUS_COLORS.focus, side: THREE.BackSide });
    mat.userData.uThick = { value: 0.3 };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uThick = mat.userData.uThick;
      sh.vertexShader = 'uniform float uThick;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        'vec3 transformed = position + normalize(normal) * uThick;');
    };
    const hull = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    hull.visible = false; hull.frustumCulled = false;
    return hull;
  }

  _placeHull(hull, id, kind) {
    const m = id && this.meshes.get(id);
    if (!m || !m.visible) { hull.visible = false; return; }
    hull.geometry = m.geometry; hull.position.copy(m.position);
    hull.material.color.set(FOCUS_COLORS[kind]);
    hull.userData.r = m.userData.radius;
    hull.visible = true;
  }

  _updateHullThickness() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    for (const h of [this.focusHull, this.markHull]) {
      if (h.visible) h.material.userData.uThick.value = Math.min(dist * 0.0032, h.userData.r * 0.2);
    }
  }

  refreshMaterials() {
    const anyFocus = !!(this.focusId || this.markId);
    for (const [id, m] of this.meshes) {
      const isF = id === this.focusId, isM = id === this.markId;
      const ghost = this.ghostOn && anyFocus && !isF && !isM;
      const mat = m.material;
      mat.color.copy(this.colorMode === 'real' ? m.userData.real : m.userData.distinct);
      if (mat.transparent !== ghost) { mat.transparent = ghost; mat.needsUpdate = true; }   // mění define OPAQUE v shaderu
      mat.opacity = ghost ? 1 - this.ghostStrength : 1; mat.depthWrite = !ghost;
      if (isF || isM) { mat.emissive.set(FOCUS_COLORS[isF ? this.focusKind : this.markKind]); mat.emissiveIntensity = 0.22; }
      else { mat.emissive.set(0x000000); mat.emissiveIntensity = 1; }
      m.renderOrder = ghost ? 1 : 0;
    }
    this._placeHull(this.focusHull, this.focusId, this.focusKind);
    this._placeHull(this.markHull, this.markId, this.markKind);
    this.requestRender();
  }

  setColorMode(mode) { this.colorMode = mode; this.refreshMaterials(); }
  setGhost(on, strength = this.ghostStrength) { this.ghostOn = on; this.ghostStrength = strength; this.refreshMaterials(); }
  setFocus(id, kind = 'focus') { this.focusId = id; this.focusKind = kind; this.refreshMaterials(); }
  setMark(id, kind = 'bad') { this.markId = id; this.markKind = kind; this.refreshMaterials(); }

  // ---------- viditelnost ----------
  isVisible(id) { return !this.hidden.has(id); }
  setVisible(id, v, silent = false) {
    const m = this.meshes.get(id); if (!m) return;
    if (v) this.hidden.delete(id); else this.hidden.add(id);
    m.visible = v;
    if (!silent) this._visChanged();
  }
  setMany(ids, v) { ids.forEach(id => this.setVisible(id, v, true)); this._visChanged(); }
  showAll() { this.setMany([...this.meshes.keys()], true); }
  _visChanged() { this._rebuildPickables(); this.refreshMaterials(); this.onVisibility(); this.recenter(); }

  // Střed otáčení = střed viditelných kostí; pohled (směr i vzdálenost) se přitom nemění.
  recenter() {
    const box = this._boundsOfVisible(); if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const delta = c.clone().sub(this.controls.target);
    if (delta.lengthSq() < 0.01) return;
    this._flyTo(this.camera.position.clone().add(delta), c, 450);
  }
  _rebuildPickables() { this.pickables = [...this.meshes.values()].filter(m => m.visible); }

  // ---------- rozložení ----------
  setExplode(t) {
    this.explode = t;
    for (const m of this.meshes.values()) m.position.copy(m.userData.explodeOffset).multiplyScalar(t);
    this._placeHull(this.focusHull, this.focusId, this.focusKind);
    this._placeHull(this.markHull, this.markId, this.markKind);
    this.requestRender();
  }

  animateExplode(to, onStep) {
    const from = this.explode;
    this._tween(700, e => { this.setExplode(from + (to - from) * e); onStep?.(this.explode); }, null, 'ex');
  }

  // ---------- kamera ----------
  // Souběžné animace: kamera (key 'cam') a rozložení (key 'ex') se navzájem nepřerušují, nová stejného druhu nahradí starou.
  _tween(dur, step, done, key = 'cam') {
    for (const a of this.anims) if (a.key === key) this.anims.delete(a);
    this.anims.add({ t0: performance.now(), dur, step, done, key });
    this.requestRender();
  }
  stopAnims() { this.anims.clear(); }

  _flyTo(pos, target, dur = 650) {
    const p0 = this.camera.position.clone(), t0 = this.controls.target.clone();
    this._tween(dur, e => {
      this.camera.position.lerpVectors(p0, pos, e);
      this.controls.target.lerpVectors(t0, target, e);
      this.camera.lookAt(this.controls.target);
    });
  }

  _boundsOfVisible(t = this.explode) {
    const box = new THREE.Box3();
    for (const m of this.meshes.values()) {
      if (!m.visible) continue;
      const b = m.geometry.boundingBox.clone().translate(m.userData.explodeOffset.clone().multiplyScalar(t));
      box.union(b);
    }
    return box;
  }

  fitAll(animate = true, explodeT = this.explode) {
    const box = this._boundsOfVisible(explodeT); if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dV = (size.y / 2) / tanV, dH = (size.x / 2) / (tanV * this.camera.aspect);
    const dist = Math.max(dV, dH) * 1.12 + size.z / 2;
    const pos = c.clone().add(new THREE.Vector3(0, 0.04, 1).normalize().multiplyScalar(dist));
    if (animate) this._flyTo(pos, c, 700);
    else { this.camera.position.copy(pos); this.controls.target.copy(c); this.camera.lookAt(c); this.controls.update(); this.requestRender(); }
  }

  resetView() { this.fitAll(true); }

  focusBone(id, animate = true) {
    const m = this.meshes.get(id); if (!m) return;
    const c = m.userData.center.clone().add(m.position);
    const r = m.userData.radius;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fitV = r / tanV, fitH = r / (tanV * this.camera.aspect);
    const dist = THREE.MathUtils.clamp(Math.max(fitV, fitH) * 1.9, 14, 400);
    // směr pohledu: zepředu / zezadu podle polohy kosti; při podobném směru ponech současný
    const want = new THREE.Vector3(THREE.MathUtils.clamp(c.x / 40, -1, 1) * 0.35, 0.12, c.z < -4 ? -1 : 1).normalize();
    const cur = this.camera.position.clone().sub(this.controls.target).normalize();
    const dir = cur.dot(want) > 0.55 ? cur : want;
    const pos = c.clone().add(dir.multiplyScalar(dist));
    if (animate) this._flyTo(pos, c); else { this.camera.position.copy(pos); this.controls.target.copy(c); this.camera.lookAt(c); this.controls.update(); this.requestRender(); }
  }

  // ---------- kliknutí (rozlišení tapu a tažení) ----------
  onTap(fn) { this.tapHandlers.push(fn); }

  _initTap() {
    const el = this.canvas; let down = null; let multi = false;
    el.addEventListener('pointerdown', e => {
      if (e.isPrimary === false) { multi = true; return; }
      multi = false; down = { x: e.clientX, y: e.clientY, t: performance.now(), touch: e.pointerType === 'touch' };
    });
    el.addEventListener('pointercancel', () => { down = null; });
    el.addEventListener('pointerup', e => {
      if (!down || multi || e.isPrimary === false) { if (e.isPrimary !== false) down = null; return; }
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      const lim = down.touch ? 10 : 5;
      const quick = performance.now() - down.t < 600;
      down = null;
      if (dx * dx + dy * dy <= lim * lim && quick) {
        const id = this.pick(e.clientX, e.clientY);
        this.tapHandlers.forEach(fn => fn(id, e));
      }
    });
  }

  pick(clientX, clientY) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const rc = this._rc ??= new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    this.scene.updateMatrixWorld();
    const hit = rc.intersectObjects(this.pickables, false)[0];
    return hit ? hit.object.userData.id : null;
  }

  // ---------- uložení / obnovení stavu (při přepnutí režimu) ----------
  snapshot() {
    return { hidden: [...this.hidden], explode: this.explode, focusId: this.focusId, ghostOn: this.ghostOn, ghostStrength: this.ghostStrength };
  }
  restore(s) {
    this.hidden = new Set(s.hidden);
    for (const [id, m] of this.meshes) m.visible = !this.hidden.has(id);
    this.ghostOn = s.ghostOn; this.ghostStrength = s.ghostStrength;
    this.setExplode(s.explode);
    this.markId = null;
    this.focusId = s.focusId;
    this._rebuildPickables(); this.refreshMaterials(); this.onVisibility();
  }
}
