import { esc } from './ui.js';

/* Taneční bitva: dva kostlivci vedle sebe, každý jiný tanec. Po 8 dobách se střídají; ten, který právě nepředvádí, tleská a pohupuje se. */
const TURN = 8, TURNS = 8;
const hype = u => {
  const s = Math.sin(Math.PI * u), d = 0.5 + 0.5 * Math.cos(Math.PI * 2 * u);
  return { kneeR: 18 + 14 * d, kneeL: 18 + 14 * d, hipFlexR: 12 + 8 * d, hipFlexL: 12 + 8 * d, lean: 8, hNod: 6 * d, hTilt: 5 * s, twist: 6 * s, flexR: 82 + 8 * s, flexL: 82 - 8 * s, abdR: 18, abdL: 18, elbXR: 100, elbXL: 100, wrXR: 10 * s, wrXL: -10 * s };
};

export function createBattle(core) {
  const { DANCES, music, blank, mix, sm, THREE, viewer, store } = core;
  let el, rig2 = null, shadow2 = null, st = null, finished = false;
  const GAP = 48;
  const opts = () => Object.entries(DANCES).filter(([, d]) => d.group !== 'custom').map(([id, d]) => `<option value="${id}">${d.emoji} ${esc(d.name)}</option>`).join('');
  const $ = s => el.querySelector(s);

  function wins() { return store.get('battleWins', {}); }
  function showWins() {
    const w = wins(), list = Object.entries(w).filter(([id]) => DANCES[id]).sort((a, b) => b[1] - a[1]).slice(0, 4);
    $('#bt-res').textContent = list.length ? 'Výhry: ' + list.map(([id, n]) => `${DANCES[id].name} ${n}×`).join(', ') : '';
  }
  function frameWide() {
    const c = core.rig.P.center, tanV = Math.tan(THREE.MathUtils.degToRad(viewer.camera.fov / 2)), asp = viewer.camera.aspect;
    const dist = Math.max(150 / tanV, 230 / (tanV * asp)) * 1.02;
    viewer._flyTo(new THREE.Vector3(0, c.y + 30, c.z + dist), new THREE.Vector3(0, c.y + 30, c.z), 700);
  }
  function build() {
    if (!rig2) {
      rig2 = core.cloneRig('#f59e0b');
      shadow2 = new THREE.Mesh(core.shadow.geometry, core.shadow.material.clone());
      shadow2.rotation.x = -Math.PI / 2; shadow2.renderOrder = -1; viewer.scene.add(shadow2);
    }
  }
  function teardown() {
    if (rig2) { rig2.dispose(); rig2 = null; }
    if (shadow2) { viewer.scene.remove(shadow2); shadow2.material.dispose(); shadow2 = null; }
    if (core.stage) core.stage.scale.setScalar(1);
  }
  function start() {
    core.stopDance(); build(); finished = false; $('#bt-vote').hidden = true;
    const A = $('#bt-a').value, B = $('#bt-b').value, dA = DANCES[A];
    core.stage.scale.setScalar(1.7); core.stage.material.color.set(dA.color);
    const delay = core.mcfg.on ? music.start(dA.song, 1) : 0, now = performance.now() / 1000;
    st = { A, B, startAt: now + delay, lastSec: now, playT: 0, turn: -1 };
    $('#bt-go').disabled = true; $('#bt-stop').disabled = false;
    frameWide(); viewer.requestRender();
  }
  function stop(done) {
    music.stop(0.4); core.setBadge('');
    const was = st; st = null;
    $('#bt-go').disabled = false; $('#bt-stop').disabled = true;
    if (done && was) { finished = true; $('#bt-vote').hidden = false; $('#bt-vote-q').textContent = `Kdo vyhrál? A: ${DANCES[was.A].name} · B: ${DANCES[was.B].name}`; vote.A = was.A; vote.B = was.B; }
    else if (core.rig) { core.applyRig(core.rig, blank(), -GAP); if (rig2) core.applyRig(rig2, blank(), GAP); }
    viewer.requestRender();
  }
  const vote = {};
  function onFrame(now) {
    if (!st) return undefined;
    const sec = now / 1000;
    if (sec >= st.startAt) st.playT += Math.min(0.1, sec - Math.max(st.lastSec, st.startAt));
    st.lastSec = sec;
    const dA = DANCES[st.A], dB = DANCES[st.B], u = st.playT / dA.B;
    if (u >= TURN * TURNS) { stop(true); return false; }
    const ph = u % (2 * TURN);
    const a = sm(0, 1, ph) * (1 - sm(TURN, TURN + 1, ph)), b = sm(TURN, TURN + 1, ph) * (1 - sm(2 * TURN - 1, 2 * TURN, ph));
    const tA = ((st.playT % dA.period) + dA.period) % dA.period, tB0 = st.playT * dB.bpm / dA.bpm, tB = ((tB0 % dB.period) + dB.period) % dB.period;
    const pA = mix({ ...blank(), ...hype(u) }, { ...blank(), ...dA.pose(tA) }, a), pB = mix({ ...blank(), ...hype(u + 0.5) }, { ...blank(), ...dB.pose(tB) }, b);
    pA.ry = (pA.ry || 0) + 22; pB.ry = (pB.ry || 0) - 22;
    core.applyRig(core.rig, pA, -GAP); core.applyRig(rig2, pB, GAP);
    const c = core.rig.P.center;
    core.shadow.position.x = c.x - GAP + pA.tx; core.shadow.position.z = c.z + pA.tz; core.shadow.scale.setScalar(1 / (1 + Math.max(0, pA.ty) / 60));
    shadow2.position.set(c.x + GAP + pB.tx, core.shadow.position.y, c.z + pB.tz); shadow2.scale.setScalar(1 / (1 + Math.max(0, pB.ty) / 60));
    const turn = Math.floor(u / TURN) % TURNS, who = turn % 2 ? 'B' : 'A';
    if (turn !== st.turn) { st.turn = turn; core.setBadge(`Kolo ${turn + 1}/${TURNS} · ${who}: ${DANCES[who === 'A' ? st.A : st.B].name}`, who === 'A' ? dA.color : dB.color); }
    return true;
  }

  return {
    id: 'battle', label: '⚔️ Bitva',
    mount(e) {
      el = e;
      el.innerHTML = `<p class="muted small">Dva kostlivci tančí proti sobě. Každý má svůj tanec a po 8 dobách se střídají. Ten, který zrovna nepředvádí, tleská a hecuje. Osm kol, hraje hudba tance A.</p>
        <label class="field"><span>Kostlivec A (vlevo, bílý)</span><select id="bt-a">${opts()}</select></label>
        <label class="field"><span>Kostlivec B (vpravo, oranžový)</span><select id="bt-b">${opts()}</select></label>
        <div class="row"><button class="btn primary grow" id="bt-go" type="button">⚔️ Začít bitvu</button><button class="btn" id="bt-stop" type="button" disabled>Zastavit</button></div>
        <div id="bt-vote" class="vote" hidden><p id="bt-vote-q"></p><div class="row"><button class="btn grow" type="button" data-v="A">👍 Vyhrál A</button><button class="btn grow" type="button" data-v="B">👍 Vyhrál B</button></div></div>
        <p class="muted small" id="bt-res"></p>`;
      $('#bt-a').value = 'hiphop'; $('#bt-b').value = 'breaking';
      $('#bt-go').onclick = start; $('#bt-stop').onclick = () => stop(false);
      $('#bt-vote').onclick = e2 => {
        const b = e2.target.closest('[data-v]'); if (!b) return;
        const w = wins(), id = vote[b.dataset.v]; w[id] = (w[id] || 0) + 1; store.set('battleWins', w); $('#bt-vote').hidden = true; showWins();
      };
      showWins();
    },
    enter() { showWins(); },
    leave() { if (st) { music.stop(0.2); core.setBadge(''); st = null; } $('#bt-go').disabled = false; $('#bt-stop').disabled = true; teardown(); },
    onFrame,
    cleanup() { st = null; teardown(); },
  };
}
