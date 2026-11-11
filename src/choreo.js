/* Choreografie tanců. Každý tanec je sled „frází“ (několik sekund pohybu), mezi kterými se plynule přechází.
   Fráze je funkce pose(tl), kde tl je čas od začátku fráze, a vrací úhly kloubů ve stupních (neuvedené = 0).
   Souřadnice: Y nahoru, +Z dopředu, pravá strana těla je -X. Kladné úhly: ruka a noha dopředu, koleno pokrčit, trup předklon,
   rx = celé tělo dopředu (kotoul, předklon na zem), ry = otočení kolem svislé osy, rz = náklon. */

const PI2 = Math.PI * 2;
export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pos = x => Math.max(0, x);
const pulse = (t, t0, tau) => (t >= t0 ? Math.exp(-(t - t0) / tau) * sm(0, 0.07, t - t0) : 0);     // úder v čase t0 (rychlý náběh, pak doznívání)
const rad = d => d * Math.PI / 180;

export const SIDES = ['R', 'L'];
const SIDE_KEYS = ['abd', 'flex', 'shTw', 'elbZ', 'elbX', 'wrZ', 'wrX', 'hipFlex', 'hipAbd', 'hipTw', 'knee', 'ankle'];
export const KEYS = ['tx', 'tz', 'ty', 'fz', 'rx', 'ry', 'rz', 'sp', 'pTilt', 'pTwist', 'pRoll', 'lean', 'twist', 'roll', 'hNod', 'hTurn', 'hTilt',
  ...SIDES.flatMap(s => SIDE_KEYS.map(k => k + s))];
export const blank = () => Object.fromEntries(KEYS.map(k => [k, 0]));
const ANGLE = new Set(['rx', 'ry', 'rz']);

// míchání póz: úhly otáčení celého těla jdou nejkratší cestou (360° = 0°)
export function mix(a, b, k) {
  const o = {};
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[key] || 0, y = b[key] || 0;
    if (ANGLE.has(key)) { const d = ((((y - x + 180) % 360) + 360) % 360) - 180; o[key] = x + d * k; }
    else o[key] = x + (y - x) * k;
  }
  return o;
}

// zrcadlo: pravá a levá strana se prohodí
export function mirror(p) {
  const o = { ...p };
  for (const k of SIDE_KEYS) {
    const twist = k === 'shTw' || k === 'hipTw' ? -1 : 1;
    const r = p[k + 'R'], l = p[k + 'L'];
    if (l !== undefined) o[k + 'R'] = l * twist; else delete o[k + 'R'];
    if (r !== undefined) o[k + 'L'] = r * twist; else delete o[k + 'L'];
  }
  for (const k of ['tx', 'ry', 'rz', 'pTwist', 'pRoll', 'twist', 'roll', 'hTurn', 'hTilt']) if (k in p) o[k] = -p[k];
  if ('sp' in p && Math.abs(p.sp) <= 1) o.sp = -p.sp;
  return o;
}

// sled póz se skokem v rytmu (popping, locking)
function mixSparse(a, b, k) { return mix(a, b, k); }
// list: pózy; u: čas v dobách; each: kolik dob trvá jedna póza; snap: za jak velkou část doby se k póze přeskočí
function stepped(list, u, each = 1, snap = 0.1) {
  const n = list.length, f = u / each, idx = Math.floor(f) % n, local = f - Math.floor(f);
  return { pose: mixSparse(list[(idx - 1 + n) % n], list[idx], sm(0, snap, local)), pop: Math.exp(-local * 9 / each), local };
}

// sestavení tance z fází: [{ n: název, d: délka, b: délka překrytí s další fází, p: pose(tl) }]
// Další fáze začíná běžet už b sekund před koncem předchozí a obě se plynule prolnou, takže pohyb nikdy neskočí.
export function sequence(phrases, { lag = 0.09, lagKeys = ['hNod', 'hTurn', 'hTilt', 'wrZR', 'wrZL', 'wrXR', 'wrXL'] } = {}) {
  const n = phrases.length, starts = []; let T = 0;
  for (const p of phrases) { starts.push(T); T += p.d - p.b; }
  const find = (t) => {
    t = ((t % T) + T) % T;
    let i = n - 1; for (let j = 0; j < n; j++) if (t < starts[j] + phrases[j].d - phrases[j].b) { i = j; break; }
    return { i, tl: t - starts[i] };
  };
  const raw = (t) => {
    const { i, tl } = find(t), cur = phrases[i], prev = phrases[(i - 1 + n) % n];
    const a = cur.p(tl);
    if (tl < prev.b) return mix(prev.p(prev.d - prev.b + tl), a, sm(0, 1, tl / prev.b));      // doznívání předchozí fáze
    return a;
  };
  const pose = (t) => {
    const p = raw(t);
    if (!lag) return p;
    const q = raw(t - lag);                                                                    // hlava a zápěstí zaostávají: přirozenější pohyb
    for (const k of lagKeys) if (k in q || k in p) p[k] = q[k] || 0;
    return p;
  };
  return { period: T, phrases, pose, phrase: (t, first = false) => { const { i, tl } = find(t), prev = phrases[(i - 1 + n) % n]; return ((!first || t >= T) && tl < prev.b * 0.5 ? prev : phrases[i]).n; } };
}

/* ====================== pomocné stavební prvky (čas v dobách u) ====================== */
const add = (a, b) => { const o = { ...a }; for (const k in b) o[k] = (o[k] || 0) + b[k]; return o; };
const bounce = (u, depth = 1, per = 1) => {
  const d = 0.5 + 0.5 * Math.cos(PI2 * u / per);
  return { kneeR: depth * (14 + 22 * d), kneeL: depth * (14 + 22 * d), hipFlexR: depth * (8 + 14 * d), hipFlexL: depth * (8 + 14 * d), ankleR: 5 * d, ankleL: 5 * d, lean: 6 + 7 * d, hNod: 6 * d };
};

/* ---------- zamávání (100 BPM) ---------- */
const waveR = u => {
  const env = sm(0, 0.9, u) * (1 - sm(3.1, 4, u)), w = Math.sin(PI2 * (u - 0.7) * 1.26) * env, sway = Math.sin(PI2 * u / 4), k = 5 + 3 * Math.sin(PI2 * u / 2);
  return {
    abdR: 8 + 92 * env, flexR: 10 * env, elbZR: 88 * env + 30 * w, elbXR: 8 * env, wrZR: 16 * w, abdL: 7 + 2 * sway, elbXL: 10, flexL: 4 * sway,
    hTilt: 7 * env, hTurn: -10 * env, hNod: -3 * env + 2 * Math.sin(PI2 * u / 2), roll: 2.5 * sway, twist: -4 * env, pRoll: -2 * sway, kneeR: k, kneeL: k, hipFlexR: k * 0.5, hipFlexL: k * 0.5, lean: 2,
  };
};
const waveBoth = u => {
  const env = sm(0, 0.8, u) * (1 - sm(3.2, 4, u)), w = Math.sin(PI2 * (u - 0.5) * 1.1) * env;
  return add(bounce(u, 0.6), {
    abdR: 8 + 145 * env, abdL: 8 + 145 * env, elbZR: 22 * w, elbZL: -22 * w, wrZR: 20 * w, wrZL: -20 * w, flexR: 5 * env, flexL: 5 * env,
    hTilt: 8 * Math.sin(PI2 * u / 2) * env, hNod: -8 * env, roll: 3 * Math.sin(PI2 * u / 2) * env,
  });
};
const bow = u => {
  const pres = sm(0, 0.8, u) * (1 - sm(1.2, 1.8, u)), bw = sm(1.5, 2.5, u) * (1 - sm(3.0, 3.8, u)), ta = sm(3.7, 4.3, u) * (1 - sm(4.7, 5.4, u));
  return {
    lean: 58 * bw - 4 * ta, hNod: 18 * bw - 8 * ta, kneeR: 10 * bw + 6, kneeL: 10 * bw + 6, hipFlexR: 4 * bw, hipFlexL: 4 * bw,
    abdR: 8 + 62 * pres + 135 * ta, abdL: 8 + 62 * pres + 135 * ta, flexR: 18 * pres + 25 * bw, flexL: 18 * pres + 25 * bw, elbXR: 10 + 20 * bw, elbXL: 10 + 20 * bw, hTilt: 5 * ta, elbZR: 10 * ta, elbZL: -10 * ta,
  };
};

