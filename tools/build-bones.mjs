// Generuje src/data/bones.json: id meshe (= FMA id), český a latinský název, skupina, strana, popis.
// Zdrojové anglické názvy (FMA) jsou v tools/bone-sources.json. Skript selže, pokud některá kost nemá překlad.
import fs from 'node:fs';
const sources = JSON.parse(fs.readFileSync(new URL('./bone-sources.json', import.meta.url)));
const byEn = new Map(sources.map(s => [s.en, s.id]));
const used = new Set();
const out = [];
const SIDE = { right: 'pravá', left: 'levá', mid: 'střední' };
const sideOf = en => en.startsWith('right ') || / right /.test(en) ? 'pravá' : en.startsWith('left ') || / left /.test(en) ? 'levá' : 'střední';

function add(en, group, cs, la, desc) {
  const id = byEn.get(en);
  if (!id) throw new Error('Zdroj nenalezen: ' + en);
  if (used.has(id)) throw new Error('Duplicita: ' + en);
  used.add(id);
  out.push({ id, en, cs, la, group, side: sideOf(en), desc });
}
const both = (enFn, group, cs, la, desc) => { for (const s of ['right', 'left']) add(enFn(s), group, cs, la, desc); };

const L = 'lebka', P = 'pater', H = 'hrudnik', U = 'horni', V = 'panev', D = 'dolni';

// ---------- LEBKA ----------
add('frontal bone', L, 'Kost čelní', 'os frontale', 'Tvoří čelo a horní stěnu očnic. Obsahuje čelní dutinu (sinus frontalis).');
both(s => `${s} parietal bone`, L, 'Kost temenní', 'os parietale', 'Párová plochá kost, která tvoří střechu a větší část bočních stěn mozkovny.');
add('occipital bone', L, 'Kost týlní', 'os occipitale', 'Tvoří zadní a spodní část mozkovny. Velkým týlním otvorem (foramen magnum) prochází mícha; kloubí se s nosičem.');
both(s => `${s} temporal bone`, L, 'Kost spánková', 'os temporale', 'Tvoří spodní boční část lebky. Obsahuje střední a vnitřní ucho, nese kloubní jamku pro dolní čelist a bodcovitý výběžek.');
add('sphenoid bone', L, 'Kost klínová', 'os sphenoidale', 'Nepárová kost ve spodině lební, spojená s většinou okolních kostí. Uprostřed má turecké sedlo, ve kterém leží podvěsek mozkový (hypofýza).');
add('ethmoid', L, 'Kost čichová', 'os ethmoidale', 'Jemná kost mezi očnicemi. Tvoří část nosní přepážky a stěn nosní dutiny; sítovou ploténkou prochází čichová vlákna.');
both(s => `${s} nasal bone`, L, 'Kost nosní', 'os nasale', 'Malá čtyřhranná kůstka, která tvoří hřbet nosu.');
both(s => `${s} lacrimal bone`, L, 'Kost slzní', 'os lacrimale', 'Nejmenší a nejkřehčí kost obličeje na vnitřní stěně očnice. Má jamku pro slzní váček.');
both(s => `${s} zygomatic bone`, L, 'Kost lícní', 'os zygomaticum', 'Tvoří výčnělek tváře a část boční stěny očnice. Spolu se spánkovou kostí vytváří jařmový oblouk.');
both(s => `${s} maxilla`, L, 'Horní čelist', 'maxilla', 'Nese horní zuby, tvoří většinu tvrdého patra a část očnice i nosní dutiny. Obsahuje čelistní dutinu (sinus maxillaris).');
both(s => `${s} palatine bone`, L, 'Kost patrová', 'os palatinum', 'Tvoří zadní část tvrdého patra a část bočních stěn nosní dutiny.');
both(s => `${s} inferior nasal concha`, L, 'Skořepa nosní dolní', 'concha nasalis inferior', 'Samostatná kost na boční stěně nosní dutiny. Zvětšuje povrch sliznice, která ohřívá a zvlhčuje vdechovaný vzduch.');
add('vomer', L, 'Radlice', 'vomer', 'Nepárová tenká kost, která tvoří zadní dolní část nosní přepážky.');
add('mandible', L, 'Dolní čelist', 'mandibula', 'Jediná pohyblivá kost lebky. Nese dolní zuby a kloubí se se spánkovou kostí.');
add('hyoid bone', L, 'Jazylka', 'os hyoideum', 'Podkovovitá kost v krku, která se nekloubí s žádnou jinou kostí. Upínají se na ni svaly jazyka, dna ústního a hrtanu. V aplikaci je zařazena ke skupině Lebka.');

