/* Choreografie tanců. Každý tanec je sled „frází“ (několik sekund pohybu), mezi kterými se plynule přechází.
   Fráze je funkce pose(tl), kde tl je čas od začátku fráze, a vrací úhly kloubů ve stupních (neuvedené = 0).
   Souřadnice: Y nahoru, +Z dopředu, pravá strana těla je -X. Kladné úhly: ruka a noha dopředu, koleno pokrčit, trup předklon,
   rx = celé tělo dopředu (kotoul, předklon na zem), ry = otočení kolem svislé osy, rz = náklon. */

const PI2 = Math.PI * 2;
export const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const pos = x => Math.max(0, x);
const pulse = (t, t0, tau) => (t >= t0 ? Math.exp(-(t - t0) / tau) : 0);     // doznívající úder v čase t0
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
function stepped(list, t, T, snap = 0.12) {
  const n = list.length, hit = T / n, idx = Math.floor(t / hit) % n, local = (t - Math.floor(t / hit) * hit) / hit;
  return { pose: mixSparse(list[(idx - 1 + n) % n], list[idx], sm(0, snap, local)), pop: Math.exp(-local * 9), local };
}

// sestavení tance z fází: [{ n: název, d: délka, b: délka překrytí s další fází, p: pose(tl) }]
// Další fáze začíná běžet už b sekund před koncem předchozí a obě se plynule prolnou, takže pohyb nikdy neskočí.
function sequence(phrases, { lag = 0.09, lagKeys = ['hNod', 'hTurn', 'hTilt', 'wrZR', 'wrZL', 'wrXR', 'wrXL'] } = {}) {
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
  return { period: T, pose, phrase: t => { const { i, tl } = find(t), prev = phrases[(i - 1 + n) % n]; return (tl < prev.b * 0.5 ? prev : phrases[i]).n; } };
}

/* ====================== pomocné stavební prvky ====================== */
const bounce = (tl, beat = 0.6667, depth = 1) => {
  const d = 0.5 + 0.5 * Math.cos(PI2 * tl / beat);
  return { kneeR: depth * (14 + 22 * d), kneeL: depth * (14 + 22 * d), hipFlexR: depth * (8 + 14 * d), hipFlexL: depth * (8 + 14 * d), ankleR: 5 * d, ankleL: 5 * d, lean: 6 + 7 * d, hNod: 6 * d };
};
const add = (a, b) => { const o = { ...a }; for (const k in b) o[k] = (o[k] || 0) + b[k]; return o; };

/* ====================== zamávání ====================== */
const waveR = tl => {
  const env = sm(0, 0.55, tl) * (1 - sm(1.85, 2.4, tl));
  const w = Math.sin(PI2 * (tl - 0.4) * 2.1) * env, sway = Math.sin(PI2 * tl / 2.4), k = 5 + 3 * Math.sin(2 * PI2 * tl / 2.4);
  return {
    abdR: 8 + 92 * env, flexR: 10 * env, elbZR: 88 * env + 30 * w, elbXR: 8 * env, wrZR: 16 * w,
    abdL: 7 + 2 * sway, elbXL: 10, flexL: 4 * sway,
    hTilt: 7 * env, hTurn: -10 * env, hNod: -3 * env + 2 * Math.sin(2 * PI2 * tl / 2.4),
    roll: 2.5 * sway, twist: -4 * env, pRoll: -2 * sway, kneeR: k, kneeL: k, hipFlexR: k * 0.5, hipFlexL: k * 0.5, lean: 2,
  };
};
const waveBoth = tl => {
  const env = sm(0, 0.5, tl) * (1 - sm(1.9, 2.4, tl)), w = Math.sin(PI2 * (tl - 0.3) * 2) * env, bn = bounce(tl, 0.6, 0.6);
  return add(bn, {
    abdR: 8 + 145 * env, abdL: 8 + 145 * env, elbZR: 22 * w, elbZL: -22 * w, wrZR: 20 * w, wrZL: -20 * w, flexR: 5 * env, flexL: 5 * env,
    hTilt: 8 * Math.sin(PI2 * tl / 1.2) * env, hNod: -8 * env, roll: 3 * Math.sin(PI2 * tl / 1.2) * env,
  });
};
const bow = tl => {
  const pres = sm(0, 0.5, tl) * (1 - sm(0.7, 1.1, tl)), bw = sm(0.9, 1.5, tl) * (1 - sm(1.8, 2.3, tl)), ta = sm(2.2, 2.55, tl) * (1 - sm(2.8, 3.2, tl));
  return {
    lean: 58 * bw - 4 * ta, hNod: 18 * bw - 8 * ta, kneeR: 10 * bw + 6, kneeL: 10 * bw + 6, hipFlexR: 4 * bw, hipFlexL: 4 * bw,
    abdR: 8 + 62 * pres + 135 * ta, abdL: 8 + 62 * pres + 135 * ta, flexR: 18 * pres + 25 * bw, flexL: 18 * pres + 25 * bw, elbXR: 10 + 20 * bw, elbXL: 10 + 20 * bw,
    ty: 0, hTilt: 5 * ta, elbZR: 10 * ta, elbZL: -10 * ta,
  };
};