/* ---------- skok (120 BPM) a salto ---------- */
// T = délka skoku v sekundách; o.spread rozkrok, o.tuck zkrčení, o.turn otočka ve vzduchu, o.h výška
const jumpPhrase = (T, o = {}) => tl => {
  const t = tl * 1.9 / T, spread = o.spread || 0, tuckK = o.tuck || 0.55, H = o.h || 52;
  const crouch = sm(0.0, 0.42, t) * (1 - sm(0.42, 0.56, t)) + 0.75 * sm(1.1, 1.2, t) * (1 - sm(1.2, 1.6, t));
  const u = Math.min(1, Math.max(0, (t - 0.56) / 0.55)), air = t >= 0.56 && t <= 1.11, tuck = air ? Math.sin(Math.PI * u) * tuckK : 0;
  const up = sm(0.4, 0.62, t) * (1 - sm(1.05, 1.35, t)), push = sm(0.4, 0.58, t) * (1 - sm(0.58, 0.9, t));
  const hip = 68 * crouch + 38 * tuck * (tuckK / 0.55), kn = 88 * crouch + 55 * tuck * (tuckK / 0.55), an = 30 * crouch - 28 * push - 10 * tuck;
  const arm = -28 * sm(0.05, 0.4, t) * (1 - sm(0.4, 0.5, t)), inAir = air ? Math.sin(Math.PI * u) : 0;
  return {
    ty: air ? 4 * H * u * (1 - u) : 0, fz: sm(0.5, 0.6, t) * (1 - sm(1.1, 1.2, t)), hipFlexR: hip, hipFlexL: hip, kneeR: kn, kneeL: kn, ankleR: an, ankleL: an, lean: 28 * crouch + 8 * tuck,
    flexR: arm + 40 * up * (spread ? 0.3 : 1), flexL: arm + 40 * up * (spread ? 0.3 : 1), abdR: 150 * up + 6, abdL: 150 * up + 6, elbXR: 10 + 25 * (1 - up), elbXL: 10 + 25 * (1 - up),
    hNod: -10 * up + 12 * crouch, hipAbdR: 4 * tuck + spread * inAir, hipAbdL: 4 * tuck + spread * inAir, ry: (o.turn || 0) * sm(0.56, 1.11, t),
  };
};
const flipPhrase = (dir) => tl => {
  const t = tl, c1 = sm(0.05, 0.5, t) * (1 - sm(0.5, 0.68, t)), u = Math.min(1, Math.max(0, (t - 0.7) / 1.1)), flight = t >= 0.7 && t <= 1.8;
  const tuck = flight ? sm(0.1, 0.3, u) * (1 - sm(0.68, 0.86, u)) : 0, land = sm(1.78, 1.9, t) * (1 - sm(1.9, 2.45, t));
  const cr = Math.max(c1, land * 0.8), up = sm(0.52, 0.72, t) * (1 - sm(1.35, 1.75, t)), push = sm(0.62, 0.72, t) * (1 - sm(0.85, 1.1, t));
  const hip = 75 * cr + 105 * tuck, kn = 95 * cr + 125 * tuck, flex = -45 * c1 + (1 - tuck) * 165 * up + 70 * tuck;
  return {
    ty: flight ? 4 * 65 * u * (1 - u) : 0, fz: sm(0.62, 0.72, t) * (1 - sm(1.76, 1.9, t)), rx: dir * 360 * sm(0.04, 0.92, u),
    hipFlexR: hip, hipFlexL: hip, kneeR: kn, kneeL: kn, ankleR: 30 * cr - 35 * push, ankleL: 30 * cr - 35 * push, lean: 30 * cr + 35 * tuck, flexR: flex, flexL: flex,
    abdR: 8, abdL: 8, elbXR: 80 * tuck + 10, elbXL: 80 * tuck + 10, hNod: 25 * tuck + 8 * c1,
  };
};
const flipPrep = u => {
  const s = Math.sin(PI2 * u / 2), d = 0.5 + 0.5 * Math.cos(PI2 * u / 2);
  return add(bounce(u, 0.9, 1), { flexR: 35 * s, flexL: -35 * s, elbXR: 40, elbXL: 40, abdR: 15, abdL: 15, lean: 4 * d, hNod: 3 });
};
const taDa = u => {
  const e = sm(0, 0.7, u) * (1 - sm(2.4, 3.2, u));
  return add(bounce(u, 0.4, 1), { abdR: 8 + 140 * e, abdL: 8 + 140 * e, hNod: -8 * e, lean: -3 * e, elbZR: 12 * Math.sin(PI2 * u) * e, elbZL: -12 * Math.sin(PI2 * u) * e });
};

