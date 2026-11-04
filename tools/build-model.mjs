// STL (BodyParts3D) -> jediný GLB, kde každá kost je samostatný node/mesh pojmenovaný FMA id.
// Použití: node tools/build-model.mjs <složka_se_STL> [poměr_zjednodušení]
import fs from 'node:fs';
import path from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { MeshoptSimplifier } from 'meshoptimizer';

const dir = process.argv[2];
const RATIO = parseFloat(process.argv[3] ?? '0.25');
if (!dir) { console.error('Chybí složka se STL soubory'); process.exit(1); }
const sources = JSON.parse(fs.readFileSync(new URL('./bone-sources.json', import.meta.url)));
await MeshoptSimplifier.ready;

// BodyParts3D: mm, Z nahoru, předek = -Y, pravá strana = -X.
// Cílově: cm, Y nahoru, předek = +Z, pravá strana = -X (pohled zepředu). Rotace bez zrcadlení.
const SCALE = 0.1;
const tf = (x, y, z) => [x * SCALE, z * SCALE, -y * SCALE];

function readStl(file) {
  const b = fs.readFileSync(file);
  const n = b.readUInt32LE(80);
  const map = new Map(); const pos = []; const idx = new Uint32Array(n * 3);
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12;
    for (let v = 0; v < 3; v++) {
      const x = b.readFloatLE(o + v * 12), y = b.readFloatLE(o + v * 12 + 4), z = b.readFloatLE(o + v * 12 + 8);
      const key = `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
      let i = map.get(key);
      if (i === undefined) { i = pos.length / 3; map.set(key, i); pos.push(x, y, z); }
      idx[t * 3 + v] = i;
    }
  }
  // zahodit degenerované trojúhelníky
  const keep = [];
  for (let t = 0; t < n; t++) {
    const a = idx[t * 3], c = idx[t * 3 + 1], d = idx[t * 3 + 2];
    if (a !== c && c !== d && a !== d) keep.push(a, c, d);
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(keep) };
}

function compact(pos, idx) {
  const remap = new Int32Array(pos.length / 3).fill(-1); const out = []; let n = 0;
  const ni = new Uint32Array(idx.length);
  for (let i = 0; i < idx.length; i++) {
    const v = idx[i];
    if (remap[v] < 0) { remap[v] = n++; out.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]); }
    ni[i] = remap[v];
  }
  return { pos: new Float32Array(out), idx: ni };
}

function normals(pos, idx) {
  const nrm = new Float32Array(pos.length);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // vážení plochou
    for (const k of [a, b, c]) { nrm[k] += nx; nrm[k + 1] += ny; nrm[k + 2] += nz; }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const l = Math.hypot(nrm[i], nrm[i + 1], nrm[i + 2]) || 1;
    nrm[i] /= l; nrm[i + 1] /= l; nrm[i + 2] /= l;
  }
  return nrm;
}

// 1. průchod: načtení + zjednodušení + transformace
const bones = [];
let triIn = 0, triOut = 0;
for (const s of sources) {
  const f = path.join(dir, `${s.id}.stl`);
  let { pos, idx } = readStl(f);
  triIn += idx.length / 3;
  const target = Math.max(300 * 3, Math.floor(idx.length * RATIO / 3) * 3);
  if (idx.length > target) {
    const [simp] = MeshoptSimplifier.simplify(idx, pos, 3, target, 0.02, []);
    ({ pos, idx } = compact(pos, simp));
  } else ({ pos, idx } = compact(pos, idx));
  const p = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { const [x, y, z] = tf(pos[i], pos[i + 1], pos[i + 2]); p[i] = x; p[i + 1] = y; p[i + 2] = z; }
  triOut += idx.length / 3;
  bones.push({ id: s.id, pos: p, idx });
}

// vystředění celé kostry na počátek (X, Z podle středu, Y podle chodidel -> 0 uprostřed výšky)
let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
for (const b of bones) for (let i = 0; i < b.pos.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b.pos[i + k]); mx[k] = Math.max(mx[k], b.pos[i + k]); }
const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
console.log('rozměry (cm):', mx.map((v, k) => +(v - mn[k]).toFixed(1)), 'střed:', c.map(v => +v.toFixed(1)));

// ---- barvy pro režim „rozlišený“: obarvení grafu sousedních kostí ----
// Pravá strana = teplé odstíny, levá = studené, střed = zelené/fialové. Sousední kosti nikdy nemají stejnou barvu.
const bonesMeta = JSON.parse(fs.readFileSync(new URL('../src/data/bones.json', import.meta.url)));
const sideById = new Map(bonesMeta.map(b => [b.id, b.side]));
const CELL = 0.5; // cm, kosti blíž než tato vzdálenost vrcholů jsou „sousední“
const grid = new Map();
const cellKey = (x, y, z) => `${x},${y},${z}`;
bones.forEach((b, bi) => {
  for (let i = 0; i < b.pos.length; i += 3) {
    const k = cellKey(Math.floor(b.pos[i] / CELL), Math.floor(b.pos[i + 1] / CELL), Math.floor(b.pos[i + 2] / CELL));
    let set = grid.get(k); if (!set) grid.set(k, set = new Set()); set.add(bi);
  }
});
const adj = bones.map(() => new Set());
for (const [k, set] of grid) {
  const [x, y, z] = k.split(',').map(Number);
  const near = new Set(set);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const o = grid.get(cellKey(x + dx, y + dy, z + dz)); if (o) o.forEach(v => near.add(v));
  }
  for (const a of set) for (const b of near) if (a !== b) { adj[a].add(b); adj[b].add(a); }
}
const POOLS = {
  pravá: [[0, 78, 52], [24, 92, 52], [46, 95, 50], [338, 72, 56], [12, 55, 34], [30, 70, 72], [62, 80, 44], [352, 95, 78]],
  levá: [[215, 78, 56], [190, 88, 44], [248, 70, 66], [205, 85, 76], [226, 86, 34], [172, 68, 38], [260, 85, 50], [200, 60, 30]],
  střední: [[100, 62, 46], [135, 50, 36], [76, 68, 56], [285, 55, 52], [265, 50, 72], [160, 45, 66], [305, 45, 38], [120, 70, 66]],
};
const hsl2hex = ([h, s, l]) => {
  s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
  const f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const colorOf = new Array(bones.length).fill(-1);
// DSatur: vždy nejdřív kost s nejvíc už obarvenými sousedy ve stejném poolu
const order = bones.map((_, i) => i);
const pool = i => sideById.get(bones[i].id);
const remaining = new Set(order);
while (remaining.size) {
  let best = -1, bestSat = -1, bestDeg = -1;
  for (const i of remaining) {
    const used = new Set([...adj[i]].filter(j => pool(j) === pool(i) && colorOf[j] >= 0).map(j => colorOf[j]));
    const deg = [...adj[i]].filter(j => pool(j) === pool(i)).length;
    if (used.size > bestSat || (used.size === bestSat && deg > bestDeg)) { best = i; bestSat = used.size; bestDeg = deg; }
  }
  const used = new Set([...adj[best]].filter(j => pool(j) === pool(best) && colorOf[j] >= 0).map(j => colorOf[j]));
  let c = 0; while (used.has(c)) c++;
  colorOf[best] = c; remaining.delete(best);
}
const palette = POOLS;
let maxC = 0; colorOf.forEach(c => maxC = Math.max(maxC, c));
if (maxC >= 8) console.warn('Pozor: potřeba více než 8 barev v poolu:', maxC + 1);
const colors = {};
bones.forEach((b, i) => { colors[b.id] = hsl2hex(palette[pool(i)][colorOf[i] % 8]); });
fs.writeFileSync(new URL('../src/data/colors.json', import.meta.url), JSON.stringify(colors));
console.log('barev v poolu max:', maxC + 1, '| sousedních dvojic:', adj.reduce((n, s) => n + s.size, 0) / 2);

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('kostra'); doc.getRoot().setDefaultScene(scene);
for (const b of bones) {
  for (let i = 0; i < b.pos.length; i += 3) { b.pos[i] -= c[0]; b.pos[i + 1] -= c[1]; b.pos[i + 2] -= c[2]; }
  const nrm = normals(b.pos, b.idx);
  const P = doc.createAccessor().setType('VEC3').setArray(b.pos).setBuffer(buffer);
  const N = doc.createAccessor().setType('VEC3').setArray(nrm).setBuffer(buffer);
  const I = doc.createAccessor().setType('SCALAR').setArray(b.pos.length / 3 < 65536 ? new Uint16Array(b.idx) : b.idx).setBuffer(buffer);
  const prim = doc.createPrimitive().setAttribute('POSITION', P).setAttribute('NORMAL', N).setIndices(I);
  const mesh = doc.createMesh(b.id).addPrimitive(prim);
  scene.addChild(doc.createNode(b.id).setMesh(mesh));
}
const io = new NodeIO();
const out = new URL('../public/models/kostra.glb', import.meta.url).pathname;
fs.mkdirSync(path.dirname(out), { recursive: true });
await io.write(out, doc);
console.log(`kostí: ${bones.length}, trojúhelníků ${triIn} -> ${triOut}, soubor ${(fs.statSync(out).size / 1048576).toFixed(2)} MB`);