/* ====================== skok ====================== */
// jeden skok: o.spread (rozkrok), o.tuck (zkrčení), o.turn (otočení ve vzduchu), o.h (výška)
const jumpPhrase = (T, o = {}) => tl => {
  const t = tl * 1.9 / T, spread = o.spread || 0, tuckK = o.tuck || 0.55, H = o.h || 52;
  const crouch = sm(0.0, 0.42, t) * (1 - sm(0.42, 0.56, t)) + 0.75 * sm(1.1, 1.2, t) * (1 - sm(1.2, 1.6, t));
  const u = Math.min(1, Math.max(0, (t - 0.56) / 0.55)), air = t >= 0.56 && t <= 1.11;
  const tuck = air ? Math.sin(Math.PI * u) * tuckK : 0;
  const up = sm(0.4, 0.62, t) * (1 - sm(1.05, 1.35, t)), push = sm(0.4, 0.58, t) * (1 - sm(0.58, 0.9, t));
  const hip = 68 * crouch + 38 * tuck * (tuckK / 0.55), kn = 88 * crouch + 55 * tuck * (tuckK / 0.55), an = 30 * crouch - 28 * push - 10 * tuck;
  const arm = -28 * sm(0.05, 0.4, t) * (1 - sm(0.4, 0.5, t));
  const inAir = air ? Math.sin(Math.PI * u) : 0;
  return {
    ty: air ? 4 * H * u * (1 - u) : 0, fz: sm(0.5, 0.6, t) * (1 - sm(1.1, 1.2, t)),
    hipFlexR: hip, hipFlexL: hip, kneeR: kn, kneeL: kn, ankleR: an, ankleL: an, lean: 28 * crouch + 8 * tuck,
    flexR: arm + 40 * up * (spread ? 0.3 : 1), flexL: arm + 40 * up * (spread ? 0.3 : 1), abdR: 150 * up + 6, abdL: 150 * up + 6,
    elbXR: 10 + 25 * (1 - up), elbXL: 10 + 25 * (1 - up), hNod: -10 * up + 12 * crouch,
    hipAbdR: 4 * tuck + spread * inAir, hipAbdL: 4 * tuck + spread * inAir,
    ry: (o.turn || 0) * sm(0.56, 1.11, t),
  };
};

/* ====================== salto ====================== */
const flipPhrase = (dir) => tl => {
  const t = tl;
  const c1 = sm(0.05, 0.5, t) * (1 - sm(0.5, 0.68, t)), u = Math.min(1, Math.max(0, (t - 0.7) / 1.1)), flight = t >= 0.7 && t <= 1.8;
  const tuck = flight ? sm(0.1, 0.3, u) * (1 - sm(0.68, 0.86, u)) : 0, land = sm(1.78, 1.9, t) * (1 - sm(1.9, 2.45, t));
  const cr = Math.max(c1, land * 0.8), up = sm(0.52, 0.72, t) * (1 - sm(1.35, 1.75, t)), push = sm(0.62, 0.72, t) * (1 - sm(0.85, 1.1, t));
  const hip = 75 * cr + 105 * tuck, kn = 95 * cr + 125 * tuck, flex = -45 * c1 + (1 - tuck) * 165 * up + 70 * tuck;
  return {
    ty: flight ? 4 * 65 * u * (1 - u) : 0, fz: sm(0.62, 0.72, t) * (1 - sm(1.76, 1.9, t)), rx: dir * 360 * sm(0.04, 0.92, u),
    hipFlexR: hip, hipFlexL: hip, kneeR: kn, kneeL: kn, ankleR: 30 * cr - 35 * push, ankleL: 30 * cr - 35 * push,
    lean: 30 * cr + 35 * tuck, flexR: flex, flexL: flex, abdR: 8, abdL: 8, elbXR: 80 * tuck + 10, elbXL: 80 * tuck + 10, hNod: 25 * tuck + 8 * c1,
  };
};
const flipPrep = tl => {
  const s = Math.sin(PI2 * tl / 0.8), d = 0.5 + 0.5 * Math.cos(PI2 * tl / 0.8);
  return add(bounce(tl, 0.8, 0.9), { flexR: 35 * s, flexL: -35 * s, elbXR: 40, elbXL: 40, abdR: 15, abdL: 15, lean: 4 * d, hNod: 3 });
};
const taDa = tl => {
  const e = sm(0, 0.35, tl) * (1 - sm(1.2, 1.6, tl)), bn = bounce(tl, 0.6, 0.4);
  return add(bn, { abdR: 8 + 140 * e, abdL: 8 + 140 * e, hNod: -8 * e, lean: -3 * e, elbZR: 12 * Math.sin(PI2 * tl * 2) * e, elbZL: -12 * Math.sin(PI2 * tl * 2) * e });
};