/* ---------- šafl (133 BPM): running man, charleston, cabbage patch, pirueta ---------- */
const runningMan = u => {
  const s = Math.sin(Math.PI * u), bob = Math.abs(s);
  return {
    hipFlexR: 48 * pos(s) - 20 * pos(-s) + 10, hipFlexL: 48 * pos(-s) - 20 * pos(s) + 10, kneeR: 88 * pos(s) + 16, kneeL: 88 * pos(-s) + 16, ankleR: -10 * pos(-s), ankleL: -10 * pos(s),
    flexR: -38 * s, flexL: 38 * s, elbXR: 88, elbXL: 88, abdR: 10, abdL: 10, lean: 10, twist: 10 * s, roll: 3 * s, pRoll: -4 * s, pTwist: -6 * s, hNod: 4 + 5 * bob, hTurn: 6 * s,
  };
};
const charleston = u => {
  const s = Math.sin(Math.PI * u), a = Math.abs(s), w = Math.sin(PI2 * 1.5 * u);
  return {
    hipFlexR: 40 * pos(s) - 22 * pos(-s), kneeR: 18 + 42 * pos(-s), hipFlexL: 40 * pos(-s) - 22 * pos(s), kneeL: 18 + 42 * pos(s), hipAbdR: -10 * pos(s), hipAbdL: -10 * pos(-s), ankleR: 8 * pos(s), ankleL: 8 * pos(-s),
    flexR: 40 * s, flexL: -40 * s, abdR: 30 + 25 * a, abdL: 30 + 25 * a, elbXR: 28, elbXL: 28, wrZR: 25 * w, wrZL: -25 * w, pTwist: 10 * s, twist: -8 * s, hTilt: 7 * s, hNod: 3 * a, lean: 4,
  };
};
const cabbage = u => {
  const w = PI2 * u / 2;
  return add(bounce(u, 1.1), {
    pTilt: 8 * Math.sin(w), pRoll: 12 * Math.cos(w), twist: -8 * Math.cos(w), flexR: 60 + 40 * Math.sin(w), abdR: 28 + 20 * Math.cos(w), elbXR: 95,
    flexL: 60 + 40 * Math.sin(w + Math.PI), abdL: 28 + 20 * Math.cos(w + Math.PI), elbXL: 95, hTilt: 8 * Math.cos(w), hTurn: 8 * Math.sin(w),
  });
};
// pirueta: ry otáčky kolem opěrné nohy; beats = délka fráze v dobách, turns = počet otáček
const pirouette = (beats, supportRight = true, turns = 1) => u => {
  const sp = sm(0.8, beats - 0.9, u), prep = sm(0, 0.8, u) * (1 - sm(beats - 0.8, beats, u)), lift = sm(0.3, 1.1, u) * (1 - sm(beats - 1.1, beats - 0.3, u));
  const p = {
    ry: 360 * turns * sp * (supportRight ? 1 : -1), sp: supportRight ? -1 : 1, abdR: 14 + 6 * prep, abdL: 14 + 6 * prep, elbXR: 25 + 95 * prep, elbXL: 25 + 95 * prep, flexR: 40 * prep, flexL: 40 * prep,
    lean: 3, hNod: -2, kneeR: 12 + 4 * prep, kneeL: 12 + 4 * prep, hipFlexR: 8, hipFlexL: 8,
  };
  if (supportRight) { p.hipFlexL = 8 + 70 * lift; p.kneeL = 12 + 95 * lift; p.hipAbdL = 22 * lift; } else { p.hipFlexR = 8 + 70 * lift; p.kneeR = 12 + 95 * lift; p.hipAbdR = 22 * lift; }
  return p;
};

/* ---------- hip-hop (90 BPM): nízký, široký, pružný postoj, rocking, uvolněné paže přes tělo ---------- */
const hhBounce = u => {
  const d = 0.5 + 0.5 * Math.cos(PI2 * u), sway = Math.sin(PI2 * u / 2), pump = Math.sin(PI2 * u);
  return {
    kneeR: 26 + 26 * d, kneeL: 26 + 26 * d, hipFlexR: 16 + 16 * d, hipFlexL: 16 + 16 * d, hipAbdR: 9, hipAbdL: 9, ankleR: 7 * d, ankleL: 7 * d,
    lean: 10 + 10 * d, pRoll: 5 * sway, roll: -6 * sway, twist: 11 * sway, pTwist: -6 * sway,
    flexR: 40 + 32 * pump, flexL: 40 - 32 * pump, abdR: 6 - 20 * pos(pump), abdL: 6 - 20 * pos(-pump), elbXR: 88, elbXL: 88, wrXR: 14 * pump, wrXL: -14 * pump,
    hNod: 9 * d, hTilt: 7 * sway, hTurn: 10 * sway,
  };
};
const hhStep = u => {
  const s = Math.sin(PI2 * u / 4), d = 0.5 + 0.5 * Math.cos(PI2 * u);
  return add(hhBounce(u), {
    tx: -6 * s, hipAbdR: 20 * pos(s), hipAbdL: 20 * pos(-s), pRoll: 6 * s, roll: -8 * s, flexR: -10 * pos(s), flexL: -10 * pos(-s),
    abdR: 20 * pos(s), abdL: 20 * pos(-s), hTilt: 8 * s, hNod: 4 * d, twist: 7 * s,
  });
};
const hhRock = u => {
  const f = PI2 * u / 2;
  return add(hhBounce(u), {
    lean: 14 * Math.sin(f), pTilt: -8 * Math.sin(f), hNod: 8 * Math.sin(f - 0.8), flexR: 30 * Math.sin(f - 0.5), flexL: 30 * Math.sin(f - 0.5), abdR: 10 * Math.cos(f), abdL: 10 * Math.cos(f),
    kneeR: 8 * Math.sin(f), kneeL: -8 * Math.sin(f), pRoll: 3 * Math.sin(f),
  });
};
const hhRoll = u => {
  const f = PI2 * u / 2;
  return add(hhBounce(u), { pTilt: 16 * Math.sin(f), lean: 10 + 16 * Math.sin(f - 1.2), hNod: 14 * Math.sin(f - 2.4), twist: 8 * Math.sin(f - 0.6), flexR: 45 + 25 * Math.sin(f - 0.8), flexL: 45 + 25 * Math.sin(f - 0.8), abdR: 22, abdL: 22 });
};
const hhFreeze = u => {
  const sp = sm(1.0, 3.6, u), fr = sm(3.9, 4.5, u) * (1 - sm(7.0, 8, u));
  return add(hhBounce(u), {
    ry: 360 * sp, abdR: 35 * Math.sin(Math.PI * sp) + 140 * fr, abdL: 35 * Math.sin(Math.PI * sp), elbXR: -40 * fr, lean: -6 * fr, roll: -9 * fr, hTilt: 12 * fr, pRoll: 8 * fr, hipFlexR: 22 * fr, kneeR: 28 * fr, hNod: -8 * fr,
  });
};

