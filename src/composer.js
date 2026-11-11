import { esc } from './ui.js';
import { customDance } from './choreo.js';

/* Vlastní choreografie: ze sestav hotových tanců si vybereš kroky (fráze), seřadíš je a přehraješ na vybranou hudbu. */
export function createComposer(core) {
  const { DANCES, SONGS, store } = core;
  let el, items = [], playing = false;
  const $ = s => el.querySelector(s);
  const real = () => Object.entries(DANCES).filter(([, d]) => d.group !== 'custom');
  const songOpts = () => Object.entries(SONGS).map(([id, s]) => `<option value="${id}">${esc(s.label)}</option>`).join('');
  const label = ([id, i]) => { const d = DANCES[id], ph = d.phrases[i]; return `${d.emoji} ${ph.n}`; };
  const beats = ([id, i]) => { const d = DANCES[id]; return Math.round(d.phrases[i].d / d.B); };

  function renderCatalog() {
    $('#cp-cat').innerHTML = real().map(([id, d]) => `<details><summary>${d.emoji} ${esc(d.name)}</summary><div class="cp-steps">${d.phrases.map((ph, i) => `<button type="button" class="chip" data-add="${id}:${i}">＋ ${esc(ph.n)} <small>${Math.round(ph.d / d.B)}</small></button>`).join('')}</div></details>`).join('');
  }
  function renderList() {
    const total = items.reduce((s, it) => s + beats(it), 0);
    $('#cp-list').innerHTML = items.length ? items.map((it, k) => `<li><span class="grow">${k + 1}. ${esc(label(it))} <small class="muted">${beats(it)} dob</small></span><button type="button" class="icon-sm" data-up="${k}" aria-label="Posunout výš">↑</button><button type="button" class="icon-sm" data-down="${k}" aria-label="Posunout níž">↓</button><button type="button" class="icon-sm" data-del="${k}" aria-label="Odebrat">✕</button></li>`).join('') : '<li class="muted">Zatím prázdné. Přidej kroky z nabídky níž.</li>';
    $('#cp-total').textContent = items.length ? `${items.length} kroků, ${total} dob` : '';
    $('#cp-play').disabled = !items.length;
  }
  function renderSaved() {
    const list = store.get('choreos', []);
    $('#cp-saved').innerHTML = list.length ? list.map((c, k) => `<li><span class="grow">${esc(c.name)} <small class="muted">${c.items.length} kroků</small></span><button type="button" class="btn small" data-load="${k}">Načíst</button><button type="button" class="icon-sm" data-rm="${k}" aria-label="Smazat">🗑</button></li>`).join('') : '<li class="muted">Žádné uložené sestavy.</li>';
  }
  function play() {
    const song = $('#cp-song').value, cd = customDance(items, SONGS[song].bpm, song, $('#cp-name').value.trim() || 'Moje choreografie');
    if (!cd) return;
    DANCES.__custom = cd; playing = true; core.start('__custom');
    $('#cp-stop').disabled = false;
  }
  return {
    id: 'composer', label: '🧩 Vlastní',
    mount(e) {
      el = e;
      el.innerHTML = `<p class="muted small">Poskládej si vlastní tanec z kroků ostatních tanců. Kroky se přizpůsobí tempu vybrané hudby.</p>
        <h3 class="dgroup">Tvoje sestava <small id="cp-total" class="muted"></small></h3>
        <ol class="cp-list" id="cp-list"></ol>
        <label class="field"><span>Hudba</span><select id="cp-song">${songOpts()}</select></label>
        <div class="row"><button class="btn primary grow" id="cp-play" type="button" disabled>▶ Přehrát</button><button class="btn" id="cp-stop" type="button" disabled>Zastavit</button><button class="btn" id="cp-rand" type="button" title="Náhodná sestava">🎲</button><button class="btn" id="cp-clear" type="button">Vyprázdnit</button></div>
        <div class="row" style="margin-top:8px"><input type="text" id="cp-name" placeholder="Název sestavy" maxlength="40"><button class="btn" id="cp-save" type="button">💾 Uložit</button></div>
        <h3 class="dgroup">Uložené</h3><ul class="cp-list" id="cp-saved"></ul>
        <h3 class="dgroup">Kroky k přidání</h3><div id="cp-cat"></div>`;
      $('#cp-song').value = 'orange';
      renderCatalog(); renderList(); renderSaved();
      el.addEventListener('click', ev => {
        const t = ev.target.closest('button'); if (!t) return;
        const d = t.dataset;
        if (d.add) { const [id, i] = d.add.split(':'); items.push([id, +i]); renderList(); }
        else if (d.up) { const k = +d.up; if (k > 0) { [items[k - 1], items[k]] = [items[k], items[k - 1]]; renderList(); } }
        else if (d.down) { const k = +d.down; if (k < items.length - 1) { [items[k + 1], items[k]] = [items[k], items[k + 1]]; renderList(); } }
        else if (d.del) { items.splice(+d.del, 1); renderList(); }
        else if (d.load) { const c = store.get('choreos', [])[+d.load]; if (c) { items = c.items.filter(([id, i]) => DANCES[id]?.phrases?.[i]); $('#cp-song').value = c.song; $('#cp-name').value = c.name; renderList(); } }
        else if (d.rm) { const l = store.get('choreos', []); l.splice(+d.rm, 1); store.set('choreos', l); renderSaved(); }
      });
      $('#cp-play').onclick = play;
      $('#cp-stop').onclick = () => { core.stopDance(); $('#cp-stop').disabled = true; playing = false; };
      $('#cp-clear').onclick = () => { items = []; renderList(); };
      $('#cp-rand').onclick = () => { const r = real(); items = Array.from({ length: 6 }, () => { const [id, d] = r[Math.floor(Math.random() * r.length)]; return [id, Math.floor(Math.random() * d.phrases.length)]; }); renderList(); };
      $('#cp-save').onclick = () => {
        if (!items.length) return;
        const l = store.get('choreos', []), name = $('#cp-name').value.trim() || `Sestava ${l.length + 1}`;
        l.push({ name, song: $('#cp-song').value, items }); store.set('choreos', l.slice(-20)); renderSaved();
      };
    },
    leave() { playing = false; $('#cp-stop').disabled = true; },
    cleanup() { playing = false; },
  };
}