/* ====================== šafl ====================== */
const runningMan = tl => {
  const s = Math.sin(PI2 * tl / 0.9), bob = Math.abs(s);
  return {
    hipFlexR: 48 * pos(s) - 20 * pos(-s) + 10, hipFlexL: 48 * pos(-s) - 20 * pos(s) + 10, kneeR: 88 * pos(s) + 16, kneeL: 88 * pos(-s) + 16,
    ankleR: -10 * pos(-s), ankleL: -10 * pos(s), flexR: -38 * s, flexL: 38 * s, elbXR: 88, elbXL: 88, abdR: 10, abdL: 10,
    lean: 10, twist: 10 * s, roll: 3 * s, pRoll: -4 * s, pTwist: -6 * s, hNod: 4 + 5 * bob, hTurn: 6 * s,
  };
};
const charleston = tl => {
  const s = Math.sin(PI2 * tl / 0.9), a = Math.abs(s), w = Math.sin(PI2 * 3 * tl);
  return {
    hipFlexR: 40 * pos(s) - 22 * pos(-s), kneeR: 18 + 42 * pos(-s), hipFlexL: 40 * pos(-s) - 22 * pos(s), kneeL: 18 + 42 * pos(s),
    hipAbdR: -10 * pos(s), hipAbdL: -10 * pos(-s), ankleR: 8 * pos(s), ankleL: 8 * pos(-s),
    flexR: 40 * s, flexL: -40 * s, abdR: 30 + 25 * a, abdL: 30 + 25 * a, elbXR: 28, elbXL: 28, wrZR: 25 * w, wrZL: -25 * w,
    pTwist: 10 * s, twist: -8 * s, hTilt: 7 * s, hNod: 3 * a, lean: 4,
  };
};
const cabbage = tl => {
  const w = PI2 * tl / 0.9, bn = bounce(tl, 0.45, 1.1);
  return add(bn, {
    pTilt: 8 * Math.sin(w), pRoll: 12 * Math.cos(w), twist: -8 * Math.cos(w),
    flexR: 60 + 40 * Math.sin(w), abdR: 28 + 20 * Math.cos(w), elbXR: 95, flexL: 60 + 40 * Math.sin(w + Math.PI), abdL: 28 + 20 * Math.cos(w + Math.PI), elbXL: 95,
    hTilt: 8 * Math.cos(w), hTurn: 8 * Math.sin(w),
  });
};
// otočka na jedné noze (pirueta): ry 360°, osa v opěrné noze
const pirouette = (T, supportRight = true) => tl => {
  const sp = sm(0.25, T - 0.35, tl), prep = sm(0, 0.3, tl) * (1 - sm(T - 0.3, T, tl));
  const p = {
    ry: 360 * sp * (supportRight ? 1 : -1), sp: supportRight ? -1 : 1,
    abdR: 14 + 6 * prep, abdL: 14 + 6 * prep, elbXR: 25 + 95 * prep, elbXL: 25 + 95 * prep, flexR: 40 * prep, flexL: 40 * prep,
    lean: 3, hNod: -2, kneeR: 12 + 4 * prep, kneeL: 12 + 4 * prep, hipFlexR: 8, hipFlexL: 8,
  };
  const lift = sm(0.12, 0.45, tl) * (1 - sm(T - 0.45, T - 0.1, tl));          // volná noha v pozici „passé“
  if (supportRight) { p.hipFlexL = 8 + 70 * lift; p.kneeL = 12 + 95 * lift; p.hipAbdL = 22 * lift; } else { p.hipFlexR = 8 + 70 * lift; p.kneeR = 12 + 95 * lift; p.hipAbdR = 22 * lift; }
  return p;
};