/* ---------- popping (150 BPM): zpříma, ostré „hity“, geometrické paže, robot, moonwalk, vlna ---------- */
const robot = u => {
  const L = [
    { hTurn: 32, abdR: 8, abdL: 8, lean: 2 }, { hTurn: -32, abdR: 90, elbZR: 90, abdL: 8, twist: -12 }, { flexR: 90, elbXR: 90, flexL: 90, elbXL: 90, lean: 6, hNod: 12 },
    { hTurn: 35, abdL: 90, elbZL: 90, abdR: 12, twist: 12, hTilt: 10 }, { hTurn: -20, flexR: 90, abdR: 0, flexL: -40, twist: -15, lean: 3 }, { abdR: 90, abdL: 90, roll: 6, hNod: -6 },
    { hTurn: 20, abdR: 90, elbZR: 90, abdL: 90, elbZL: -90, roll: -5 }, { hNod: 15, hTurn: -35, flexR: 90, elbXR: 120, abdL: 10, roll: -6, twist: 8 },
  ];
  const { pose, pop } = stepped(L, u, 1, 0.07);
  return { ...pose, kneeR: 4 + 8 * pop, kneeL: 4 + 8 * pop, hipFlexR: 2 + 4 * pop, hipFlexL: 2 + 4 * pop, lean: (pose.lean || 0) + 5 * pop, hNod: (pose.hNod || 0) + 5 * pop, twist: (pose.twist || 0) + 3 * pop };
};
const moonwalk = u => {
  const f = PI2 * u / 2, a = Math.cos(f), b = -a, lr = pos(Math.sin(f)), ll = pos(-Math.sin(f));
  return {
    hipFlexR: 17 * a, hipFlexL: 17 * b, kneeR: 6 + 8 * lr, kneeL: 6 + 8 * ll, ankleR: -42 * lr + 4, ankleL: -42 * ll + 4, lean: -7, flexR: 14 * a, flexL: 14 * b, elbXR: 38, elbXL: 38, abdR: 10, abdL: 10,
    wrXR: -25, wrXL: -25, hTurn: 12 * Math.sin(f / 2), hNod: 5, roll: 3 * Math.sin(f), pRoll: -3 * Math.sin(f), twist: 5 * Math.sin(f),
  };
};
const armWave = u => {
  const f = PI2 * u / 4;
  return add(bounce(u, 0.5, 2), {
    abdR: 55 + 40 * Math.sin(f), elbZR: 35 * Math.sin(f - 0.9), wrZR: 30 * Math.sin(f - 1.8), flexR: 15, elbXR: 20,
    abdL: 55 + 40 * Math.sin(f - 2.6), elbZL: 35 * Math.sin(f - 3.5), wrZL: 30 * Math.sin(f - 4.4), flexL: 15, elbXL: 20,
    roll: 8 * Math.sin(f - 1.3), hTilt: 10 * Math.sin(f - 1.9), hTurn: 10 * Math.sin(f - 1.9), twist: 6 * Math.sin(f - 0.8),
  });
};
// tutting: úhlové „krabicové“ tvary rukama, každá doba nový tvar
const tutting = u => {
  const L = [
    { abdR: 90, elbZR: 90, abdL: 90, elbZL: 90, hTurn: 20 }, { flexR: 90, elbXR: 90, flexL: 90, elbXL: 90, hTurn: -20 }, { abdR: 170, abdL: 8, hTilt: 10, roll: 4 }, { abdL: 170, abdR: 8, hTilt: -10, roll: -4 },
    { flexR: 80, abdR: -22, elbXR: 100, flexL: 80, abdL: -22, elbXL: 100, hNod: 8 }, { abdR: 90, abdL: 90, hNod: -6 }, { abdR: 90, elbZR: 90, flexL: 90, elbXL: 90, hTurn: 25 }, { abdL: 90, elbZL: 90, flexR: 90, elbXR: 90, hTurn: -25 },
  ];
  const { pose, pop } = stepped(L, u, 1, 0.07);
  return { ...pose, kneeR: 4 + 6 * pop, kneeL: 4 + 6 * pop, lean: 3 * pop };
};

/* ---------- locking (120 BPM): zámky, ukazování, rotace zápěstí, kolena, stop-and-go ---------- */
const lockPoints = u => {
  const L = [
    { flexR: 95, abdR: 12, elbXL: 100, abdL: 25, flexL: 10, hTurn: -25, lean: 8, kneeR: 20, kneeL: 20, hipFlexR: 10, hipFlexL: 10, roll: 4 },
    { flexR: 90, flexL: 90, elbXR: 100, elbXL: 100, lean: 15, hNod: 10, kneeR: 30, kneeL: 30, hipFlexR: 20, hipFlexL: 20 },
    { hipFlexR: 75, kneeR: 120, ankleR: -40, hipFlexL: 40, kneeL: 70, lean: 20, flexR: -30, flexL: 60, elbXL: 90, hTurn: 30, roll: -5 },
    { abdL: 160, flexL: 10, abdR: 20, elbXR: 100, hTilt: -8, kneeR: 15, kneeL: 15, twist: 10, hTurn: 25 },
  ];
  const { pose, pop } = stepped(L, u, 2, 0.05), roll = Math.sin(PI2 * u * 1.25), c = Math.cos(PI2 * u * 1.25);
  return { ...pose, wrZR: 55 * roll, wrXR: 40 * c, wrZL: -55 * roll, wrXL: 40 * c, kneeR: (pose.kneeR || 0) + 8 * pop, kneeL: (pose.kneeL || 0) + 8 * pop, lean: (pose.lean || 0) + 5 * pop };
};
const scoobot = u => {
  const s = Math.sin(Math.PI * u), a = Math.abs(s), dn = sm(0, 0.8, u) * (1 - sm(7.2, 8, u));
  return {
    kneeR: 35 + 50 * dn - 15 * s * dn, kneeL: 35 + 50 * dn + 15 * s * dn, hipFlexR: 25 + 35 * dn + 10 * s, hipFlexL: 25 + 35 * dn - 10 * s, hipAbdR: 6 + 14 * pos(s), hipAbdL: 6 + 14 * pos(-s),
    lean: 22 * dn + 5, flexR: 55 * s * dn + 15, flexL: -55 * s * dn + 15, elbXR: 60 + 30 * pos(s), elbXL: 60 + 30 * pos(-s), abdR: 20, abdL: 20,
    pTwist: 10 * s, twist: -12 * s, hTurn: 14 * s, hNod: 6 * a, ankleR: 10 * pos(s), ankleL: 10 * pos(-s),
  };
};
const kneeDrop = u => {
  const dn = sm(1.2, 2.2, u) * (1 - sm(5.2, 6.4, u)), pre = sm(0, 1, u) * (1 - sm(1, 1.6, u)), pop = pulse(u, 6.4, 0.4) * sm(6.4, 6.5, u);
  return {
    hipFlexR: 8 + 5 * dn - 8 * pop, kneeR: 15 + 118 * dn, ankleR: -45 * dn, hipFlexL: 12 + 68 * dn, kneeL: 20 + 70 * dn, ankleL: 8 * dn, hipAbdR: 6 + 8 * dn, hipAbdL: 6 + 8 * dn,
    lean: 6 + 10 * dn - 6 * pre, flexR: -20 * dn + 40 * pre, flexL: 30 * dn + 40 * pre, abdR: 18 + 70 * dn, abdL: 18 + 70 * dn, elbXR: 20 + 60 * pre, elbXL: 60, hNod: 8 * dn, hTurn: 20 * dn, roll: -4 * dn,
  };
};

