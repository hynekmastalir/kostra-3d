import { esc } from './ui.js';

/* Studio: převleky (doplňky na lebce a trupu), scény (disko, ulice, noc) a nahrávání videa tance. */
export function createStudio(core) {
  const { THREE, viewer, DANCES, music, store, blank } = core;
  let el, accs = null, scene = 'classic', worn = new Set(store.get('studioWorn', [])), group = null, tickFn = null, rec = null, recUrl = null, lastTick = 0;
  const $ = s => el.querySelector(s);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });

  /* ---------- doplňky: stavějí se v klidové pozici kostry a pak se přilepí na segment (hlava, trup) ---------- */
  function box(seg) {
    const b = new THREE.Box3();
    for (const m of core.rig.segMeshes[seg]) { m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); }
    return b;
  }
  function buildAccessories() {
    const hb = box('head'), tb = box('torso'), W = hb.max.x - hb.min.x, top = hb.max.y, front = hb.max.z, midz = (hb.min.z + hb.max.z) / 2, H = hb.max.y - hb.min.y;
    const mk = (id, label, seg, build) => { const g = new THREE.Group(); build(g); g.matrixAutoUpdate = false; g.visible = false; g.traverse(o => { o.frustumCulled = false; }); return { id, label, seg, obj: g }; };
    const mesh = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); return o; };
    const eyeY = hb.min.y + H * 0.5, list = [];
    list.push(mk('tophat', '🎩 Cylindr', 'head', g => {
      g.add(mesh(new THREE.CylinderGeometry(W * 0.36, W * 0.38, W * 0.62, 28), mat(0x16161a), 0, top + W * 0.22, midz));
      g.add(mesh(new THREE.CylinderGeometry(W * 0.62, W * 0.62, W * 0.04, 32), mat(0x16161a), 0, top - W * 0.08, midz));
      g.add(mesh(new THREE.CylinderGeometry(W * 0.385, W * 0.385, W * 0.1, 28), mat(0xb91c1c), 0, top + W * 0.0, midz));
    }));
    list.push(mk('cap', '🧢 Kšiltovka', 'head', g => {
      g.add(mesh(new THREE.SphereGeometry(W * 0.56, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2563eb), 0, top - W * 0.3, midz));
      const v = mesh(new THREE.BoxGeometry(W * 0.82, W * 0.04, W * 0.5), mat(0x1d4ed8), 0, top - W * 0.3, front + W * 0.1); v.rotation.x = 0.12; g.add(v);
    }));
    list.push(mk('party', '🥳 Párty čepice', 'head', g => {
      const c = mesh(new THREE.ConeGeometry(W * 0.3, W * 0.9, 24), mat(0xec4899), W * 0.04, top + W * 0.3, midz); c.rotation.z = -0.12; g.add(c);
      g.add(mesh(new THREE.SphereGeometry(W * 0.07, 12, 8), mat(0xfacc15), W * 0.09, top + W * 0.77, midz));
      g.add(mesh(new THREE.CylinderGeometry(W * 0.27, W * 0.3, W * 0.06, 24), mat(0xfacc15), W * 0.0, top - W * 0.1, midz));
    }));
    list.push(mk('glasses', '👓 Brýle', 'head', g => {
      const m = mat(0x111111);
      for (const s of [-1, 1]) { const t = mesh(new THREE.TorusGeometry(W * 0.15, W * 0.018, 8, 28), m, s * W * 0.19, eyeY, front + W * 0.02); g.add(t); }
      const br = mesh(new THREE.CylinderGeometry(W * 0.012, W * 0.012, W * 0.1, 6), m, 0, eyeY + W * 0.04, front + W * 0.02); br.rotation.z = Math.PI / 2; g.add(br);
      for (const s of [-1, 1]) { const t = mesh(new THREE.CylinderGeometry(W * 0.012, W * 0.012, W * 0.55, 6), m, s * W * 0.34, eyeY, front - W * 0.26); t.rotation.x = Math.PI / 2; g.add(t); }
    }));
    list.push(mk('shades', '😎 Sluneční brýle', 'head', g => {
      const m = mat(0x050505, { roughness: 0.2, metalness: 0.4 });
      for (const s of [-1, 1]) { const d = mesh(new THREE.CylinderGeometry(W * 0.17, W * 0.17, W * 0.03, 24), m, s * W * 0.19, eyeY, front + W * 0.03); d.rotation.x = Math.PI / 2; g.add(d); }
      const br = mesh(new THREE.BoxGeometry(W * 0.12, W * 0.03, W * 0.03), m, 0, eyeY + W * 0.04, front + W * 0.03); g.add(br);
      for (const s of [-1, 1]) { const t = mesh(new THREE.BoxGeometry(W * 0.02, W * 0.025, W * 0.55), m, s * W * 0.36, eyeY + W * 0.02, front - W * 0.24); g.add(t); }
    }));
    list.push(mk('phones', '🎧 Sluchátka', 'head', g => {
      const m = mat(0x1f2937), cy = hb.min.y + H * 0.45;
      const arc = mesh(new THREE.TorusGeometry(W * 0.58, W * 0.035, 8, 36, Math.PI), m, 0, cy, midz); g.add(arc);
      for (const s of [-1, 1]) { const c = mesh(new THREE.CylinderGeometry(W * 0.17, W * 0.17, W * 0.11, 22), mat(0xef4444), s * W * 0.57, cy, midz); c.rotation.z = Math.PI / 2; g.add(c); }
    }));
    list.push(mk('afro', '🌀 Afro', 'head', g => {
      const m = mat(0x2a1a12, { roughness: 0.9 }), rr = W * 0.7, inst = new THREE.InstancedMesh(new THREE.SphereGeometry(W * 0.22, 10, 8), m, 90), tmp = new THREE.Object3D();
      let n = 0, seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      while (n < 90) {
        const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 1.55 - 0.45), d = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
        if (d.z > 0.3 && d.y < 0.55) continue;           // obličej zůstane volný
        tmp.position.set(d.x * rr, hb.min.y + H * 0.55 + d.y * rr * 0.9, midz + d.z * rr * 0.85); tmp.scale.setScalar(0.8 + rnd() * 0.5); tmp.updateMatrix(); inst.setMatrixAt(n++, tmp.matrix);
      }
      g.add(inst);
    }));
    list.push(mk('cape', '🦸 Plášť', 'torso', g => {
      const w = (tb.max.x - tb.min.x) * 1.05, h = 78, geo = new THREE.PlaneGeometry(w, h, 10, 12), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) { const t = (h / 2 - pos.getY(i)) / h; pos.setZ(i, t * t * 16 + Math.sin(pos.getX(i) * 0.25) * t * 2); pos.setX(i, pos.getX(i) * (1 + t * 0.35)); }
      geo.computeVertexNormals();
      const c = mesh(geo, mat(0xc1121f, { side: THREE.DoubleSide }), 0, core.rig.P.shoulderR.y - h / 2 + 4, tb.min.z - 2); g.add(c);
      g.add(mesh(new THREE.TorusGeometry(W * 0.5, W * 0.05, 8, 24, Math.PI), mat(0xfacc15), 0, core.rig.P.shoulderR.y + 3, tb.min.z - 1));
    }));
    list.push(mk('crown', '👑 Koruna', 'head', g => {
      const gold = mat(0xf5c518, { metalness: 0.7, roughness: 0.3 });
      g.add(mesh(new THREE.CylinderGeometry(W * 0.42, W * 0.38, W * 0.2, 24, 1, true), mat(0xf5c518, { metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }), 0, top + W * 0.02, midz));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; g.add(mesh(new THREE.ConeGeometry(W * 0.08, W * 0.22, 8), gold, Math.cos(a) * W * 0.4, top + W * 0.22, midz + Math.sin(a) * W * 0.4)); }
      g.add(mesh(new THREE.SphereGeometry(W * 0.05, 10, 8), mat(0xdc2626), 0, top + W * 0.04, midz + W * 0.41));
    }));
    list.push(mk('cowboy', '🤠 Kovboj', 'head', g => {
      const m = mat(0x8b5a2b);
      g.add(mesh(new THREE.CylinderGeometry(W * 0.34, W * 0.4, W * 0.4, 24), m, 0, top + W * 0.12, midz));
      const br = mesh(new THREE.CylinderGeometry(W * 0.85, W * 0.85, W * 0.04, 32), m, 0, top - W * 0.08, midz); g.add(br);
      g.add(mesh(new THREE.CylinderGeometry(W * 0.405, W * 0.405, W * 0.08, 24), mat(0x3b2412), 0, top - W * 0.02, midz));
    }));
    list.push(mk('pirate', '🏴‍☠️ Pirát', 'head', g => {
      const m = mat(0x111114), c = mesh(new THREE.ConeGeometry(W * 0.75, W * 0.35, 3, 1), m, 0, top + W * 0.05, midz); c.rotation.y = Math.PI / 2; c.scale.set(1.15, 1, 0.9); g.add(c);
      g.add(mesh(new THREE.SphereGeometry(W * 0.06, 10, 8), mat(0xf5f5f5), 0, top + W * 0.08, front + W * 0.12));
      const p = mesh(new THREE.CircleGeometry(W * 0.15, 20), mat(0x000000, { side: THREE.DoubleSide }), -W * 0.19, eyeY, front + W * 0.03); g.add(p);
      const band = mesh(new THREE.TorusGeometry(W * 0.5, W * 0.012, 6, 32, Math.PI * 1.6), mat(0x000000), 0, eyeY + W * 0.14, midz); band.rotation.set(Math.PI / 2, 0, 0.9); band.rotation.x = Math.PI / 2 - 0.25; g.add(band);
    }));
    list.push(mk('wizard', '🧙 Čaroděj', 'head', g => {
      const m = mat(0x4c1d95), c = mesh(new THREE.ConeGeometry(W * 0.36, W * 1.1, 24), m, 0, top + W * 0.45, midz); c.rotation.z = 0.15; g.add(c);
      g.add(mesh(new THREE.CylinderGeometry(W * 0.7, W * 0.7, W * 0.04, 32), m, 0, top - W * 0.05, midz));
      for (const [x, y] of [[0.1, 0.45], [-0.12, 0.7]]) g.add(mesh(new THREE.OctahedronGeometry(W * 0.05), mat(0xfacc15, { emissive: 0x8a6d00 }), x * W, top + y * W, midz + W * 0.3));
    }));
    list.push(mk('chef', '👨‍🍳 Kuchař', 'head', g => {
      const m = mat(0xf8fafc);
      g.add(mesh(new THREE.CylinderGeometry(W * 0.4, W * 0.4, W * 0.22, 24), m, 0, top - W * 0.02, midz));
      const puff = mesh(new THREE.SphereGeometry(W * 0.5, 24, 14), m, 0, top + W * 0.3, midz); puff.scale.set(1, 0.75, 1); g.add(puff);
    }));
    list.push(mk('halo', '😇 Svatozář', 'head', g => { const h = mesh(new THREE.TorusGeometry(W * 0.38, W * 0.035, 8, 32), mat(0xfde047, { emissive: 0xb8860b, metalness: 0.5 }), 0, top + W * 0.3, midz); h.rotation.x = Math.PI / 2; g.add(h); }));
    list.push(mk('bunny', '🐰 Králičí uši', 'head', g => {
      const m = mat(0xf1f5f9), pk = mat(0xf9a8d4);
      for (const s of [-1, 1]) { const e = mesh(new THREE.CapsuleGeometry(W * 0.1, W * 0.6, 6, 12), m, s * W * 0.2, top + W * 0.55, midz); e.rotation.z = -s * 0.22; g.add(e); const i = mesh(new THREE.CapsuleGeometry(W * 0.05, W * 0.42, 6, 10), pk, s * W * 0.2, top + W * 0.55, midz + W * 0.07); i.rotation.z = -s * 0.22; g.add(i); }
    }));
    list.push(mk('headband', '🎽 Čelenka', 'head', g => {
      const b = mesh(new THREE.TorusGeometry(W * 0.5, W * 0.045, 8, 36), mat(0xef4444), 0, top - W * 0.18, midz); b.rotation.x = Math.PI / 2; g.add(b);
    }));
    list.push(mk('bowtie', '🎀 Motýlek', 'torso', g => {
      const m = mat(0xdc2626), y = core.rig.P.neck.y - W * 0.55, z = tb.max.z + 0.5;
      for (const s of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(W * 0.2, W * 0.36, 3), m, s * W * 0.2, y, z); w.rotation.z = -s * Math.PI / 2; g.add(w); }
      g.add(mesh(new THREE.SphereGeometry(W * 0.07, 10, 8), m, 0, y, z));
    }));
    list.push(mk('scarf', '🧣 Šála', 'torso', g => {
      const y = core.rig.P.neck.y - W * 0.6, t = mesh(new THREE.TorusGeometry(W * 0.5, W * 0.12, 10, 28), mat(0x16a34a), 0, y, (tb.min.z + tb.max.z) / 2 + 1); t.rotation.x = Math.PI / 2; g.add(t);
      const tail = mesh(new THREE.BoxGeometry(W * 0.22, W * 0.9, W * 0.06), mat(0x15803d), W * 0.2, y - W * 0.45, tb.max.z + W * 0.1); g.add(tail);
    }));
    list.push(mk('chain', '⛓️ Zlatý řetěz', 'torso', g => {
      const t = mesh(new THREE.TorusGeometry(W * 0.62, W * 0.03, 8, 40, Math.PI), mat(0xf5c518, { metalness: 0.9, roughness: 0.25 }), 0, core.rig.P.neck.y - W * 0.55, tb.max.z - W * 0.1); t.rotation.z = Math.PI; t.scale.set(1, 1.6, 1); g.add(t);
      g.add(mesh(new THREE.SphereGeometry(W * 0.12, 12, 10), mat(0xf5c518, { metalness: 0.9, roughness: 0.25 }), 0, core.rig.P.neck.y - W * 1.5, tb.max.z + 0.5));
    }));
    list.push(mk('backpack', '🎒 Batoh', 'torso', g => {
      g.add(mesh(new THREE.BoxGeometry((tb.max.x - tb.min.x) * 0.55, W * 1.5, W * 0.7), mat(0xea580c), 0, core.rig.P.shoulderR.y - W * 1.1, tb.min.z - W * 0.35));
      for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(W * 0.12, W * 1.5, (tb.max.z - tb.min.z) * 1.02), mat(0x7c2d12), s * W * 0.45, core.rig.P.shoulderR.y - W * 0.6, (tb.min.z + tb.max.z) / 2 - 1));
    }));
    list.push(mk('wings', '🪽 Křídla', 'torso', g => {
      for (const s of [-1, 1]) {
        const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(30, 10, 60, 30, 70, 75); sh.bezierCurveTo(50, 60, 40, 55, 30, 62); sh.bezierCurveTo(28, 45, 18, 30, 0, 22);
        const w = mesh(new THREE.ShapeGeometry(sh), mat(0xf8fafc, { side: THREE.DoubleSide, emissive: 0x555555 }), s * W * 0.25, core.rig.P.shoulderR.y - 40, tb.min.z - 3); w.scale.set(s * 0.6, 0.6, 1); w.rotation.y = -s * 0.4; w.rotation.z = -0.1 * s; g.add(w);
      }
    }));
    for (const a of list) viewer.scene.add(a.obj);
    return list;
  }
  function placeAccessories(M, r) {
    if (!accs) return;
    if (M === null) { accs.forEach(a => { a.obj.visible = false; }); return; }
    if (r !== core.rig) return;
    for (const a of accs) { const on = worn.has(a.id); a.obj.visible = on; if (on) { a.obj.matrix.copy(M[a.seg]); a.obj.matrixWorldNeedsUpdate = true; } }
  }

  /* ---------- scény ---------- */
  const SCENES = { classic: 'Klasická', disco: '🪩 Disko', street: '🧱 Ulice', night: '🌙 Noc', beach: '🏖️ Pláž', space: '🚀 Vesmír', stage: '🎤 Pódium', snow: '❄️ Zima', castle: '🏰 Hrad', sea: '🌊 Moře' };
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  let dotTex = null;
  const dot = () => dotTex ??= canvasTex(32, 32, (x) => { const g = x.createRadialGradient(16, 16, 2, 16, 16, 15); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); });
  function clearScene() {
    if (group) { viewer.scene.remove(group); group.traverse(o => { o.geometry?.dispose(); if (o.material) { o.material.map?.dispose(); o.material.dispose(); } }); group = null; }
    tickFn = null; if (core.stage) core.stage.visible = true;
    viewer.setTheme(viewer.dark ?? false);
  }
  function setScene(id) {
    clearScene(); scene = id;
    if (id === 'classic' || !core.rig) { viewer.requestRender(); return; }
    const c = core.rig.P.center, gy = core.rig.groundY;
    group = new THREE.Group(); viewer.scene.add(group); core.stage.visible = false;
    const floor = (tex, color, r = 130) => { const f = new THREE.Mesh(new THREE.CircleGeometry(r, 64), new THREE.MeshStandardMaterial({ map: tex || null, color, roughness: 0.8 })); f.rotation.x = -Math.PI / 2; f.position.set(0, gy - 0.3, c.z); group.add(f); return f; };
    if (id === 'disco') {
      viewer.renderer.setClearColor(0x14091f, 1);
      const N = 8, tex = canvasTex(256, 256, () => {}), cv = tex.image, g = cv.getContext('2d'), f = floor(tex, 0xffffff, 150);
      f.material.emissive = new THREE.Color(0xffffff); f.material.emissiveMap = tex; f.material.emissiveIntensity = 0.55;
      const lights = [0xff2d95, 0x22d3ee, 0xfacc15].map(col => { const l = new THREE.PointLight(col, 1.4, 0, 0); group.add(l); return l; });
      tickFn = t => {
        const bpm = core.current ? DANCES[core.current].bpm : 120, beat = Math.floor(t * bpm / 60);
        if (tex.userData.beat !== beat) {
          tex.userData.beat = beat;
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = `hsl(${(beat * 37 + (x + y) * 31 + ((x * y) % 3) * 40) % 360},${(x + y + beat) % 2 ? 85 : 40}%,${(x + y + beat) % 2 ? 52 : 18}%)`; g.fillRect(x * 32, y * 32, 32, 32); }
          tex.needsUpdate = true;
        }
        lights.forEach((l, i) => { const a = t * (0.9 + i * 0.35) + i * 2.1; l.position.set(Math.cos(a) * 90, c.y + 80 + 30 * Math.sin(a * 1.3), c.z + 60 + Math.sin(a) * 70); });
      };
    } else if (id === 'street') {
      viewer.renderer.setClearColor(0x2b2d33, 1);
      floor(canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#3b3d43'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},.06)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.fillStyle = '#e5c453'; for (let i = 0; i < 4; i++) x.fillRect(w / 2 - 6, i * 64 + 8, 12, 36); }), 0xffffff, 150);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(420, 230), new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTex(1024, 560, (x, w, h) => {
        x.fillStyle = '#7a3b2e'; x.fillRect(0, 0, w, h); x.strokeStyle = '#4a2018'; x.lineWidth = 3;
        for (let r = 0; r < 14; r++) { x.beginPath(); x.moveTo(0, r * 40); x.lineTo(w, r * 40); x.stroke(); for (let k = 0; k < 12; k++) { const ox = (r % 2 ? 40 : 0) + k * 85; x.beginPath(); x.moveTo(ox, r * 40); x.lineTo(ox, r * 40 + 40); x.stroke(); } }
        x.font = 'bold 190px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.lineWidth = 14; x.strokeStyle = '#111'; x.strokeText('KOSTRA', w / 2, 330); const gr = x.createLinearGradient(0, 180, 0, 340); gr.addColorStop(0, '#ff6ec7'); gr.addColorStop(1, '#ffd23f'); x.fillStyle = gr; x.fillText('KOSTRA', w / 2, 330);
        x.font = 'bold 70px Impact, sans-serif'; x.fillStyle = '#22d3ee'; x.strokeText('3D', w / 2 + 330, 450); x.fillText('3D', w / 2 + 330, 450);
      }) }));
      wall.position.set(0, gy + 115, c.z - 110); group.add(wall);
      const lamp = new THREE.PointLight(0xffb066, 1.3, 0, 0); lamp.position.set(70, c.y + 130, c.z + 40); group.add(lamp);
    } else if (id === 'night') {
      viewer.renderer.setClearColor(0x060a1e, 1);
      floor(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#10183a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = 'rgba(160,190,255,.07)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }), 0xffffff, 150);
      const pts = []; for (let i = 0; i < 260; i++) { const th = Math.random() * Math.PI * 2, ph = Math.random() * 1.2 + 0.1, R = 700; pts.push(Math.cos(th) * Math.sin(ph) * R, c.y + 40 + Math.cos(ph) * R * 0.8, c.z - 200 - Math.abs(Math.sin(th)) * R); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false, map: dot(), transparent: true, depthWrite: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c4 })); moon.position.set(-170, c.y + 150, c.z - 420); group.add(moon);
      const l = new THREE.DirectionalLight(0x8fb0ff, 1.8); l.position.set(-120, 220, 80); group.add(l);
      tickFn = t => { moon.scale.setScalar(1 + 0.02 * Math.sin(t)); };
    }
    else if (id === 'beach') {
      viewer.renderer.setClearColor(0x7ec8f2, 1);
      floor(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#e8d29a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { x.fillStyle = `rgba(${i % 2 ? 160 : 255},${i % 2 ? 120 : 240},${i % 2 ? 60 : 200},.25)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }), 0xffffff, 170);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 120), new THREE.MeshBasicMaterial({ color: 0x1f9bd8 })); sea.position.set(0, gy + 8, c.z - 150); group.add(sea);
      const sun = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff176 })); sun.position.set(150, c.y + 140, c.z - 300); group.add(sun);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 130, 8), mat(0x8b5a2b)); trunk.position.set(-90, gy + 65, c.z - 40); trunk.rotation.z = 0.12; group.add(trunk);
      for (let i = 0; i < 6; i++) { const lf = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 6), mat(0x16a34a)); const a = i / 6 * Math.PI * 2; lf.position.set(-98 + Math.cos(a) * 28, gy + 132 - Math.abs(Math.sin(a)) * 10, c.z - 40 + Math.sin(a) * 28); lf.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2); group.add(lf); }
      const l = new THREE.DirectionalLight(0xfff0c0, 1.6); l.position.set(100, 200, 120); group.add(l);
    } else if (id === 'space') {
      viewer.renderer.setClearColor(0x02030a, 1);
      floor(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#1b1d2e'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(120,140,255,.5)'; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 16, 0); x.lineTo(i * 16, h); x.moveTo(0, i * 16); x.lineTo(w, i * 16); x.stroke(); } }), 0xffffff, 140);
      const pts = []; for (let i = 0; i < 500; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(650); pts.push(v.x, c.y + Math.abs(v.y) * 0.6, c.z - Math.abs(v.z) - 100); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, map: dot(), transparent: true, depthWrite: false })));
      const planet = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 20), mat(0xd97706)); planet.position.set(-150, c.y + 110, c.z - 380); group.add(planet);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(110, 4, 6, 60), mat(0xfcd34d)); ring.position.copy(planet.position); ring.rotation.x = 1.2; group.add(ring);
      const earth = new THREE.Mesh(new THREE.SphereGeometry(25, 24, 16), mat(0x2563eb)); earth.position.set(170, c.y + 160, c.z - 300); group.add(earth);
      const l = new THREE.DirectionalLight(0xdbe4ff, 1.5); l.position.set(100, 150, 150); group.add(l);
      tickFn = t => { planet.rotation.y = t * 0.1; earth.position.y = c.y + 160 + 6 * Math.sin(t * 0.6); };
    } else if (id === 'stage') {
      viewer.renderer.setClearColor(0x07070c, 1);
      floor(canvasTex(128, 128, (x, w, h) => { const g2 = x.createLinearGradient(0, 0, w, h); g2.addColorStop(0, '#3a2412'); g2.addColorStop(1, '#5a3a1e'); x.fillStyle = g2; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * 16); x.lineTo(w, i * 16); x.stroke(); } }), 0xffffff, 140);
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(420, 260, 40, 1), mat(0x7f1d1d, { side: THREE.DoubleSide })); const cp = curtain.geometry.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 0.15) * 6); curtain.geometry.computeVertexNormals(); curtain.position.set(0, gy + 120, c.z - 120); group.add(curtain);
      const beams = [0xfef08a, 0xf472b6, 0x67e8f9].map((col, i) => { const sp = new THREE.SpotLight(col, 2.2, 0, 0.35, 0.5, 0); sp.position.set((i - 1) * 90, c.y + 220, c.z + 100); sp.target.position.set(0, gy, c.z); group.add(sp, sp.target); return sp; });
      tickFn = t => beams.forEach((sp, i) => sp.target.position.set(Math.sin(t * 0.8 + i * 2) * 70, gy, c.z + Math.cos(t * 0.7 + i) * 30));
    } else if (id === 'snow') {
      viewer.renderer.setClearColor(0xb7c9e0, 1);
      floor(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#f4f8fc'; x.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { x.fillStyle = 'rgba(160,190,230,.18)'; x.fillRect(Math.random() * w, Math.random() * h, 3, 2); } }), 0xffffff, 170);
      for (const [px, pz, sc2] of [[-100, -70, 1], [110, -90, 1.3], [-150, -150, 1.5], [150, 10, 0.8]]) { const tr = new THREE.Group(); for (let i = 0; i < 3; i++) { const cn = new THREE.Mesh(new THREE.ConeGeometry(26 - i * 6, 46, 10), mat(0x14532d)); cn.position.y = 30 + i * 28; tr.add(cn); const sn = new THREE.Mesh(new THREE.ConeGeometry(20 - i * 5, 12, 10), mat(0xffffff)); sn.position.y = 44 + i * 28; tr.add(sn); } tr.position.set(px, gy, c.z + pz); tr.scale.setScalar(sc2); group.add(tr); }
      const N = 160, sp = new Float32Array(N * 3), seed = []; for (let i = 0; i < N; i++) { seed.push([Math.random() * 300 - 150, Math.random(), Math.random() * 200 - 100]); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 9, sizeAttenuation: false, map: dot(), transparent: true, depthWrite: false })));
      tickFn = t => { for (let i = 0; i < N; i++) { const s = seed[i]; sp[i * 3] = s[0] + Math.sin(t * 0.7 + i) * 8; sp[i * 3 + 1] = gy + 240 - (((t * 30 * (0.6 + s[1] * 0.6) + s[1] * 240) % 240)); sp[i * 3 + 2] = c.z + s[2]; } geo.attributes.position.needsUpdate = true; };
    } else if (id === 'castle') {
      viewer.renderer.setClearColor(0x1a1410, 1);
      floor(canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#6b6258'; x.fillRect(0, 0, w, h); x.strokeStyle = '#3d3830'; x.lineWidth = 3; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, h); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); } }), 0xffffff, 140);
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(440, 240), new THREE.MeshStandardMaterial({ roughness: 1, map: canvasTex(1024, 560, (x, w, h) => { x.fillStyle = '#5b544b'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2f2b26'; x.lineWidth = 4; for (let r = 0; r < 12; r++) { x.beginPath(); x.moveTo(0, r * 48); x.lineTo(w, r * 48); x.stroke(); for (let k = 0; k < 9; k++) { const ox = (r % 2 ? 60 : 0) + k * 120; x.beginPath(); x.moveTo(ox, r * 48); x.lineTo(ox, r * 48 + 48); x.stroke(); } } x.fillStyle = '#b91c1c'; x.fillRect(w / 2 - 70, 40, 140, 300); x.fillStyle = '#facc15'; x.font = 'bold 120px serif'; x.textAlign = 'center'; x.fillText('☠', w / 2, 230); }) }));
      wall.position.set(0, gy + 120, c.z - 110); group.add(wall);
      const torches = [-150, 150].map(px => { const t = new THREE.Mesh(new THREE.ConeGeometry(7, 22, 8), new THREE.MeshBasicMaterial({ color: 0xff9a3c })); t.position.set(px, gy + 120, c.z - 105); const l = new THREE.PointLight(0xff8a30, 1.6, 0, 0); l.position.set(px, gy + 120, c.z - 80); group.add(t, l); return { t, l }; });
      tickFn = t => torches.forEach((o, i) => { const k = 1 + 0.18 * Math.sin(t * 13 + i * 3) + 0.1 * Math.sin(t * 23 + i); o.l.intensity = 1.5 * k; o.t.scale.set(1, k, 1); });
    } else if (id === 'sea') {
      viewer.renderer.setClearColor(0x0b4f7a, 1);
      floor(canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#c9b27a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { x.fillStyle = 'rgba(90,70,30,.2)'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }), 0xffffff, 160);
      const coral = [[-110, -50, 0xf472b6], [120, -70, 0xfb923c], [-60, -130, 0xa78bfa], [70, -150, 0xf43f5e]];
      for (const [px, pz, col] of coral) for (let i = 0; i < 4; i++) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(3, 6, 40 + i * 12, 8), mat(col)); cn.position.set(px + (i - 1.5) * 9, gy + 22 + i * 4, c.z + pz); cn.rotation.z = (i - 1.5) * 0.18; group.add(cn); }
      const N = 70, bp = new Float32Array(N * 3), bs = []; for (let i = 0; i < N; i++) bs.push([Math.random() * 300 - 150, Math.random(), Math.random() * 140 - 70]);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(bp, 3)); group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xbfe9ff, size: 10, sizeAttenuation: false, map: dot(), transparent: true, opacity: 0.8, depthWrite: false })));
      const fish = [0xfacc15, 0xf97316].map(col => { const f = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8), mat(col)); f.scale.set(1.8, 1, 0.5); group.add(f); return f; });
      const l = new THREE.DirectionalLight(0x9fd8ff, 1.4); l.position.set(0, 300, 100); group.add(l);
      tickFn = t => { for (let i = 0; i < N; i++) { const s = bs[i]; bp[i * 3] = s[0] + Math.sin(t + i) * 5; bp[i * 3 + 1] = gy + ((t * 25 * (0.5 + s[1]) + s[1] * 250) % 250); bp[i * 3 + 2] = c.z + s[2]; } geo.attributes.position.needsUpdate = true; fish.forEach((f, i) => { const a = t * (0.5 + i * 0.2) + i * 3; f.position.set(Math.cos(a) * 140, c.y + 40 + i * 30, c.z - 60 + Math.sin(a) * 40); f.rotation.y = -a + Math.PI / 2 * (i ? -1 : 1); }); };
    }
    viewer.requestRender();
  }
  function tick() { if (!tickFn) return; const t = performance.now() / 1000; if (t === lastTick) return; lastTick = t; tickFn(t); }

  /* ---------- nahrávání ---------- */
  const mimes = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  function recSupported() { return typeof MediaRecorder !== 'undefined' && viewer.canvas.captureStream; }
  function startRec(auto) {
    if (rec || !recSupported()) return;
    const stream = viewer.canvas.captureStream(30), at = music.captureTrack(); if (at) stream.addTrack(at);
    const mime = mimes.find(m => MediaRecorder.isTypeSupported(m)) || '';
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 3500000 } : {}), chunks = [];
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      const type = (mr.mimeType || mime || 'video/webm').split(';')[0], blob = new Blob(chunks, { type });
      if (recUrl) URL.revokeObjectURL(recUrl);
      recUrl = URL.createObjectURL(blob); const ext = type.includes('mp4') ? 'mp4' : 'webm', file = new File([blob], `kostra-tanec.${ext}`, { type });
      $('#st-result').innerHTML = `<video src="${recUrl}" controls playsinline loop></video><div class="row"><a class="btn primary grow" href="${recUrl}" download="kostra-tanec.${ext}" style="text-align:center;line-height:var(--tap)">⬇ Stáhnout</a>${navigator.canShare?.({ files: [file] }) ? '<button class="btn grow" type="button" id="st-share">📤 Sdílet</button>' : ''}</div><p class="muted small">${(blob.size / 1048576).toFixed(1)} MB, formát ${ext}</p>`;
      $('#st-share')?.addEventListener('click', () => navigator.share({ files: [file], title: 'Tančící kostra' }).catch(() => {}));
      rec = null; $('#st-rec').textContent = '● Nahrát'; $('#st-rec').classList.remove('bad'); $('#st-status').textContent = '';
    };
    mr.start(250); rec = { mr, t0: performance.now(), auto };
    $('#st-rec').textContent = '■ Zastavit nahrávání'; $('#st-rec').classList.add('bad'); $('#st-result').innerHTML = '';
    rec.timer = setInterval(() => { const s = (performance.now() - rec.t0) / 1000; $('#st-status').textContent = `● REC ${s.toFixed(0)} s`; if (s > 90) stopRec(); }, 250);
    viewer.requestRender();
  }
  function stopRec() { if (!rec) return; clearInterval(rec.timer); clearTimeout(rec.auto); try { rec.mr.state !== 'inactive' && rec.mr.stop(); } catch (e) { /* už zastaveno */ } }
  function recordDance() {
    const id = $('#st-dance').value, d = DANCES[id]; if (!d) return;
    core.start(id); startRec(0);
    const len = (d.period / core.speed + 1.2) * 1000;
    rec.auto = setTimeout(() => { stopRec(); core.stopDance(); }, Math.min(len, 90000));
  }

  return {
    id: 'studio', label: '🎩 Studio',
    mount(e) {
      el = e;
      const dances = () => Object.entries(DANCES).filter(([, d]) => d.group !== 'custom' || true).map(([id, d]) => `<option value="${id}">${d.emoji} ${esc(d.name)}</option>`).join('');
      el.innerHTML = `<h3 class="dgroup">Převleky</h3><div class="row" id="st-acc"></div>
        <h3 class="dgroup">Scéna</h3><div class="row" id="st-scenes">${Object.entries(SCENES).map(([id, n]) => `<button type="button" class="chip" data-scene="${id}" aria-pressed="${id === 'classic'}">${n}</button>`).join('')}</div>
        <h3 class="dgroup">Nahrát video</h3>
        <p class="muted small">Zaznamená se pohled na kostru i hudba. Soubor si pak stáhneš nebo pošleš dál.</p>
        <label class="field"><span>Tanec</span><select id="st-dance">${dances()}</select></label>
        <div class="row"><button class="btn primary grow" id="st-rec-dance" type="button">🎬 Nahrát celou sestavu</button><button class="btn" id="st-rec" type="button">● Nahrát</button></div>
        <p id="st-status" class="small" style="color:var(--bad);font-weight:700"></p><div id="st-result"></div>`;
      $('#st-dance').value = 'orange';
      if (!recSupported()) { $('#st-rec').disabled = $('#st-rec-dance').disabled = true; $('#st-status').textContent = 'Tento prohlížeč nahrávání nepodporuje.'; }
      $('#st-rec').onclick = () => (rec ? stopRec() : startRec(0));
      $('#st-rec-dance').onclick = recordDance;
      el.addEventListener('click', ev => {
        const a = ev.target.closest('[data-acc]'), s = ev.target.closest('[data-scene]');
        if (a) { const id = a.dataset.acc; worn.has(id) ? worn.delete(id) : worn.add(id); store.set('studioWorn', [...worn]); a.setAttribute('aria-pressed', String(worn.has(id))); core.apply(core.shown); core.viewer.requestRender(); }
        if (s) { setScene(s.dataset.scene); el.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b === s))); }
      });
      core.hooks.push(placeAccessories, () => tick());
    },
    enter() {
      if (!accs) {
        accs = buildAccessories();
        $('#st-acc').innerHTML = accs.map(a => `<button type="button" class="chip" data-acc="${a.id}" aria-pressed="${worn.has(a.id)}">${esc(a.label)}</button>`).join('');
      }
      core.apply(core.shown); viewer.requestRender();
    },
    leave() { /* převleky a scéna zůstávají i v ostatních částech, uklidí se při odchodu ze záložky */ },
    cleanup() {
      stopRec();
      if (accs) { accs.forEach(a => { viewer.scene.remove(a.obj); a.obj.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); }); }); accs = null; }
      clearScene(); scene = 'classic';
      el?.querySelectorAll('[data-scene]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scene === 'classic')));
    },
  };
}
