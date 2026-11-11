import './style.css';
import { store } from './storage.js';
import { $, $$ } from './ui.js';

const MODEL_BYTES = 8511528;               // velikost kostra.glb (kvůli ukazateli načítání)
const ctx = { mode: 'browse', viewer: null };
const root = document.documentElement;

// ---------- motiv ----------
const mq = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : mq.matches;
function paintTheme() {
  $('#theme').textContent = isDark() ? '☀️' : '🌙';
  document.querySelector('meta[name=color-scheme]');
  ctx.viewer?.setTheme(isDark());
}
$('#theme').onclick = () => { const next = isDark() ? 'light' : 'dark'; root.dataset.theme = next; store.set('theme', next); paintTheme(); };
mq.addEventListener('change', () => paintTheme());
paintTheme();

// ---------- instalace aplikace (PWA) ----------
// Prohlížeč nabídne instalaci událostí beforeinstallprompt; na iPhonu (Safari) se instaluje přes Sdílet > Přidat na plochu.
let installEvt = null;
const installBtn = $('#install');
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (!standalone) installBtn.hidden = false; });
window.addEventListener('appinstalled', () => { installBtn.hidden = true; installEvt = null; });
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) {
  installBtn.hidden = false; installBtn.textContent = '⬇ Na plochu';
}
installBtn.onclick = async () => {
  if (installEvt) { installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; installBtn.hidden = true; }
  else alert('Na iPhonu: klepni na tlačítko Sdílet (čtverec se šipkou) a vyber „Přidat na plochu“.');
};

// ---------- spodní panel (mobil) ----------
const panel = $('#panel'), handle = $('#sheet-handle');
function setSheet(open) { panel.dataset.sheet = open ? 'open' : 'closed'; handle.setAttribute('aria-expanded', String(open)); }
const saved = store.get('sheetH', null);
if (saved) panel.style.setProperty('--sheet-h', saved + 'px');
// Tažení úchytu mění výšku panelu (kosti nahoře se tím zvětší nebo zmenší); krátké klepnutí panel sbalí/rozbalí.
let drag = null;
handle.addEventListener('pointerdown', e => {
  drag = { y: e.clientY, h: panel.getBoundingClientRect().height, moved: false };
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener('pointermove', e => {
  if (!drag) return;
  const dy = drag.y - e.clientY;
  if (!drag.moved && Math.abs(dy) < 6) return;
  drag.moved = true;
  if (panel.dataset.sheet !== 'open') setSheet(true);
  const max = innerHeight * 0.85, min = 120;
  const h = Math.max(min, Math.min(max, drag.h + dy));
  panel.style.setProperty('--sheet-h', h + 'px'); drag.last = h;
});
const endDrag = () => {
  if (!drag) return;
  if (!drag.moved) setSheet(panel.dataset.sheet !== 'open');
  else if (drag.last) store.set('sheetH', Math.round(drag.last));
  drag = null;
};
handle.addEventListener('pointerup', endDrag);
handle.addEventListener('pointercancel', () => { drag = null; });

// ---------- start ----------
const bar = $('#loading-bar'), text = $('#loading-text');
async function init() {
  try {
    const { Viewer } = await import('./viewer.js');           // three.js se stahuje až po vykreslení rozhraní
    const viewer = ctx.viewer = new Viewer($('#gl'));
    viewer.setTheme(isDark());
    await viewer.load(import.meta.env.BASE_URL + 'models/kostra.glb', MODEL_BYTES, p => {
      bar.style.width = Math.round(p * 100) + '%'; text.textContent = `Načítám model kostry… ${Math.round(p * 100)} %`;
    });
    const [{ createBrowse }, { createCards }, { createQuiz }, { createDance }] = await Promise.all([import('./browse.js'), import('./cards.js'), import('./quiz.js'), import('./dance.js')]);
    const modes = { browse: createBrowse(ctx), cards: createCards(ctx), quiz: createQuiz(ctx), dance: createDance(ctx) };
    modes.cards.leave(); modes.quiz.leave(); modes.dance.leave();
    let snap = null;

    function setMode(m) {
      if (m === ctx.mode) return;
      const prev = ctx.mode;
      if (prev === 'browse') snap = viewer.snapshot();
      modes[prev].leave();
      ctx.mode = m;
      $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
      if (m === 'browse') { viewer.setMark(null); viewer.restore(snap); }
      modes[m].enter();
      if (m !== 'browse') setSheet(true);
      viewer.resize();
      store.set('mode', m);
    }
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
    document.addEventListener('keydown', e => {
      if (e.target.matches('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '1') setMode('browse'); else if (e.key === '2') setMode('cards'); else if (e.key === '3') setMode('quiz'); else if (e.key === '4') setMode('dance');
    });
    modes.browse.enter();
    $('#loading').classList.add('done');
    setTimeout(() => $('#loading').remove(), 400);
    window.__kostra = { viewer, setMode, modes };   // pro ladění v konzoli
  } catch (err) {
    console.error(err);
    text.textContent = 'Nepodařilo se načíst model: ' + err.message + '. Zkus stránku obnovit.';
    $('.spinner').hidden = true;
  }
}
init();