/* ---------- breaking (100 BPM): toprock, 6-step, stojka, windmill, headspin ---------- */
const toprock = u => {
  const ph = PI2 * u / 4, s = Math.sin(ph), c = Math.cos(ph), bob = 0.5 + 0.5 * Math.cos(2 * ph);
  return {
    lean: 24, kneeR: 30 + 14 * bob, kneeL: 30 + 14 * bob, hipAbdR: -24 * pos(s), hipAbdL: -24 * pos(-s), hipFlexR: 22 + 45 * pos(s), hipFlexL: 22 + 45 * pos(-s),
    flexR: -40 * s + 20, flexL: 40 * s + 20, elbXR: 75, elbXL: 75, abdR: 22, abdL: 22, twist: 16 * s, pTwist: -10 * s, roll: 4 * c, hNod: 5 * bob, hTurn: -10 * s, pRoll: 5 * s,
  };
};
const sixStep = u => {
  const dn = sm(0, 1.5, u), f = PI2 * (u - 1.2) / 4, on = sm(1.2, 2.0, u), kR = pos(Math.sin(f)) * on, kL = pos(Math.sin(f + Math.PI * 0.62)) * on;
  return {
    rx: 66 * dn, flexR: 66 * dn, flexL: 66 * dn, elbXR: 4 * dn, elbXL: 4 * dn, abdR: 10 * dn, abdL: 10 * dn, hNod: -52 * dn, hipFlexR: 70 * dn - 62 * kR, hipFlexL: 70 * dn - 62 * kL,
    kneeR: 98 * dn - 88 * kR, kneeL: 98 * dn - 88 * kL, hipAbdR: 10 * dn + 30 * kR, hipAbdL: 10 * dn + 30 * kL, ankleR: -25 * dn, ankleL: -25 * dn,
    twist: 16 * Math.sin(f) * on, pTwist: -10 * Math.sin(f) * on, lean: -8 * dn, hTurn: -12 * Math.sin(f) * on,
  };
};
const handstand = u => ({
  rx: 176, ry: 360 * sm(0.5, 2.8, u), flexR: 174, flexL: 174, abdR: 6, abdL: 6, hNod: -8, hipAbdR: 30, hipAbdL: 30, hipFlexR: 12, hipFlexL: 12, kneeR: 28, kneeL: 28, ankleR: -30, ankleL: -30, lean: -6, rz: 4 * Math.sin(PI2 * u / 2),
});
const windmill = u => {
  const yaw = 1800 * sm(1.3, 6.8, u), yr = rad(yaw);
  return { rx: -80, ry: yaw, rz: 22 * Math.sin(2 * yr), sp: 2, hipFlexR: 96, hipFlexL: 96, hipAbdR: 34, hipAbdL: 34, kneeR: 12, kneeL: 12, flexR: 52, flexL: 52, elbXR: 125, elbXL: 125, hNod: -28, lean: 6 };
};
const headspin = u => {
  const yaw = 2520 * sm(1.2, 6.4, u);
  return { rx: 177, ry: yaw, rz: 5 * Math.sin(PI2 * u / 1.5), hipAbdR: 32, hipAbdL: 32, hipFlexR: 12, hipFlexL: 12, kneeR: 22, kneeL: 22, flexR: 40, flexL: 40, elbXR: 130, elbXL: 130, ankleR: -25, ankleL: -25 };
};
const getUp = u => {
  const e = sm(0.6, 1.6, u) * (1 - sm(3.6, 4.6, u));
  return add(bounce(u, 0.5), { abdR: 8 + 142 * e, abdL: 12, elbZR: 12 * e, hTilt: 8 * e, hNod: -8 * e, lean: -3 * e, hipAbdL: 6 * e, roll: -3 * e, flexL: 25 * e, elbXL: 80 * e });
};

/* ---------- krump (120 BPM): široký nízký postoj, dupání, údery rukou, zášklby hrudníku ---------- */
const krumpStomp = u => {
  const lift = (a, b) => { const x = ((u % 4) + 4) % 4; return x >= a && x < b ? Math.pow(Math.sin(Math.PI * (x - a) / (b - a)), 0.7) : 0; };
  const x = ((u % 4) + 4) % 4, liftR = lift(0, 0.9), liftL = lift(2, 2.9);
  const H = pulse(x, 0.9, 0.2) + pulse(x, 1.9, 0.2) + pulse(x, 2.9, 0.2) + pulse(x, 3.9, 0.2);
  const up1 = sm(1, 1.5, x) * (1 - sm(1.64, 1.9, x)), up2 = sm(3, 3.44, x) * (1 - sm(3.6, 3.9, x)), hitA = pulse(x, 1.9, 0.24), hitB = pulse(x, 3.9, 0.24);
  return {
    kneeR: 34 + 100 * liftR + 22 * pulse(x, 0.9, 0.24), kneeL: 34 + 100 * liftL + 22 * pulse(x, 2.9, 0.24), hipFlexR: 22 + 76 * liftR, hipFlexL: 22 + 76 * liftL, hipAbdR: 20, hipAbdL: 20,
    ankleR: -10 * liftR, ankleL: -10 * liftL, lean: 26 - 24 * H, hNod: 14 - 18 * H, twist: 18 * Math.sin(PI2 * u / 4), roll: 5 * Math.sin(PI2 * u / 2),
    flexR: 40 + 110 * up1 - 50 * hitA + 60 * up2 - 45 * hitB, flexL: 40 + 110 * up1 - 50 * hitA, abdR: 22 + 40 * up2, abdL: 22, elbXR: 105 - 60 * up1, elbXL: 105 - 60 * up1,
    pRoll: 7 * Math.sin(PI2 * u / 2), hTilt: 10 * H, hTurn: 16 * Math.sin(PI2 * u / 4),
  };
};
const krumpChest = u => {
  const x = ((u % 1) + 1) % 1, H = pulse(x, 0, 0.2), f = PI2 * u / 4;
  return {
    kneeR: 44 + 12 * H, kneeL: 44 + 12 * H, hipFlexR: 32 + 8 * H, hipFlexL: 32 + 8 * H, hipAbdR: 24, hipAbdL: 24, lean: 22 - 26 * H, hNod: 10 - 16 * H,
    flexR: 40 + 95 * Math.sin(f) - 25 * H, flexL: 40 - 95 * Math.sin(f) - 25 * H, abdR: 28 + 32 * pos(Math.sin(f + 1.2)), abdL: 28 + 32 * pos(-Math.sin(f + 1.2)),
    elbXR: 98 - 45 * pos(Math.sin(f)), elbXL: 98 - 45 * pos(-Math.sin(f)), twist: 20 * Math.sin(f), pTwist: -12 * Math.sin(f), hTurn: 18 * Math.sin(f - 0.5), hTilt: 10 * H,
  };
};
const krumpBuck = u => {
  const sh = Math.sin(PI2 * u * 1.5), d = 0.5 + 0.5 * Math.cos(PI2 * u * 1.5), v = Math.sin(PI2 * u / 4);
  return {
    kneeR: 48 + 16 * d, kneeL: 48 + 16 * d, hipFlexR: 34 + 10 * d, hipFlexL: 34 + 10 * d, hipAbdR: 26, hipAbdL: 26, lean: 30, hNod: 16 * d,
    twist: 28 * sh, pTwist: -14 * sh, roll: 8 * sh, flexR: 34 + 22 * v, flexL: 34 - 22 * v, elbXR: 115, elbXL: 115, abdR: 38, abdL: 38, hTurn: 26 * sh, hTilt: 12 * sh,
  };
};
const krumpHop = u => {
  const ph = ((u % 2) + 2) % 2, hopU = Math.min(1, ph / 1.0), hop = ph < 1 ? 4 * 20 * hopU * (1 - hopU) : 0;
  const ar = sm(0, 0.8, ph) * (1 - sm(1.0, 1.6, ph)), H = pulse(ph, 1.0, 0.2);
  return {
    ty: hop, fz: sm(0.04, 0.24, ph) * (1 - sm(0.88, 1.04, ph)), kneeR: 42 + 16 * (1 - ar) + 26 * H, kneeL: 42 + 16 * (1 - ar) + 26 * H, hipFlexR: 30 + 14 * H, hipFlexL: 30 + 14 * H,
    hipAbdR: 18, hipAbdL: 18, lean: 24 - 20 * H, hNod: 14 - 18 * H, flexR: 30 + 130 * ar - 55 * H, flexL: 30 + 130 * ar - 55 * H, elbXR: 105 - 75 * ar, elbXL: 105 - 75 * ar, abdR: 20, abdL: 20,
    twist: 10 * Math.sin(PI2 * u / 4),
  };
};

