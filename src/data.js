import bonesRaw from './data/bones.json';
import colors from './data/colors.json';
import { norm, buildAnswerIndex } from './text.js';

export const GROUPS = [
  { id: 'lebka', name: 'Lebka' },
  { id: 'pater', name: 'Páteř' },
  { id: 'hrudnik', name: 'Hrudník' },
  { id: 'horni', name: 'Horní končetina' },
  { id: 'panev', name: 'Pánev' },
  { id: 'dolni', name: 'Dolní končetina' },
];
export const groupName = id => GROUPS.find(g => g.id === id)?.name ?? id;

export const bones = bonesRaw.map((b, i) => ({
  ...b, order: i, color: colors[b.id],
  label: b.side === 'střední' ? b.cs : `${b.cs}, ${b.side} strana`,
  hay: norm(`${b.cs} ${b.la} ${b.side} ${groupName(b.group)}`),
}));
export const byId = new Map(bones.map(b => [b.id, b]));
export const answerIndex = buildAnswerIndex(bones);

const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];
// Číslo 1–12 najde i římskou číslici (žebro 5 = žebro V) a kódy obratlů (5 = Th5, L5, C5).
function tokenMatches(b, t) {
  if (b.hay.includes(t)) return true;
  if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 12) {
    const words = b.hay.split(' ');
    return words.includes(ROMAN[+t]) || words.some(w => new RegExp('^(th|c|l)' + t + '$').test(w));
  }
  return false;
}

// Vyhledávání: všechny zadané výrazy se musí vyskytnout; lepší shoda (začátek názvu, začátek slova) je výš.
export function search(query, limit = 8) {
  const q = norm(query); if (!q) return [];
  const toks = q.split(' ');
  const res = [];
  for (const b of bones) {
    if (!toks.every(t => tokenMatches(b, t))) continue;
    const name = norm(b.cs), lat = norm(b.la);
    let score = 0;
    if (name === q || lat === q) score += 100;
    if (name.startsWith(q) || lat.startsWith(q)) score += 50;
    for (const t of toks) {
      if (name.split(' ').some(w => w.startsWith(t)) || lat.split(' ').some(w => w.startsWith(t))) score += 10;
    }
    res.push({ b, score });
  }
  res.sort((x, y) => y.score - x.score || x.b.order - y.b.order);
  return res.slice(0, limit).map(r => r.b);
}