/* ====================== hip-hop ====================== */
const groove = tl => {
  const b = tl / 0.6667, d = 0.5 + 0.5 * Math.cos(PI2 * b), sway = Math.sin(PI2 * b / 2), pump = Math.sin(PI2 * b);
  return {
    kneeR: 14 + 22 * d, kneeL: 14 + 22 * d, hipFlexR: 8 + 14 * d, hipFlexL: 8 + 14 * d, ankleR: 5 * d, ankleL: 5 * d,
    lean: 6 + 7 * d, pRoll: 4 * sway, roll: -5 * sway, twist: 9 * sway, pTwist: -5 * sway,
    flexR: 30 + 25 * pump, flexL: 30 - 25 * pump, elbXR: 82, elbXL: 82, abdR: 14, abdL: 14, wrXR: 10 * pump, wrXL: -10 * pump,
    hNod: 6 * d, hTilt: 6 * sway, hTurn: 8 * sway,
  };
};
const stepTouch = tl => {
  const b = tl / 0.6667, s = Math.sin(PI2 * b / 2), d = 0.5 + 0.5 * Math.cos(PI2 * b);
  return add(bounce(tl, 0.6667, 0.9), {
    tx: -5 * s, hipAbdR: 24 * pos(s), hipAbdL: 24 * pos(-s), pRoll: 5 * s, roll: -6 * s,
    flexR: 45 - 35 * pos(s), flexL: 45 - 35 * pos(-s), elbXR: 95, elbXL: 95, abdR: 18 + 20 * pos(s), abdL: 18 + 20 * pos(-s),
    hTilt: 8 * s, hNod: 4 * d, twist: 6 * s,
  });
};
const bodyRoll = tl => {
  const f = PI2 * tl / 1.3333, bn = bounce(tl, 0.6667, 0.7);
  return add(bn, {
    pTilt: 14 * Math.sin(f), lean: 8 + 14 * Math.sin(f - 1.2), hNod: 12 * Math.sin(f - 2.4), twist: 6 * Math.sin(f - 0.6),
    flexR: 40 + 25 * Math.sin(f - 0.8), flexL: 40 + 25 * Math.sin(f - 0.8), abdR: 22, abdL: 22, elbXR: 85, elbXL: 85,
  });
};
const spinFreeze = tl => {
  const sp = sm(0.35, 1.55, tl), fr = sm(1.7, 1.95, tl) * (1 - sm(2.4, 2.667, tl)), bn = bounce(tl, 0.6667, 0.7);
  return add(bn, {
    ry: 360 * sp, abdR: 35 * Math.sin(Math.PI * sp) + 14 + 140 * fr, abdL: 35 * Math.sin(Math.PI * sp) + 14, elbXR: 80 * (1 - sp), elbXL: 80 * (1 - sp),
    lean: -4 * fr, roll: -8 * fr, hTilt: 10 * fr, pRoll: 6 * fr, hipFlexR: 20 * fr, kneeR: 25 * fr, hNod: -6 * fr,
  });
};

/* ====================== popping ====================== */
const robot = tl => {
  const L = [
    { hTurn: 30, abdR: 8, abdL: 8, lean: 3 }, { hTurn: -30, abdR: 90, elbZR: 90, abdL: 8, twist: -12 }, { flexR: 90, elbXR: 90, flexL: 90, elbXL: 90, lean: 8, hNod: 12 },
    { hTurn: 35, abdL: 90, elbZL: 90, abdR: 12, twist: 12, hTilt: 10 }, { hTurn: -20, flexR: 90, abdR: 0, flexL: -40, twist: -15, lean: 4 }, { abdR: 90, abdL: 90, roll: 6, hNod: -6 },
    { hTurn: 20, abdR: 90, elbZR: 90, abdL: 90, elbZL: -90, roll: -5 }, { hNod: 15, hTurn: -35, flexR: 90, elbXR: 120, abdL: 10, roll: -6, twist: 8 },
  ];
  const { pose, pop } = stepped(L, tl, 3.2, 0.1);
  return { ...pose, kneeR: 8 + 10 * pop, kneeL: 8 + 10 * pop, hipFlexR: 4 + 5 * pop, hipFlexL: 4 + 5 * pop, lean: (pose.lean || 0) + 4 * pop, hNod: (pose.hNod || 0) + 4 * pop };
};
const moonwalk = tl => {
  const f = PI2 * tl / 1.0, a = Math.cos(f), b = -a, lr = pos(Math.sin(f)), ll = pos(-Math.sin(f));
  return {
    hipFlexR: 17 * a, hipFlexL: 17 * b, kneeR: 6 + 8 * lr, kneeL: 6 + 8 * ll, ankleR: -42 * lr + 4, ankleL: -42 * ll + 4,
    lean: -7, flexR: 14 * a, flexL: 14 * b, elbXR: 38, elbXL: 38, abdR: 10, abdL: 10, wrXR: -25, wrXL: -25,
    hTurn: 12 * Math.sin(f / 2), hNod: 5, roll: 3 * Math.sin(f), pRoll: -3 * Math.sin(f), twist: 5 * Math.sin(f),
  };
};
const armWave = tl => {
  const f = PI2 * tl / 1.6, d = 0.5 + 0.5 * Math.cos(2 * f), bn = bounce(tl, 0.8, 0.6);
  return add(bn, {
    abdR: 55 + 40 * Math.sin(f), elbZR: 35 * Math.sin(f - 0.9), wrZR: 30 * Math.sin(f - 1.8), flexR: 15, elbXR: 20,
    abdL: 55 + 40 * Math.sin(f - 2.6), elbZL: 35 * Math.sin(f - 3.5), wrZL: 30 * Math.sin(f - 4.4), flexL: 15, elbXL: 20,
    roll: 8 * Math.sin(f - 1.3), hTilt: 10 * Math.sin(f - 1.9), hTurn: 10 * Math.sin(f - 1.9), twist: 6 * Math.sin(f - 0.8),
  });
};
const hitsPop = tl => {
  const L = [
    { hTilt: 18, roll: 8, abdR: 20, abdL: 20, lean: 6 }, { hTilt: -18, roll: -8, lean: 10, abdR: 60, elbXR: 70, abdL: 20 }, { hTurn: 40, twist: 15, abdL: 70, elbXL: 70, abdR: 20, lean: 4 },
    { hNod: 20, lean: 18, flexR: 50, flexL: 50, elbXR: 90, elbXL: 90 }, { hTilt: 15, roll: 6, abdR: 90, elbZR: -30, abdL: 90, elbZL: 30 }, { hTurn: -40, twist: -15, lean: 5, flexR: 70, elbXR: 100, abdL: 30 },
  ];
  const { pose, pop } = stepped(L, tl, 2.4, 0.09);
  return { ...pose, kneeR: 10 + 12 * pop, kneeL: 10 + 12 * pop, hipFlexR: 5 + 6 * pop, hipFlexL: 5 + 6 * pop, lean: (pose.lean || 0) + 5 * pop };
};