/* ---------- Orange Justice (≈162 BPM, smyčka 16 dob): podle videa ----------
   1) zkřížené ruce před hrudí + točení špiček (twist), 2) široké švihy rukou do stran v širokém stoji,
   3) ruce nad hlavou a pumpování kolen, 4) hluboký výpad do strany se švihem paží, střídavě vpravo a vlevo. */
const ojCross = u => {
  const s = Math.sin(Math.PI * u), c = Math.cos(Math.PI * u), d = 0.5 + 0.5 * Math.cos(PI2 * u);
  return {
    kneeR: 36 + 10 * d, kneeL: 36 + 10 * d, hipFlexR: 20, hipFlexL: 20, hipAbdR: 12, hipAbdL: 12, hipTwR: 24 * s, hipTwL: 24 * s, pTwist: 26 * s, twist: -18 * s, lean: 12,
    flexR: 72 + 8 * s, flexL: 72 - 8 * s, abdR: -32 - 10 * s, abdL: -32 + 10 * s, elbXR: 100, elbXL: 100, wrXR: 14 * c, wrXL: -14 * c, hTurn: -14 * s, hNod: 6 * d, hTilt: 5 * c, roll: 3 * s,
    ty: 1.2 * d,
  };
};
const ojWide = u => {
  const s = Math.sin(Math.PI * u), d = 0.5 + 0.5 * Math.cos(PI2 * u);
  return {
    kneeR: 44 + 10 * d, kneeL: 44 + 10 * d, hipFlexR: 26, hipFlexL: 26, hipAbdR: 24, hipAbdL: 24, hipTwR: 12 * s, hipTwL: 12 * s, pTwist: 14 * s, pRoll: 6 * s, lean: 16, tx: -7 * s,
    abdR: 70 + 45 * s, abdL: 70 - 45 * s, flexR: 12 + 12 * pos(-s), flexL: 12 + 12 * pos(s), elbXR: 18 + 40 * pos(-s), elbXL: 18 + 40 * pos(s), wrZR: 18 * s, wrZL: 18 * s,
    hTilt: 9 * s, hNod: 6 * d, twist: -12 * s,
  };
};
const ojUp = u => {
  const s = Math.sin(Math.PI * u), d = 0.5 + 0.5 * Math.cos(PI2 * u), ar = sm(0, 0.8, u) * (1 - sm(3.6, 4, u) * 0.0);
  return {
    kneeR: 32 + 14 * d, kneeL: 32 + 14 * d, hipFlexR: 18, hipFlexL: 18, hipAbdR: 14, hipAbdL: 14, hipTwR: 14 * s, hipTwL: 14 * s, pTwist: 12 * s, lean: 4, ty: 2 * d,
    abdR: 20 + 125 * ar, abdL: 20 + 125 * ar, flexR: 20 + 20 * ar + 14 * s, flexL: 20 + 20 * ar - 14 * s, elbXR: 25 + 30 * pos(s) * ar, elbXL: 25 + 30 * pos(-s) * ar,
    wrZR: 28 * s, wrZL: -28 * s, hNod: -6 * ar, hTilt: 7 * s, roll: 3 * s,
  };
};
const ojLunge = u => {
  const w = Math.sin(Math.PI * u / 2), R = pos(w), L = pos(-w), a = Math.abs(w), s = Math.sin(Math.PI * u);
  return {
    tx: -16 * w, ty: 0, kneeR: 40 + 20 * R - 12 * L, kneeL: 40 + 20 * L - 12 * R, hipFlexR: 24, hipFlexL: 24, hipAbdR: 24 + 6 * R - 4 * L, hipAbdL: 24 + 6 * L - 4 * R,
    pRoll: -8 * w, roll: 10 * w, lean: 14 + 8 * a, pTwist: -16 * w, twist: 14 * w, rz: 0,
    abdR: 40 + 70 * R - 10 * L, abdL: 40 + 70 * L - 10 * R, flexR: 30 + 30 * L, flexL: 30 + 30 * R, elbXR: 40 + 20 * L, elbXL: 40 + 20 * R, wrZR: 20 * s, wrZL: -20 * s,
    hTilt: 14 * w, hNod: 8 * a, hTurn: -10 * w,
  };
};
const ojFinal = u => {
  const k = sm(0.3, 1.4, u), d = 0.5 + 0.5 * Math.cos(PI2 * u);
  return {
    kneeR: 30 - 12 * k + 10 * d * (1 - k), kneeL: 30 - 12 * k + 10 * d * (1 - k), hipFlexR: 16, hipFlexL: 16, hipAbdR: 20 * k, hipAbdL: 20 * k, lean: -6 * k,
    abdR: 20 + 125 * k, abdL: 20 + 125 * k, elbXR: 30 * (1 - k), elbXL: 30 * (1 - k), flexR: 25, flexL: 25, hNod: -10 * k, hTilt: 8 * k * Math.sin(PI2 * u / 2), ty: 3 * Math.sin(PI2 * u / 2) * k,
  };
};

