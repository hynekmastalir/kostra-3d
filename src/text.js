// Pomocné funkce pro text: normalizace bez diakritiky a tolerantní porovnání odpovědí.

export const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[()·,;:–—\-_/]/g, ' ').replace(/\s+/g, ' ').trim();

export function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };

// Rozdělí text na slova a „identifikátory“ (I–XII, 1–12, C3, Th5, L2). Identifikátory se musí shodovat přesně,
// aby „Žebro II“ nebylo uznáno jako „Žebro I“ jen kvůli překlepu.
export function parse(s) {
  const words = [], ids = [];
  for (const t of norm(s).split(' ').filter(Boolean)) {
    const m = /^(?:th|c|l|s)?(\d{1,2})$/.exec(t);
    if (m) ids.push(+m[1]);
    else if (ROMAN[t]) ids.push(ROMAN[t]);
    else words.push(t);
  }
  words.sort(); ids.sort((a, b) => a - b);
  return { w: words.join(' '), ids: ids.join(',') };
}

const allowed = len => (len <= 3 ? 0 : len <= 7 ? 1 : len <= 16 ? 2 : 3);

// index: Map klíč -> { p: parse, owners:Set(cs názvů) }
export function buildAnswerIndex(bones) {
  const idx = new Map();
  const put = (str, owner) => {
    const p = parse(str); const key = p.w + '|' + p.ids;
    if (!p.w) return;
    let e = idx.get(key); if (!e) idx.set(key, e = { p, owners: new Set() });
    e.owners.add(owner);
  };
  for (const b of bones) {
    put(b.cs, b.cs);
    put(b.cs.replace(/\(.*?\)/g, ''), b.cs);     // „Nosič (C1)“ -> „Nosič“
    put(b.la, b.cs);
  }
  return idx;
}

// Vrátí true, pokud odpověď nejlépe odpovídá názvu cílové kosti (český nebo latinský; nezáleží na diakritice,
// velikosti písmen ani pořadí slov, drobné překlepy se tolerují).
export function checkAnswer(input, target, idx) {
  const p = parse(input);
  if (!p.w) return false;
  let best = Infinity; let owners = new Set(); let bestLen = 0;
  for (const e of idx.values()) {
    if (e.p.ids !== p.ids) continue;
    const d = lev(e.p.w, p.w);
    if (d < best) { best = d; owners = new Set(e.owners); bestLen = e.p.w.length; }
    else if (d === best) e.owners.forEach(o => owners.add(o));
  }
  return best <= allowed(bestLen) && owners.size === 1 && owners.has(target.cs);
}