/* ====================== locking ====================== */
const lockPoints = tl => {
  const L = [
    { flexR: 95, abdR: 12, elbXL: 100, abdL: 25, flexL: 10, hTurn: -25, lean: 8, kneeR: 20, kneeL: 20, hipFlexR: 10, hipFlexL: 10, roll: 4 },
    { flexR: 90, flexL: 90, elbXR: 100, elbXL: 100, lean: 15, hNod: 10, kneeR: 30, kneeL: 30, hipFlexR: 20, hipFlexL: 20 },
    { hipFlexR: 75, kneeR: 120, ankleR: -40, hipFlexL: 40, kneeL: 70, lean: 20, flexR: -30, flexL: 60, elbXL: 90, hTurn: 30, roll: -5 },
    { abdL: 160, flexL: 10, abdR: 20, elbXR: 100, hTilt: -8, kneeR: 15, kneeL: 15, twist: 10, hTurn: 25 },
  ];
  const { pose, pop } = stepped(L, tl, 2.4, 0.09), roll = Math.sin(PI2 * 5 * tl), c = Math.cos(PI2 * 5 * tl);
  return { ...pose, wrZR: 35 * roll, wrXR: 25 * c, wrZL: -35 * roll, wrXL: 25 * c, kneeR: (pose.kneeR || 0) + 7 * pop, kneeL: (pose.kneeL || 0) + 7 * pop, lean: (pose.lean || 0) + 4 * pop };
};
const scoobot = tl => {
  const s = Math.sin(PI2 * tl / 1.2), a = Math.abs(s), dn = sm(0, 0.35, tl) * (1 - sm(2.05, 2.4, tl));
  return {
    kneeR: 35 + 50 * dn - 15 * s * dn, kneeL: 35 + 50 * dn + 15 * s * dn, hipFlexR: 25 + 35 * dn + 10 * s, hipFlexL: 25 + 35 * dn - 10 * s, hipAbdR: 6 + 14 * pos(s), hipAbdL: 6 + 14 * pos(-s),
    lean: 22 * dn + 5, flexR: 55 * s * dn + 15, flexL: -55 * s * dn + 15, elbXR: 60 + 30 * pos(s), elbXL: 60 + 30 * pos(-s), abdR: 20, abdL: 20,
    pTwist: 10 * s, twist: -12 * s, hTurn: 14 * s, hNod: 6 * a, ankleR: 10 * pos(s), ankleL: 10 * pos(-s),
  };
};
const kneeDrop = tl => {
  const dn = sm(0.35, 0.65, tl) * (1 - sm(1.3, 1.6, tl)), pre = sm(0, 0.3, tl) * (1 - sm(0.3, 0.45, tl)), pop = pulse(tl, 1.6, 0.12) * sm(1.6, 1.62, tl);
  return {
    hipFlexR: 8 + 5 * dn - 8 * pop, kneeR: 15 + 118 * dn, ankleR: -45 * dn, hipFlexL: 12 + 68 * dn, kneeL: 20 + 70 * dn, ankleL: 8 * dn,
    hipAbdR: 6 + 8 * dn, hipAbdL: 6 + 8 * dn, lean: 6 + 10 * dn - 6 * pre, flexR: -20 * dn + 40 * pre, flexL: 30 * dn + 40 * pre, abdR: 18 + 70 * dn, abdL: 18 + 70 * dn,
    elbXR: 20 + 60 * pre, elbXL: 60, hNod: 8 * dn, hTurn: 20 * dn, roll: -4 * dn,
  };
};