/* ---------- Afro (afrobeats, 104 BPM): Shaku Shaku, Azonto, Gwara Gwara a Zanku ---------- */
const afShaku = u => {   // malé rychlé krůčky, pokrčená kolena, předklon a prudké kmitání pokrčených paží vpřed a vzad
  const s = Math.sin(Math.PI * u), c = Math.cos(Math.PI * u), d = 0.5 + 0.5 * Math.cos(PI2 * u * 2), s2 = Math.sin(PI2 * u * 2);
  return {
    kneeR: 34 + 22 * pos(s), kneeL: 34 + 22 * pos(-s), hipFlexR: 22 + 22 * pos(s), hipFlexL: 22 + 22 * pos(-s), hipAbdR: 8, hipAbdL: 8,
    tx: -4 * s, ty: 1.5 * d, pRoll: 5 * s, roll: -4 * s, lean: 20, pTwist: -10 * s, twist: 10 * s,
    flexR: 40 + 55 * s, flexL: 40 - 55 * s, elbXR: 95 + 15 * c, elbXL: 95 - 15 * c, abdR: 14, abdL: 14, shTwR: 20 * c, shTwL: -20 * c, wrXR: 18 * s2, wrXL: -18 * s2,
    hNod: 8 - 6 * d, hTilt: 6 * s, hTurn: 10 * s,
  };
};
const afAzonto = u => {  // volný groove, pantomima rukou u obličeje („telefon“, „česání“), pohyb boků a švih bérce dozadu
  const s = Math.sin(Math.PI * u), c = Math.cos(Math.PI * u), d = 0.5 + 0.5 * Math.cos(PI2 * u), q = Math.sin(PI2 * u / 4);
  return {
    kneeR: 30 + 10 * d + 55 * pulse(((u % 2) + 2) % 2, 1, 0.14), kneeL: 30 + 10 * d, hipFlexR: 18 - 14 * pulse(((u % 2) + 2) % 2, 1, 0.14), hipFlexL: 18,
    tx: 6 * q, ty: 1.2 * d, pRoll: 8 * s, roll: -6 * s, pTwist: 14 * s, twist: -10 * s, lean: 10 + 4 * d,
    flexR: 105 + 15 * c, elbXR: 120 - 20 * c, abdR: 18, shTwR: -30, wrZR: 18 * s,
    flexL: 45 - 40 * s, elbXL: 80 + 40 * pos(s), abdL: 28 + 22 * pos(-s), wrZL: -14 * c,
    hTilt: 14 * s, hTurn: 14 * c, hNod: 6 * d,
  };
};
const afGwara = u => {   // široký podřep, váha na jedné noze, druhá noha švihá, paže kreslí oblouk přes tělo
  const w = Math.sin(Math.PI * u / 2), R = pos(w), L = pos(-w), a = Math.abs(w), s = Math.sin(Math.PI * u);
  return {
    tx: -10 * w, kneeR: 48 + 12 * R - 6 * L, kneeL: 48 + 12 * L - 6 * R, hipFlexR: 38 + 14 * R, hipFlexL: 38 + 14 * L, hipAbdR: 26 + 8 * R, hipAbdL: 26 + 8 * L,
    lean: 24, pRoll: 6 * w, roll: -8 * w, pTwist: -22 * w, twist: 16 * w,
    flexR: 40 + 70 * L - 10 * R, abdR: 24 + 60 * L, elbXR: 50 + 40 * R, flexL: 40 + 70 * R - 10 * L, abdL: 24 + 60 * R, elbXL: 50 + 40 * L,
    shTwR: 25 * w, shTwL: 25 * w, wrZR: 16 * s, wrZL: 16 * s, hTilt: 10 * w, hNod: 8 * a, hTurn: -12 * w,
  };
};
const afZanku = u => {   // rychlé nohy (legwork): střídavé kopy a švihy bérců na půldobu, paže volně mávají
  const x = ((u % 1) + 1) % 1, k = Math.sin(PI2 * u), s = Math.sin(Math.PI * u), hop = 3 * Math.sin(Math.PI * ((u * 2) % 1));
  const fR = pos(Math.sin(PI2 * u)), fL = pos(-Math.sin(PI2 * u));
  return {
    ty: hop, kneeR: 28 + 62 * fR, kneeL: 28 + 62 * fL, hipFlexR: 24 + 38 * fR, hipFlexL: 24 + 38 * fL, hipAbdR: 10 + 12 * fR, hipAbdL: 10 + 12 * fL,
    tx: 5 * s, pRoll: 8 * k, roll: -6 * k, pTwist: 14 * k, twist: -12 * k, lean: 12,
    flexR: 60 + 40 * k, flexL: 60 - 40 * k, elbXR: 80 + 30 * k, elbXL: 80 - 30 * k, abdR: 22, abdL: 22, wrXR: 26 * Math.sin(PI2 * u * 2), wrXL: -26 * Math.sin(PI2 * u * 2),
    hNod: 8, hTilt: 8 * k,
  };
};
const afPose = u => {
  const k = sm(0.2, 1.2, u), s2 = Math.sin(PI2 * u * 2);
  return {
    kneeR: 24, kneeL: 24 + 12 * k, hipFlexR: 12, hipFlexL: 12 + 6 * k, hipAbdR: 14, hipAbdL: 14, lean: 4, roll: 6 * k, pRoll: 6 * k,
    abdR: 20 + 120 * k, abdL: 20 + 120 * k, elbXR: 40 * (1 - k) + 18, elbXL: 40 * (1 - k) + 18, flexR: 20, flexL: 20, shTwR: 20 * s2 * k, shTwL: -20 * s2 * k, hTilt: 10 * k, hNod: -6 * k,
    ty: 1.5 * Math.abs(s2) * k,
  };
};