// ---------- PÁTEŘ ----------
add('atlas', P, 'Nosič (C1)', 'atlas', 'První krční obratel. Nemá tělo, je tvořen dvěma oblouky a bočními hmotami. Nese lebku, pohyb „ano“.');
add('axis', P, 'Čepovec (C2)', 'axis', 'Druhý krční obratel se zubem (dens axis), kolem kterého se otáčí nosič. Umožňuje otáčení hlavy („ne“).');
const ordC = ['third', 'fourth', 'fifth', 'sixth', 'seventh'];
ordC.forEach((o, i) => add(`${o} cervical vertebra`, P, `Krční obratel C${i + 3}`, `vertebra cervicalis ${['III', 'IV', 'V', 'VI', 'VII'][i]}`,
  i === 4 ? 'Má dlouhý, hmatný trnový výběžek, proto se jmenuje vertebra prominens. Slouží k orientaci při počítání obratlů.'
          : 'Krční obratel s malým tělem, rozdvojeným trnem a otvorem v příčném výběžku pro tepnu vertebrální.'));
const ordN = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const rom = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
ordN.forEach((o, i) => add(`${o} thoracic vertebra`, P, `Hrudní obratel Th${i + 1}`, `vertebra thoracica ${rom[i]}`,
  'Hrudní obratel má na těle a příčném výběžku kloubní plošky pro žebra a dlouhý, dolů skloněný trn.'));
ordN.slice(0, 5).forEach((o, i) => add(`${o} lumbar vertebra`, P, `Bederní obratel L${i + 1}`, `vertebra lumbalis ${rom[i]}`,
  'Největší a nejmohutnější pohyblivé obratle, s masivním tělem a krátkým silným trnem. Nesou největší zátěž.'));
add('sacrum', P, 'Kost křížová', 'os sacrum', 'Klín srostlých pěti křížových obratlů. Tvoří zadní stěnu pánve a kloubí se s kostmi pánevními (kloub křížokyčelní). V aplikaci je zařazena do páteře.');

// ---------- HRUDNÍK ----------
add('manubrium', H, 'Rukojeť hrudní kosti', 'manubrium sterni', 'Horní část hrudní kosti. Kloubí se s klíčními kostmi a s prvním žebrem; nahoře má jugulární zářez.');
add('body of sternum', H, 'Tělo hrudní kosti', 'corpus sterni', 'Střední, nejdelší část hrudní kosti. Připojují se k ní chrupavky 2. až 7. žebra.');
add('xiphoid process', H, 'Mečovitý výběžek', 'processus xiphoideus', 'Nejmenší, dolní část hrudní kosti, v dětství chrupavčitá a později zkostnatělá.');
ordN.forEach((o, i) => {
  const kind = i < 7 ? 'Pravé žebro (costa vera): chrupavkou je připojeno přímo k hrudní kosti.'
    : i < 10 ? 'Nepravé žebro (costa spuria): chrupavkou je připojeno k chrupavce žebra nad sebou.'
    : 'Volné žebro (costa fluctuans): končí volně ve svalstvu, nemá spojení s hrudní kostí.';
  const extra = i === 0 ? ' Nejkratší, nejširší a nejvíce zakřivené žebro, leží téměř vodorovně pod klíční kostí.'
    : i === 11 ? ' Nejkratší z volných žeber.' : '';
  both(s => `${s} ${o} rib`, H, `Žebro ${rom[i]}`, `costa ${rom[i]}`, kind + extra);
});