/* ====================== breaking ====================== */
const toprock = tl => {
  const ph = PI2 * tl / 2.4, s = Math.sin(ph), c = Math.cos(ph), bob = 0.5 + 0.5 * Math.cos(2 * ph);
  return {
    lean: 24, kneeR: 30 + 14 * bob, kneeL: 30 + 14 * bob, hipAbdR: -24 * pos(s), hipAbdL: -24 * pos(-s), hipFlexR: 22 + 45 * pos(s), hipFlexL: 22 + 45 * pos(-s),
    flexR: -40 * s + 20, flexL: 40 * s + 20, elbXR: 75, elbXL: 75, abdR: 22, abdL: 22,
    twist: 16 * s, pTwist: -10 * s, roll: 4 * c, hNod: 5 * bob, hTurn: -10 * s, pRoll: 5 * s,
  };
};
// 6-step: dřep, ruce na zemi, nohy kolem rukou v kruhu
const sixStep = tl => {
  const dn = sm(0, 0.9, tl), f = PI2 * (tl - 0.7) / 2.4, on = sm(0.7, 1.2, tl);
  const kR = pos(Math.sin(f)) * on, kL = pos(Math.sin(f + Math.PI * 0.62)) * on;
  return {
    rx: 66 * dn, flexR: 66 * dn, flexL: 66 * dn, elbXR: 4 * dn, elbXL: 4 * dn, abdR: 10 * dn, abdL: 10 * dn,
    hNod: -52 * dn, hipFlexR: 70 * dn - 62 * kR, hipFlexL: 70 * dn - 62 * kL, kneeR: 98 * dn - 88 * kR, kneeL: 98 * dn - 88 * kL,
    hipAbdR: 10 * dn + 30 * kR, hipAbdL: 10 * dn + 30 * kL, ankleR: -25 * dn, ankleL: -25 * dn,
    twist: 16 * Math.sin(f) * on, pTwist: -10 * Math.sin(f) * on, lean: -8 * dn, hTurn: -12 * Math.sin(f) * on,
  };
};
// stojka na rukou (freeze) s pomalým otáčením
const handstand = tl => {
  const hs = 1;
  return {
    rx: 176 * hs, ry: 360 * sm(0.6, 2.1, tl), flexR: 174 * hs, flexL: 174 * hs, abdR: 6 * hs, abdL: 6 * hs, hNod: -8 * hs,
    hipAbdR: 30 * hs, hipAbdL: 30 * hs, hipFlexR: 12 * hs, hipFlexL: 12 * hs, kneeR: 28 * hs, kneeL: 28 * hs, ankleR: -30 * hs, ankleL: -30 * hs, lean: -6 * hs, rz: 4 * hs * Math.sin(PI2 * tl / 1.2),
  };
};
// windmill: leží na zádech, nohy do V, otáčení kolem horní části zad
const windmill = tl => {
  const lay = 1, yaw = 1800 * sm(0.8, 4.2, tl), yr = rad(yaw);
  return {
    rx: -80 * lay, ry: yaw, rz: 22 * lay * Math.sin(2 * yr), sp: 2 * lay, hipFlexR: 96 * lay, hipFlexL: 96 * lay, hipAbdR: 34 * lay, hipAbdL: 34 * lay, kneeR: 12 * lay, kneeL: 12 * lay,
    flexR: 52 * lay, flexL: 52 * lay, elbXR: 125 * lay, elbXL: 125 * lay, hNod: -28 * lay, lean: 6 * lay,
  };
};
// headspin: stojka na hlavě, nohy ve V, ruce zkřížené na hrudi, rychlé otáčení
const headspin = tl => {
  const inv = 1, yaw = 2520 * sm(0.7, 3.9, tl);
  return {
    rx: 177 * inv, ry: yaw, rz: 5 * inv * Math.sin(PI2 * tl / 0.9), hipAbdR: 32 * inv, hipAbdL: 32 * inv, hipFlexR: 12 * inv, hipFlexL: 12 * inv, kneeR: 22 * inv, kneeL: 22 * inv,
    flexR: 40 * inv, flexL: 40 * inv, elbXR: 130 * inv, elbXL: 130 * inv, ankleR: -25 * inv, ankleL: -25 * inv, hNod: 0,
  };
};
const getUp = tl => {
  const e = sm(0.4, 1.0, tl) * (1 - sm(2.2, 2.8, tl)), b = bounce(tl, 0.6667, 0.5);
  return add(b, { abdR: 8 + 142 * e, abdL: 12, elbZR: 12 * e, hTilt: 8 * e, hNod: -8 * e, lean: -3 * e, hipAbdL: 6 * e, roll: -3 * e, flexL: 25 * e, elbXL: 80 * e });
};