/* ====================== tance ====================== */
function dance(o, build) {
  const B = 60 / o.bpm, P = (n, beats, fn, blend = 1) => ({ n, d: beats * B, b: blend * B, p: tl => fn(tl / B, tl) });
  return { ...o, B, ...sequence(build(P, B), { lag: o.lag ?? 0.09 }) };
}
export const DANCES = {
  wave: dance({ group: 'basic', name: 'Zamávání', emoji: '👋', bpm: 100, song: 'wave', color: '#60a5fa', lag: 0.1,
    info: 'Pozdrav v několika fázích: mávání pravou, levou, oběma rukama a nakonec úklona.', tell: 'veselé mávání a úklona' },
  (P) => [P('Zamávání pravou', 4, waveR), P('Zamávání levou', 4, u => mirror(waveR(u))), P('Obě ruce', 4, waveBoth), P('Úklona', 8, u => bow(u * 0.75))]),
  jump: dance({ group: 'basic', name: 'Skok', emoji: '🦘', bpm: 120, song: 'jump', color: '#34d399', lag: 0.06,
    info: 'Série skoků: obyčejný, s rozkrokem, se zkrčením a s otočkou o 360 stupňů.', tell: 'výskoky a změny ve vzduchu' },
  (P, B) => [P('Skok', 4, (u, tl) => jumpPhrase(4 * B)(tl), 1), P('Skok s rozkrokem', 4, (u, tl) => jumpPhrase(4 * B, { spread: 28, h: 56 })(tl), 1), P('Skok se zkrčením', 4, (u, tl) => jumpPhrase(4 * B, { tuck: 1.0, h: 58 })(tl), 1),
    P('Skok s otočkou', 4, (u, tl) => jumpPhrase(4 * B, { turn: 360, h: 58 })(tl), 1), P('Odpočinek', 5, u => bounce(u, 0.4, 1), 1)]),
  backflip: dance({ group: 'basic', name: 'Backflip', emoji: '🤸', bpm: 120, song: 'backflip', color: '#f472b6', lag: 0.05,
    info: 'Rozběh, salto vzad, pózování a pak salto vpřed.', tell: 'salta ve vzduchu' },
  (P) => [P('Příprava', 7, flipPrep), P('Salto vzad', 6, (u, tl) => flipPhrase(-1)(tl)), P('Pózování', 4, taDa), P('Příprava', 3, flipPrep), P('Salto vpřed', 6, (u, tl) => flipPhrase(1)(tl)), P('Pózování', 4, taDa)]),
  shuffle: dance({ group: 'basic', name: 'Šafl', emoji: '🕺', bpm: 133.33, song: 'shuffle', color: '#2dd4bf',
    info: 'Running man, charleston, cabbage patch a otočka na jedné noze (hudba ve stylu house, ke které se šafl tančí).', tell: 'střídání nohou jako při běhu' },
  (P) => [P('Running man', 8, runningMan), P('Charleston', 8, charleston), P('Cabbage patch', 8, cabbage), P('Otočka', 5, pirouette(5, true, 1)), P('Running man', 4, runningMan)]),
  hiphop: dance({ group: 'street', name: 'Hip-hop', emoji: '🎤', bpm: 90, song: 'hiphop', color: '#f59e0b',
    info: 'Hip-hop vznikl v 70. letech v newyorském Bronxu spolu s hudbou stejného jména. Základem je „bounce“: rytmické pohupování v kolenou na každou dobu a uvolněný „groove“ hrudníku a ramen. Sestava: bounce, step, rocking, vlna tělem a otočka s pózou.',
    tell: 'nízký široký postoj, pružení v kolenou, paže se houpou přes tělo' },
  (P) => [P('Bounce', 8, hhBounce), P('Step a švih rukou', 8, hhStep), P('Rocking', 8, hhRock), P('Vlna tělem', 8, hhRoll), P('Otočka s pózou', 9, hhFreeze)]),
  popping: dance({ group: 'street', name: 'Popping', emoji: '🤖', bpm: 150, song: 'popping', color: '#22d3ee', lag: 0,
    info: 'Popping vznikl v 70. letech v Kalifornii (Fresno, Oakland). Tanečník v rytmu prudce stahuje svaly („pop“ nebo „hit“) a mezi údery drží pózu. Sestava: robot, moonwalk, vlna rukama a tutting.',
    tell: 'zpříma, ostré zásahy a geometrické paže v pravých úhlech' },
  (P) => [P('Robot', 8, robot), P('Moonwalk', 8, moonwalk), P('Vlna rukama', 8, armWave), P('Tutting', 8, tutting)]),
  locking: dance({ group: 'street', name: 'Locking', emoji: '🔒', bpm: 120, song: 'locking', color: '#facc15', lag: 0.04,
    info: 'Locking vznikl koncem 60. let v Los Angeles (Don Campbell, skupina The Lockers). „Lock“ je náhlé zastavení pohybu a podržení pózy. Typické je ukazování, rotace zápěstí a pád na koleno. Sestava: zámky, scoobot, pád na koleno a otočka.',
    tell: 'náhlé zastavení v pozici, ukazování prstem a kroužící zápěstí' },
  (P) => [P('Zámky a ukazování', 8, lockPoints), P('Scoobot', 8, scoobot), P('Pád na koleno', 8, kneeDrop), P('Otočka', 8, pirouette(8, false, 2))]),
  breaking: dance({ group: 'street', name: 'Breaking', emoji: '🌀', bpm: 100, song: 'breaking', color: '#ef4444', lag: 0.07,
    info: 'Breaking (breakdance) vznikl v 70. letech v Bronxu na parties, kde DJ Kool Herc prodlužoval „break“. Sestava: toprock ve stoje, 6-step na zemi, stojka na rukou, windmill na zádech, headspin na hlavě a vstávání. V roce 2024 byl poprvé na olympijských hrách.',
    tell: 'tanec na zemi: ruce, záda i hlava se opírají o podlahu a tělo se točí' },
  (P) => [P('Toprock', 8, toprock, 2), P('6-step', 8, sixStep, 2), P('Stojka na rukou', 5, handstand, 2), P('Windmill', 9, windmill, 2), P('Headspin', 8, headspin, 2), P('Vstávání a póza', 5, getUp, 1)]),
  krump: dance({ group: 'street', name: 'Krump', emoji: '💥', bpm: 120, song: 'krump', color: '#a855f7', lag: 0.03,
    info: 'Krump vznikl na začátku 2000. let v South Central v Los Angeles. Je to expresivní, silový tanec plný úderů rukama, dupání a prudkých zášklbů hrudníku. Sestava: dupnutí, údery hrudníku, „buck“ a poskoky.',
    tell: 'nízký agresivní postoj, dupání, prudké údery rukou a hrudníku' },
  (P) => [P('Dupnutí', 8, krumpStomp), P('Údery hrudníku', 8, krumpChest), P('Buck', 8, krumpBuck), P('Poskoky', 8, krumpHop)]),
  orange: dance({ group: 'pop', name: 'Orange Justice', emoji: '🍊', bpm: 162, song: 'orange', color: '#fb923c', lag: 0.05,
    info: 'Orange Justice je taneční „emote“ z Fortnite (2018), který vznikl z internetového tance „Dance Like Nobody’s Watching“. Smyčka má čtyři části po čtyřech dobách: zkřížené ruce před hrudí s točením špiček, široké švihy paží ve výrazném rozkroku, ruce nad hlavou a pumpování kolen a hluboký výpad do strany se švihem paží. Sestava je podle videa, které jsi poslal, ale je to zjednodušená stylizace kostry. Hudba je moje originální skladba, ne původní nahrávka.',
    tell: 'zkřížené ruce na hrudi, točení špiček, široké švihy paží a hluboké výpady do stran' },
  (P) => {
    const loop = [['Zkřížené ruce a twist', ojCross], ['Široké švihy paží', ojWide], ['Ruce nad hlavou', ojUp], ['Výpad do strany', ojLunge]];
    return [...loop, ...loop, ...loop].map(([n, f]) => P(n, 4, f, 0.7)).concat([P('Finální póza', 5, ojFinal, 0.7)]);
  }),
  afro: dance({ group: 'pop', name: 'Afro', emoji: '🌍', bpm: 104, song: 'afro', color: '#eab308', lag: 0.05,
    info: 'Afro dance (afrobeats) vznikl v západní Africe, hlavně v Nigérii a Ghaně, a v 2010s se rozšířil světem. Sestava skládá čtyři slavné kroky: Shaku Shaku (malé kroky v předklonu a pokrčené paže, Nigérie), Azonto (volný groove s pantomimou rukou, Ghana), Gwara Gwara (široký podřep, švih nohy a paže v oblouku, Jižní Afrika) a Zanku (rychlé nohy, tzv. legwork). Je to zjednodušená stylizace kostry podle popisů těchto kroků, hudba je moje originální afrobeats skladba.',
    tell: 'uvolněný předklon, kroky v pokrčených kolenou, pantomima rukou a rychlé nohy' },
  (P) => [P('Shaku Shaku', 8, afShaku), P('Azonto', 8, afAzonto), P('Gwara Gwara', 8, afGwara), P('Zanku', 8, afZanku), P('Shaku Shaku', 8, afShaku), P('Azonto', 8, afAzonto), P('Gwara Gwara', 8, afGwara), P('Zanku', 8, afZanku), P('Póza', 5, afPose)]),
};

/* vlastní choreografie: seznam [id tance, číslo fráze] se přepočítá na tempo vybrané skladby */
export function customDance(items, bpm, song, name = 'Moje choreografie') {
  const B = 60 / bpm, list = [];
  for (const [id, i] of items) {
    const src = DANCES[id], ph = src?.phrases?.[i]; if (!ph) continue;
    const sc = bpm / src.bpm;                                   // kolikrát rychleji se má původní fráze přehrát
    list.push({ n: ph.n, d: ph.d / sc, b: Math.min(Math.max(ph.b / sc, B * 0.75), ph.d / sc * 0.6), p: tl => ph.p(tl * sc) });
  }
  if (!list.length) return null;
  return { group: 'custom', name, emoji: '🧩', bpm, B, song, color: '#a3e635', lag: 0.05, info: 'Tvoje vlastní sestava složená z hotových kroků.', tell: '', ...sequence(list, { lag: 0.05 }) };
}
