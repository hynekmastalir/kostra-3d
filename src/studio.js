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
  const SCENES = { classic: 'Klasická', disco: '🪩 Disko', street: '🧱 Ulice', night: '🌙 Noc' };
  function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
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
      group.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false })));
      const moon = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3c4 })); moon.position.set(-170, c.y + 150, c.z - 420); group.add(moon);
      const l = new THREE.DirectionalLight(0x8fb0ff, 1.8); l.position.set(-120, 220, 80); group.add(l);
      tickFn = t => { moon.scale.setScalar(1 + 0.02 * Math.sin(t)); };
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