/* ====================== krump ====================== */
const krumpStomp = tl => {
  const lift = (a, b) => (tl >= a && tl < b ? Math.pow(Math.sin(Math.PI * (tl - a) / (b - a)), 0.7) : 0);
  const liftR = lift(0, 0.45), liftL = lift(1.0, 1.45);
  const H = pulse(tl, 0.45, 0.1) + pulse(tl, 0.95, 0.1) + pulse(tl, 1.45, 0.1) + pulse(tl, 1.95, 0.1);
  const up1 = sm(0.5, 0.75, tl) * (1 - sm(0.82, 0.95, tl)), up2 = sm(1.5, 1.72, tl) * (1 - sm(1.8, 1.95, tl)), hitA = pulse(tl, 0.95, 0.12), hitB = pulse(tl, 1.95, 0.12);
  return {
    kneeR: 28 + 100 * liftR + 18 * pulse(tl, 0.45, 0.12), kneeL: 28 + 100 * liftL + 18 * pulse(tl, 1.45, 0.12), hipFlexR: 18 + 72 * liftR, hipFlexL: 18 + 72 * liftL,
    hipAbdR: 14, hipAbdL: 14, ankleR: -10 * liftR, ankleL: -10 * liftL, lean: 22 - 16 * H, hNod: 12 - 14 * H, twist: 14 * Math.sin(PI2 * tl / 2.0), roll: 4 * Math.sin(PI2 * tl),
    flexR: 35 + 105 * up1 - 45 * hitA + 60 * up2 - 40 * hitB, flexL: 35 + 105 * up1 - 45 * hitA, abdR: 18 + 40 * up2, abdL: 18, elbXR: 100 - 60 * up1, elbXL: 100 - 60 * up1,
    pRoll: 6 * Math.sin(PI2 * tl / 1.0), hTilt: 8 * H, hTurn: 14 * Math.sin(PI2 * tl / 2.0),
  };
};
const krumpChest = tl => {
  const H = pulse(tl, 0.0, 0.1) + pulse(tl, 0.5, 0.1) + pulse(tl, 1.0, 0.1) + pulse(tl, 1.5, 0.1), f = PI2 * tl / 2.0;
  return {
    kneeR: 38 + 10 * H, kneeL: 38 + 10 * H, hipFlexR: 28 + 6 * H, hipFlexL: 28 + 6 * H, hipAbdR: 20, hipAbdL: 20, lean: 20 - 20 * H, hNod: 10 - 12 * H,
    flexR: 40 + 85 * Math.sin(f) - 20 * H, flexL: 40 - 85 * Math.sin(f) - 20 * H, abdR: 25 + 30 * pos(Math.sin(f + 1.2)), abdL: 25 + 30 * pos(-Math.sin(f + 1.2)),
    elbXR: 95 - 40 * pos(Math.sin(f)), elbXL: 95 - 40 * pos(-Math.sin(f)), twist: 18 * Math.sin(f), pTwist: -10 * Math.sin(f), hTurn: 16 * Math.sin(f - 0.5), hTilt: 8 * H,
  };
};
const krumpBuck = tl => {
  const sh = Math.sin(PI2 * 3 * tl), d = 0.5 + 0.5 * Math.cos(PI2 * 3 * tl), v = Math.sin(PI2 * tl / 2.0);
  return {
    kneeR: 42 + 14 * d, kneeL: 42 + 14 * d, hipFlexR: 30 + 8 * d, hipFlexL: 30 + 8 * d, hipAbdR: 22, hipAbdL: 22, lean: 26, hNod: 14 * d,
    twist: 24 * sh, pTwist: -12 * sh, roll: 6 * sh, flexR: 30 + 20 * v, flexL: 30 - 20 * v, elbXR: 112, elbXL: 112, abdR: 34, abdL: 34, hTurn: 22 * sh, hTilt: 10 * sh,
  };
};
const krumpHop = tl => {
  const hop = (a) => { const u = Math.min(1, Math.max(0, (tl - a) / 0.5)); return (tl >= a && tl <= a + 0.5) ? 4 * 18 * u * (1 - u) : 0; };
  const air = tl % 1.0 < 0.5, ph = tl % 1.0, ar = sm(0, 0.4, ph) * (1 - sm(0.5, 0.8, ph)), H = pulse(ph, 0.5, 0.1);
  return {
    ty: hop(0) + hop(1.0), fz: sm(0.02, 0.12, ph) * (1 - sm(0.44, 0.52, ph)), kneeR: 38 + 50 * (1 - ar) * 0.3 + 25 * H, kneeL: 38 + 50 * (1 - ar) * 0.3 + 25 * H, hipFlexR: 28 + 12 * H, hipFlexL: 28 + 12 * H,
    hipAbdR: 16, hipAbdL: 16, lean: 22 - 16 * H, hNod: 12 - 14 * H, flexR: 25 + 130 * ar - 50 * H, flexL: 25 + 130 * ar - 50 * H, elbXR: 100 - 70 * ar, elbXL: 100 - 70 * ar, abdR: 18, abdL: 18,
    twist: 8 * Math.sin(PI2 * tl / 2.0),
  };
};