// ---------- HORNÍ KONČETINA ----------
both(s => `${s} clavicle`, U, 'Klíční kost', 'clavicula', 'S-tvarovaná kost, která spojuje lopatku s hrudní kostí. Je nejčastěji zlomenou kostí v oblasti ramene.');
both(s => `${s} scapula`, U, 'Lopatka', 'scapula', 'Plochá trojúhelníková kost na zadní straně hrudníku. Nese kloubní jamku ramenního kloubu a hřeben (spina scapulae).');
both(s => `${s} humerus`, U, 'Kost pažní', 'humerus', 'Dlouhá kost paže. Nahoře se kloubí s lopatkou, dole s předloktím (loketní kloub).');
both(s => `${s} radius`, U, 'Kost vřetenní', 'radius', 'Kost předloktí na straně palce. Při otáčení předloktí se otáčí kolem kosti loketní.');
both(s => `${s} ulna`, U, 'Kost loketní', 'ulna', 'Kost předloktí na straně malíku. Nahoře tvoří loketní výběžek (olecranon), který je hmatný jako špička lokte.');
const carpals = [['scaphoid', 'Kost člunková', 'os scaphoideum', 'Největší kost v řadě proximální. Často se láme při pádu na zápěstí.'],
  ['lunate', 'Kost poloměsíčitá', 'os lunatum', 'Kost uprostřed proximální řady zápěstí, kloubí se s kostí vřetenní.'],
  ['triquetral', 'Kost trojhranná', 'os triquetrum', 'Kost na loketní straně proximální řady zápěstí.'],
  ['pisiform', 'Kost hrášková', 'os pisiforme', 'Nejmenší zápěstní kost, sezamská kůstka v šlaše ohýbače zápěstí.'],
  ['trapezium', 'Kost čtyřhranná větší', 'os trapezium', 'Distální řada zápěstí; tvoří sedlový kloub s první kostí záprstní (kořen palce).'],
  ['trapezoid', 'Kost čtyřhranná menší', 'os trapezoideum', 'Nejmenší kost distální řady zápěstí, kloubí se s druhou kostí záprstní.'],
  ['capitate', 'Kost hlavatá', 'os capitatum', 'Největší zápěstní kost, leží uprostřed distální řady.'],
  ['hamate', 'Kost háková', 'os hamatum', 'Kost na straně malíku v distální řadě; má hákovitý výběžek (hamulus).']];
for (const [e, cs, la, d] of carpals) both(s => `${s} ${e}`, U, cs, la, d);
const fingers = [['thumb', 'palce', 'pollicis'], ['index finger', 'ukazováčku', 'indicis'], ['middle finger', 'prostředníku', 'digiti medii'],
  ['ring finger', 'prsteníku', 'digiti annularis'], ['little finger', 'malíčku', 'digiti minimi']];
const ordMc = ['first', 'second', 'third', 'fourth', 'fifth'];
ordMc.forEach((o, i) => both(s => `${s} ${o} metacarpal bone`, U, `Kost záprstní ${rom[i]}`, `os metacarpale ${rom[i]}`,
  'Dlouhá kůstka ' + (i === 0 ? 'kořene palce, nejkratší a nejpohyblivější.' : 'dlaně. Kloubí se se zápěstím a s proximálním článkem prstu.')));
const ph = { proximal: ['Proximální', 'proximalis'], middle: ['Střední', 'media'], distal: ['Distální', 'distalis'] };
for (const [kind, [csK, laK]] of Object.entries(ph)) {
  for (const [e, cs, la] of fingers) {
    if (kind === 'middle' && e === 'thumb') continue;
    both(s => `${kind} phalanx of ${s} ${e}`, U, `${csK} článek ${cs}`, `phalanx ${laK} ${la}`,
      e === 'thumb' ? 'Palec má jen dva články (proximální a distální).' : 'Prsty ruky mají tři články: proximální, střední a distální.');
  }
}

// ---------- PÁNEV ----------
both(s => `${s} hip bone`, V, 'Kost pánevní', 'os coxae', 'Srůst kosti kyčelní, sedací a stydké. Obsahuje jamku kyčelního kloubu (acetabulum). Obě kosti pánevní spolu s křížovou kostí tvoří pánev.');