/* ====================== tance ====================== */
const ph = (n, d, p, b = 0.45) => ({ n, d, p, b });
export const DANCES = {
  wave: {
    group: 'basic', name: 'Zamávání', emoji: '👋',
    info: 'Pozdrav v několika fázích: mávání pravou, levou, oběma rukama a nakonec úklona.',
    ...sequence([ph('Zamávání pravou', 2.4, waveR), ph('Zamávání levou', 2.4, tl => mirror(waveR(tl))), ph('Obě ruce', 2.4, waveBoth), ph('Úklona', 3.2, bow, 0.6)]),
  },
  jump: {
    group: 'basic', name: 'Skok', emoji: '🦘',
    info: 'Série skoků: obyčejný, s rozkrokem, se zkrčením a s otočkou o 360 stupňů.',
    ...sequence([ph('Skok', 1.9, jumpPhrase(1.9), 0.3), ph('Skok s rozkrokem', 2.0, jumpPhrase(2.0, { spread: 28, h: 56 }), 0.3), ph('Skok se zkrčením', 2.0, jumpPhrase(2.0, { tuck: 1.0, h: 58 }), 0.3), ph('Skok s otočkou', 2.1, jumpPhrase(2.1, { turn: 360, h: 58 }), 0.5), ph('Odpočinek', 1.4, tl => bounce(tl, 0.7, 0.4), 0.5)], { lag: 0.06 }),
  },
  backflip: {
    group: 'basic', name: 'Backflip', emoji: '🤸',
    info: 'Rozběh, salto vzad, pózování a pak salto vpřed.',
    ...sequence([ph('Příprava', 2.4, flipPrep, 0.4), ph('Salto vzad', 3.0, flipPhrase(1 * -1), 0.3), ph('Pózování', 1.8, taDa, 0.5), ph('Příprava', 1.6, flipPrep, 0.4), ph('Salto vpřed', 3.0, flipPhrase(1), 0.3), ph('Pózování', 1.8, taDa, 0.6)], { lag: 0.05 }),
  },
  shuffle: {
    group: 'basic', name: 'Šafl', emoji: '🕺',
    info: 'Running man, charleston, cabbage patch a otočka na jedné noze.',
    ...sequence([ph('Running man', 3.6, runningMan), ph('Charleston', 3.6, charleston), ph('Cabbage patch', 3.6, cabbage), ph('Otočka', 2.2, pirouette(2.2, true), 0.5), ph('Running man', 1.8, runningMan, 0.5)]),
  },
  hiphop: {
    group: 'street', name: 'Hip-hop', emoji: '🎤',
    info: 'Hip-hop vznikl v 70. letech v newyorském Bronxu spolu s hudbou stejného jména. Základem je „bounce“: rytmické pohupování v kolenou na každou dobu a uvolněný „groove“ hrudníku a ramen. Sestava: groove, step-touch, vlna tělem a otočka s pózou.',
    ...sequence([ph('Groove', 2.667, groove), ph('Step-touch', 2.667, stepTouch), ph('Vlna tělem', 2.667, bodyRoll), ph('Groove', 2.667, groove), ph('Otočka s pózou', 2.667, spinFreeze, 0.55)]),
  },
  popping: {
    group: 'street', name: 'Popping', emoji: '🤖',
    info: 'Popping vznikl v 70. letech v Kalifornii (Fresno, Oakland). Tanečník v rytmu prudce stahuje svaly („pop“ nebo „hit“) a mezi údery drží pózu. Sestava: robot, moonwalk, vlna rukama a izolace.',
    ...sequence([ph('Robot', 3.2, robot, 0.35), ph('Moonwalk', 3.0, moonwalk, 0.5), ph('Vlna rukama', 3.2, armWave, 0.5), ph('Izolace', 2.4, hitsPop, 0.35)], { lag: 0 }),
  },
  locking: {
    group: 'street', name: 'Locking', emoji: '🔒',
    info: 'Locking vznikl koncem 60. let v Los Angeles (Don Campbell, skupina The Lockers). „Lock“ je náhlé zastavení pohybu a podržení pózy. Typické je ukazování, rotace zápěstí a pád na koleno. Sestava: zámky, scoobot, pád na koleno a otočka.',
    ...sequence([ph('Zámky a ukazování', 2.4, lockPoints, 0.3), ph('Scoobot', 2.4, scoobot, 0.45), ph('Pád na koleno', 2.4, kneeDrop, 0.5), ph('Otočka', 2.2, pirouette(2.2, false), 0.5)], { lag: 0.04 }),
  },
  breaking: {
    group: 'street', name: 'Breaking', emoji: '🌀',
    info: 'Breaking (breakdance) vznikl v 70. letech v Bronxu na parties, kde DJ Kool Herc prodlužoval „break“. Sestava: toprock ve stoje, 6-step na zemi, stojka na rukou, windmill na zádech, headspin na hlavě a vstávání. V roce 2024 byl poprvé na olympijských hrách.',
    ...sequence([ph('Toprock', 4.8, toprock, 0.9), ph('6-step', 4.8, sixStep, 1.0), ph('Stojka na rukou', 2.7, handstand, 1.0), ph('Windmill', 5.2, windmill, 1.1), ph('Headspin', 4.4, headspin, 1.0), ph('Vstávání a póza', 2.8, getUp, 0.8)], { lag: 0.07 }),
  },
  krump: {
    group: 'street', name: 'Krump', emoji: '💥',
    info: 'Krump vznikl na začátku 2000. let v South Central v Los Angeles. Je to expresivní, silový tanec plný úderů rukama, dupání a prudkých zášklbů hrudníku. Sestava: dupnutí, údery hrudníku, „buck“ a poskoky.',
    ...sequence([ph('Dupnutí', 2.0, krumpStomp, 0.3), ph('Údery hrudníku', 2.0, krumpChest, 0.3), ph('Buck', 2.0, krumpBuck, 0.35), ph('Poskoky', 2.0, krumpHop, 0.3)], { lag: 0.03 }),
  },
};