// ---------- DOLNÍ KONČETINA ----------
both(s => `${s} femur`, D, 'Kost stehenní', 'femur', 'Nejdelší a nejsilnější kost těla. Nahoře má hlavici kloubu kyčelního, dole se kloubí s holení a čéškou.');
both(s => `${s} patella`, D, 'Čéška', 'patella', 'Největší sezamská kost těla, vložená do šlachy čtyřhlavého svalu stehenního. Chrání kolenní kloub.');
both(s => `${s} tibia`, D, 'Kost holenní', 'tibia', 'Mohutná kost bérce na vnitřní straně. Nese hlavní váhu těla; přední hrana (hřeben) je hmatná pod kůží.');
both(s => `${s} fibula`, D, 'Kost lýtková', 'fibula', 'Tenká kost bérce na zevní straně. Nenese téměř žádnou váhu, tvoří zevní kotník.');
both(s => `${s} talus`, D, 'Kost hlezenní', 'talus', 'Kost zánártní, která tvoří kloub hlezenní s kostmi bérce a přenáší váhu těla na patu a nárt.');
both(s => `${s} calcaneus`, D, 'Kost patní', 'calcaneus', 'Největší kost zánártí, tvoří patu. Upíná se na ni Achillova šlacha.');
for (const s of ['right', 'left']) add(`navicular bone of ${s} foot`, D, 'Kost loďkovitá', 'os naviculare', 'Kost zánártí na vnitřní straně nohy, mezi kostí hlezenní a třemi kostmi klínovými.');
both(s => `${s} cuboid bone`, D, 'Kost krychlová', 'os cuboideum', 'Kost zánártí na zevní straně nohy, kloubí se s kostí patní a 4. a 5. kostí nártní.');
both(s => `${s} medial cuneiform bone`, D, 'Kost klínová mediální', 'os cuneiforme mediale', 'Největší ze tří klínových kostí, na vnitřní straně nohy; kloubí se s první kostí nártní.');
both(s => `${s} intermediate cuneiform bone`, D, 'Kost klínová střední', 'os cuneiforme intermedium', 'Nejmenší ze tří klínových kostí, uprostřed zánártí.');
both(s => `${s} lateral cuneiform bone`, D, 'Kost klínová laterální', 'os cuneiforme laterale', 'Klínová kost na zevní straně, mezi střední klínovou a krychlovou kostí.');
ordMc.forEach((o, i) => both(s => `${s} ${o} metatarsal bone`, D, `Kost nártní ${rom[i]}`, `os metatarsale ${rom[i]}`,
  i === 0 ? 'Nejkratší a nejsilnější kost nártní, nese hlavní zátěž při odrazu.' : 'Dlouhá kůstka nártu, kloubí se se zánártím a s proximálním článkem prstu.'));
const toes = [['big toe', 'palce nohy', 'hallucis'], ['second toe', 'druhého prstu nohy', 'digiti secundi pedis'], ['third toe', 'třetího prstu nohy', 'digiti tertii pedis'],
  ['fourth toe', 'čtvrtého prstu nohy', 'digiti quarti pedis'], ['little toe', 'malíku nohy', 'digiti minimi pedis']];
for (const [kind, [csK, laK]] of Object.entries(ph)) {
  for (const [e, cs, la] of toes) {
    if (kind === 'middle' && e === 'big toe') continue;
    both(s => `${kind} phalanx of ${s} ${e}`, D, `${csK} článek ${cs}`, `phalanx ${laK} ${la}`.replace('hallucis', 'hallucis'),
      e === 'big toe' ? 'Palec nohy má jen dva články (proximální a distální).' : 'Prsty nohy mají tři články: proximální, střední a distální.');
  }
}
for (const s of ['right', 'left']) add(`sesamoid bone of ${s} foot`, D, 'Sezamská kůstka nohy', 'os sesamoideum pedis', 'Malé kůstky uložené v šlachách pod hlavicí první kosti nártní. V modelu jsou obě kůstky v jednom meshi.');

// ---------- kontrola úplnosti ----------
const missing = sources.filter(s => !used.has(s.id));
if (missing.length) throw new Error('Bez překladu: ' + missing.map(m => m.en).join(', '));
fs.mkdirSync(new URL('../src/data/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('../src/data/bones.json', import.meta.url), JSON.stringify(out, null, 1));
const cnt = {}; out.forEach(b => cnt[b.group] = (cnt[b.group] || 0) + 1);
console.log('kostí:', out.length, cnt);
