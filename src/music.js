/* Hudba k tancům: originální skladby ve stylu daných žánrů, syntetizované přímo v prohlížeči (WebAudio).
   Nejde o původní nahrávky známých písní (ty jsou chráněné autorským právem), ale o vlastní smyčky se stejným tempem a výrazem.
   Skladba = několik taktů po 16 krocích; bicí jsou řetězce („x“ úder, „X“ silný, „o“ tichý, „.“ ticho). */

const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const noteMidi = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); if (!m) return null; return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); };
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const toks = s => s.trim().split(/\s+/);

/* ---------- definice skladeb ---------- */
// chords: pole taktů, každý { n: [noty], r: rytmus 16 znaků }; bass: { root: [noty po taktech], p: vzor z r(oot) o(ctave) f(ifth) b(7) t(hird), third }
export const SONGS = {
  wave: {
    label: 'veselý pop, 100 BPM', bpm: 100, bars: 4,
    drums: { kick: 'x.......x...x...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', shaker: 'x.xxx.xxx.xxx.xx' },
    chords: [{ n: ['C4', 'E4', 'G4'] }, { n: ['B3', 'D4', 'G4'] }, { n: ['C4', 'E4', 'A4'] }, { n: ['C4', 'F4', 'A4'] }].map(c => ({ ...c, r: 'x..x..x.x..x..x.' })), chordVoice: 'pluck',
    bass: { root: ['C2', 'G2', 'A2', 'F2'], p: 'r.....o.r.....f.', third: 4, wave: 'triangle' },
    lead: ['E5 . . G5 . . E5 . D5 . C5 . . . . .', 'D5 . . F5 . . D5 . B4 . D5 . . . . .', 'C5 . . E5 . . A5 . G5 . E5 . . . . .', 'A4 . C5 . F5 . E5 . D5 . C5 . . . . .'], leadVoice: 'bell',
  },
  jump: {
    label: 'chiptune, 120 BPM', bpm: 120, bars: 4,
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    arp: [{ n: ['A3', 'C4', 'E4'], p: '0120 1210 0124 2102' }, { n: ['F3', 'A3', 'C4'], p: '0120 1210 0124 2102' }, { n: ['C4', 'E4', 'G4'], p: '0120 1210 0124 2102' }, { n: ['G3', 'B3', 'D4'], p: '0120 1210 0124 2102' }],
    bass: { root: ['A2', 'F2', 'C3', 'G2'], p: 'r.o.r.o.r.o.r.o.', third: 3, wave: 'square' },
    lead: ['A5 . . E5 . A5 . C6 . B5 . A5 . . . .', 'A5 . . C5 . F5 . A5 . G5 . F5 . . . .', 'G5 . . E5 . G5 . C6 . D6 . C6 . . . .', 'B5 . . G5 . D5 . G5 . A5 . B5 . . . .'], leadVoice: 'chip',
  },
  backflip: {
    label: 'energická elektro-rocková, 120 BPM', bpm: 120, bars: 4,
    drums: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', crash: 'x...............' },
    chords: [{ n: ['E3', 'B3', 'E4'] }, { n: ['C3', 'G3', 'C4'] }, { n: ['G3', 'D4', 'G4'] }, { n: ['D3', 'A3', 'D4'] }].map(c => ({ ...c, r: 'x.xxx.xxx.xxx.xx' })), chordVoice: 'power',
    bass: { root: ['E2', 'C2', 'G2', 'D2'], p: 'rrrrrrrrrrrrrrrr', third: 3, wave: 'sawtooth' }, riser: [3],
    lead: ['B4 . . . E5 . . . B4 . . D5 E5 . . .', 'G4 . . . C5 . . . G4 . . B4 C5 . . .', 'D5 . . . G5 . . . D5 . . F5 G5 . . .', 'A4 . . . D5 . . . F5 . A5 . . . . .'], leadVoice: 'saw',
  },
  shuffle: {
    label: 'house, 133 BPM', bpm: 133.33, bars: 4,
    drums: { kick: 'x...x...x...x...', ohat: '..x...x...x...x.', hat: 'x.xxx.xxx.xxx.xx', clap: '....x.......x...' },
    chords: [{ n: ['A3', 'C4', 'E4', 'G4'] }, { n: ['A3', 'C4', 'E4', 'G4'] }, { n: ['F3', 'A3', 'C4', 'E4'] }, { n: ['G3', 'B3', 'D4', 'F4'] }].map(c => ({ ...c, r: '..x...x...x...x.' })), chordVoice: 'stab',
    bass: { root: ['A1', 'A1', 'F1', 'G1'], p: '.rr.or.r.rr.or.r', third: 3, wave: 'sawtooth' },
    lead: ['E5 . . . C5 . . . A4 . . . . . . .', 'E5 . . . C5 . . . G4 . . . . . . .', 'C5 . . . A4 . . . F4 . . . . . . .', 'D5 . . . B4 . . . G4 . . . . . . .'], leadVoice: 'pluck',
  },
  hiphop: {
    label: 'boom-bap, 90 BPM', bpm: 90, bars: 4, swing: 0.14,
    drums: { kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', ghost: '.......o.....o..' },
    chords: [{ n: ['D4', 'F4', 'A4', 'C5'] }, { n: ['D4', 'F4', 'A4', 'C5'] }, { n: ['Bb3', 'D4', 'F4', 'A4'] }, { n: ['A3', 'C#4', 'E4', 'G4'] }].map(c => ({ ...c, r: 'x..x....x.......' })), chordVoice: 'rhodes',
    bass: { root: ['D2', 'D2', 'Bb1', 'A1'], p: 'r.....f..o..r...', third: 3, wave: 'sine' },
    lead: ['A4 . . . . . C5 . . . A4 . . . . .', 'F4 . . . . . A4 . . . F4 . . . . .', 'D4 . . . . . F4 . . . D4 . . . . .', 'E4 . . . . . G4 . . . E4 . . . . .'], leadVoice: 'rhodes',
  },
  popping: {
    label: 'elektro-funk, 150 BPM', bpm: 150, bars: 4,
    drums: { kick: 'x.....x...x...x.', snare: '....x.......x...', clap: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', cow: 'x..x....x..x....' },
    chords: [{ n: ['E3', 'G3', 'B3'] }, { n: ['E3', 'G3', 'B3'] }, { n: ['C3', 'E3', 'G3'] }, { n: ['D3', 'F#3', 'A3'] }].map(c => ({ ...c, r: 'x.x...x.x.....x.' })), chordVoice: 'stab',
    bass: { root: ['E2', 'E2', 'C2', 'D2'], p: 'r..r.r.o..r.f...', third: 3, wave: 'square' },
    lead: ['E4 . G4 . A4 . B4 . . . G4 . E4 . . .', 'E4 . G4 . A4 . B4 . . . D5 . B4 . . .', 'C4 . E4 . G4 . A4 . . . G4 . E4 . . .', 'D4 . F#4 . A4 . B4 . . . A4 . F#4 . . .'], leadVoice: 'saw',
  },
  locking: {
    label: 'funk, 120 BPM', bpm: 120, bars: 4, swing: 0.1,
    drums: { kick: 'x.....x..x.x....', snare: '....x.o.....x..x', hat: 'x.xxx.xxx.xxx.xx', ohat: '..............x.' },
    chords: [{ n: ['E4', 'G#4', 'D5'] }, { n: ['E4', 'G#4', 'D5'] }, { n: ['A4', 'C#5', 'G5'] }, { n: ['B4', 'D#5', 'A5'] }].map(c => ({ ...c, r: 'x.xx.x.xx.xx.x.x' })), chordVoice: 'scratch',
    bass: { root: ['E2', 'E2', 'A2', 'B2'], p: 'r..r.ro..f.r.o.b', third: 3, wave: 'sawtooth' },
    horn: [{ n: ['E4', 'G#4', 'B4', 'D5'], r: 'x......x........' }, { n: ['E4', 'G#4', 'B4', 'D5'], r: '................' }, { n: ['A4', 'C#5', 'E5', 'G5'], r: 'x......x........' }, { n: ['B4', 'D#5', 'F#5', 'A5'], r: 'x...x...x.......' }],
    lead: [], leadVoice: 'saw',
  },
  breaking: {
    label: 'breakbeat, 100 BPM', bpm: 100, bars: 4,
    drums: { kick: 'x.....x..x....x.', snare: '....x..o.o..x..x', hat: 'xxxxxxxxxxxxxxxx', ohat: '..............x.', cow: '......x.......x.' },
    chords: [{ n: ['C4', 'Eb4', 'G4', 'Bb4'] }, { n: ['C4', 'Eb4', 'G4', 'Bb4'] }, { n: ['Ab3', 'C4', 'Eb4', 'G4'] }, { n: ['G3', 'B3', 'D4', 'F4'] }].map(c => ({ ...c, r: 'x.......x..x....' })), chordVoice: 'stab',
    bass: { root: ['C2', 'C2', 'Ab1', 'G1'], p: 'r..r..o.r.f..r..', third: 3, wave: 'sawtooth' },
    horn: [{ n: ['C5', 'Eb5', 'G5'], r: 'x.......x......x' }, { n: ['C5', 'Eb5', 'G5'], r: '................' }, { n: ['Ab4', 'C5', 'Eb5'], r: 'x.......x......x' }, { n: ['G4', 'B4', 'D5'], r: 'x.x.x.x.........' }],
    lead: [], leadVoice: 'saw',
  },
  krump: {
    label: 'temný trap, 120 BPM', bpm: 120, bars: 4,
    drums: { kick: 'x..x....x..x..x.', clap: '....x.......x...', snare: '....x.......x...', hat: 'x.x.x.x.xxxxxxxx' }, sub: true,
    chords: [{ n: ['E3', 'F3', 'B3'] }, { n: ['E3', 'F3', 'B3'] }, { n: ['C3', 'Db3', 'G3'] }, { n: ['D3', 'Eb3', 'A3'] }].map(c => ({ ...c, r: 'x.......x.......' })), chordVoice: 'dark',
    bass: { root: ['E1', 'E1', 'C1', 'D1'], p: 'r..r....r..r..r.', third: 3, wave: 'sine' }, riser: [3], roll: [3],
    lead: [], leadVoice: 'saw',
  },
  orange: {
    label: 'elektro-pop, 128 BPM', bpm: 128, bars: 4,
    drums: { kick: 'x...x...x...x...', ohat: '..x...x...x...x.', hat: 'x.xxx.xxx.xxx.xx', clap: '....x.......x...' },
    arp: [{ n: ['C5', 'E5', 'G5'], p: '0210 1201 0210 1204' }, { n: ['B4', 'D5', 'G5'], p: '0210 1201 0210 1204' }, { n: ['A4', 'C5', 'E5'], p: '0210 1201 0210 1204' }, { n: ['A4', 'C5', 'F5'], p: '0210 1201 0210 1204' }], arpVoice: 'pluck',
    bass: { root: ['C2', 'G1', 'A1', 'F1'], p: 'r.r.o.r.r.r.o.r.', third: 4, wave: 'sawtooth' },
    lead: ['G5 . E5 . G5 . A5 . G5 . E5 . D5 . . .', 'F5 . D5 . F5 . G5 . F5 . D5 . B4 . . .', 'E5 . C5 . E5 . F5 . E5 . C5 . A4 . . .', 'F5 . A5 . G5 . F5 . E5 . D5 . C5 . . .'], leadVoice: 'bell',
  },
};

/* ---------- syntéza ---------- */
function makeEngine(c, dest) {
  const master = c.createGain(); master.gain.value = 0.7;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.16;
  const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;   // omezovač proti přebuzení
  const post = c.createGain(); post.gain.value = 0.8;
  master.connect(comp); comp.connect(lim); lim.connect(post); post.connect(dest || c.destination);
  const noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const pulse = (duty) => { const n = 32, re = new Float32Array(n), im = new Float32Array(n); for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty); return c.createPeriodicWave(re, im); };
  const pw25 = pulse(0.25);
  const drive = c.createWaveShaper(); { const cur = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cur[i] = Math.tanh(3 * x); } drive.curve = cur; }

  const G = (v = 0) => { const g = c.createGain(); g.gain.value = v; return g; };
  const env = (p, t, peak, atk, dec) => { p.setValueAtTime(0.0001, t); p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk); p.exponentialRampToValueAtTime(0.0001, t + atk + dec); };
  const noise = (t, dur) => { const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; };
  const out = (node) => node.connect(master);

  const E = {
    master, ctx: c,
    kick(t, v = 1, tone = 1) { const o = c.createOscillator(), g = G(); o.frequency.setValueAtTime(165 * tone, t); o.frequency.exponentialRampToValueAtTime(46, t + 0.12); env(g.gain, t, 1.0 * v, 0.002, 0.34); o.connect(g); out(g); o.start(t); o.stop(t + 0.45); },
    kick808(t, f, len, v = 1) { const o = c.createOscillator(), g = G(), ws = c.createWaveShaper(); ws.curve = drive.curve; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); env(g.gain, t, 0.95 * v, 0.004, len); o.connect(ws); ws.connect(g); out(g); o.start(t); o.stop(t + len + 0.1); },
    snare(t, v = 1) { const n = noise(t, 0.3), f = c.createBiquadFilter(), g = G(), o = c.createOscillator(), og = G(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7; env(g.gain, t, 0.7 * v, 0.002, 0.18); n.connect(f); f.connect(g); out(g);
      o.type = 'triangle'; o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.08); env(og.gain, t, 0.5 * v, 0.002, 0.1); o.connect(og); out(og); o.start(t); o.stop(t + 0.2); },
    clap(t, v = 1) { for (let i = 0; i < 3; i++) { const tt = t + i * 0.011, n = noise(tt, 0.2), f = c.createBiquadFilter(), g = G(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 1.1; env(g.gain, tt, 0.55 * v, 0.001, i === 2 ? 0.14 : 0.012); n.connect(f); f.connect(g); out(g); } },
    hat(t, v = 1, open = false) { const n = noise(t, 0.3), f = c.createBiquadFilter(), g = G(); f.type = 'highpass'; f.frequency.value = 7500; env(g.gain, t, 0.28 * v, 0.001, open ? 0.2 : 0.035); n.connect(f); f.connect(g); out(g); },
    shaker(t, v = 1) { const n = noise(t, 0.1), f = c.createBiquadFilter(), g = G(); f.type = 'bandpass'; f.frequency.value = 5500; f.Q.value = 0.8; env(g.gain, t, 0.12 * v, 0.012, 0.05); n.connect(f); f.connect(g); out(g); },
    cow(t, v = 1) { const g = G(), f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2; for (const fr of [540, 800]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 0.25); } env(g.gain, t, 0.3 * v, 0.002, 0.18); f.connect(g); out(g); },
    crash(t, v = 1) { const n = noise(t, 1.4), f = c.createBiquadFilter(), g = G(); f.type = 'highpass'; f.frequency.value = 5000; env(g.gain, t, 0.3 * v, 0.002, 1.2); n.connect(f); f.connect(g); out(g); },
    bass(t, f, len, wave = 'sawtooth', v = 1) { const o = c.createOscillator(), lp = c.createBiquadFilter(), g = G(); o.type = wave; o.frequency.value = f; lp.type = 'lowpass'; lp.Q.value = 4;
      lp.frequency.setValueAtTime(Math.min(8000, f * 7), t); lp.frequency.exponentialRampToValueAtTime(Math.max(120, f * 1.6), t + 0.18);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.006); g.gain.setValueAtTime(0.5 * v, t + Math.max(0.02, len * 0.85)); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(lp); lp.connect(g); out(g); o.start(t); o.stop(t + len + 0.05); },
    voice(kind, t, f, len, v = 1) {
      const g = G(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; const o = c.createOscillator(); let cut0 = 4000, cut1 = 1200, peak = 0.22, atk = 0.004, dec = Math.min(len, 0.4), detune = false;
      if (kind === 'pluck') { o.type = 'sawtooth'; cut0 = 5000; cut1 = 900; dec = Math.min(len, 0.3); }
      else if (kind === 'bell') { o.type = 'triangle'; cut0 = 7000; cut1 = 3000; dec = Math.min(len + 0.15, 0.5); peak = 0.2; const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01; const g2 = G(0.04); o2.connect(g2); g2.connect(lp); o2.start(t); o2.stop(t + dec + 0.1); }
      else if (kind === 'chip') { o.setPeriodicWave(pw25); cut0 = 9000; cut1 = 9000; dec = Math.max(0.08, Math.min(len, 0.25)); peak = 0.17; }
      else if (kind === 'saw') { o.type = 'sawtooth'; detune = true; cut0 = 3800; cut1 = 1500; dec = Math.max(0.1, len); peak = 0.2; }
      else if (kind === 'power') { o.type = 'sawtooth'; detune = true; cut0 = 2600; cut1 = 1800; dec = Math.max(0.08, len * 0.9); peak = 0.17; }
      else if (kind === 'stab') { o.type = 'sawtooth'; detune = true; cut0 = 3200; cut1 = 700; dec = Math.min(len, 0.22); peak = 0.17; }
      else if (kind === 'rhodes') { o.type = 'sine'; cut0 = 2500; cut1 = 1500; dec = Math.min(len + 0.4, 0.9); peak = 0.26; const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = G(0.07); o2.connect(g2); g2.connect(lp); o2.start(t); o2.stop(t + dec + 0.1); }
      else if (kind === 'scratch') { o.type = 'square'; cut0 = 6000; cut1 = 2500; dec = 0.06; peak = 0.12; }
      else if (kind === 'dark') { o.type = 'sawtooth'; detune = true; cut0 = 1500; cut1 = 400; dec = Math.min(len, 0.5); peak = 0.2; }
      o.frequency.value = f; lp.frequency.setValueAtTime(cut0, t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, cut1), t + dec);
      env(g.gain, t, peak * v, atk, dec); o.connect(lp); lp.connect(g); out(g); o.start(t); o.stop(t + dec + atk + 0.1);
      if (detune) { const o3 = c.createOscillator(); o3.type = o.type; o3.frequency.value = f; o3.detune.value = 9; o3.connect(lp); o3.start(t); o3.stop(t + dec + atk + 0.1); }
    },
    riser(t, dur) { const n = noise(t, dur + 0.05), f = c.createBiquadFilter(), g = G(); f.type = 'bandpass'; f.Q.value = 1.5; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.04); n.connect(f); f.connect(g); out(g); },
  };
  return E;
}

/* ---------- naplánování jednoho 16tinového kroku ---------- */
function scheduleStep(E, song, step, t, stepDur) {
  const bar = Math.floor(step / 16) % song.bars, i = step % 16, d = song.drums, vel = ch => (ch === 'X' ? 1.25 : ch === 'o' ? 0.45 : 1);
  const hit = (name, fn) => { const ch = d[name]?.[i]; if (ch && ch !== '.') fn(vel(ch)); };
  hit('kick', v => (song.sub ? (E.kick(t, v * 0.7, 0.9), E.kick808(t, 41, 0.5, v * 0.9)) : E.kick(t, v)));
  hit('snare', v => E.snare(t, v)); hit('clap', v => E.clap(t, v)); hit('ghost', v => E.snare(t, 0.35 * v));
  hit('hat', v => E.hat(t, (i % 4 === 0 ? 1 : 0.6) * v)); hit('ohat', v => E.hat(t, 0.9 * v, true));
  hit('shaker', v => E.shaker(t, (i % 2 ? 0.6 : 1) * v)); hit('cow', v => E.cow(t, v)); hit('crash', v => { if (bar === 0) E.crash(t, v); });
  // vzestupy a vířivé bicí v posledním taktu
  if (song.roll?.includes(bar) && i >= 8) { E.snare(t, 0.4 + 0.5 * ((i - 8) / 8)); }
  if (song.riser?.includes(bar) && i === 0) E.riser(t, stepDur * 16);
  // akordy
  const ch = song.chords?.[bar]; if (ch && ch.r[i] === 'x') for (const n of ch.n) E.voice(song.chordVoice, t, hz(noteMidi(n)), stepDur * 1.8, 0.55);
  const hn = song.horn?.[bar]; if (hn && hn.r[i] === 'x') for (const n of hn.n) E.voice('stab', t, hz(noteMidi(n)), stepDur * 1.5, 0.7);
  // arpeggio
  const ar = song.arp?.[bar]; if (ar) { const p = ar.p.replace(/\s/g, ''), tk = p[i]; if (tk && tk !== '.') { const idx = +tk, m = idx >= ar.n.length ? noteMidi(ar.n[0]) + 12 : noteMidi(ar.n[idx]); E.voice(song.arpVoice || 'chip', t, hz(m), stepDur * 1.2, 0.6); } }
  // basa
  const b = song.bass; if (b) {
    const tk = b.p[i], root = noteMidi(b.root[bar]), map = { r: 0, o: 12, f: 7, b: 10, t: b.third };
    if (tk && map[tk] !== undefined) {
      let len = stepDur * 0.95; for (let k = i + 1; k < 16 && b.p[k] === '-'; k++) len += stepDur;
      E.bass(t, hz(root + map[tk]), len, b.wave, 1);
    }
  }
  // melodie
  const ld = song.lead?.[bar]; if (ld) { const tk = toks(ld)[i]; if (tk && tk !== '.' && tk !== '-') E.voice(song.leadVoice || 'bell', t, hz(noteMidi(tk)), stepDur * 2.2, 0.85); }
}

/* ---------- přehrávač v reálném čase a offline vykreslení pro kontrolu ---------- */
export function createMusic() {
  let ctx = null, engine = null, timer = null, state = null, on = true, vol = 0.8, speed = 1;
  const ensure = () => {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false; ctx = new AC(); engine = makeEngine(ctx); engine.master.gain.value = on ? vol : 0; }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  };
  const applyGain = () => { if (engine) engine.master.gain.setTargetAtTime(on ? vol : 0, ctx.currentTime, 0.05); };
  function tick() {
    if (!state) return;
    const song = SONGS[state.id];
    while (state.next < ctx.currentTime + 0.18) {
      const stepDur = 60 / song.bpm / 4 / speed, swing = (state.step % 2 ? (song.swing || 0) * stepDur : 0);
      scheduleStep(engine, song, state.step, state.next + swing, stepDur);
      state.next += stepDur; state.step++;
    }
  }
  return {
    get enabled() { return on; },
    setEnabled(v) { on = v; applyGain(); },
    setVolume(v) { vol = v; applyGain(); },
    setSpeed(v) { speed = v; },
    // spustí skladbu; vrací za kolik sekund (od teď) zazní první doba (včetně latence výstupu), aby se k ní mohl přisadit tanec
    start(id, spd = 1) {
      if (!SONGS[id] || !ensure()) return 0;
      this.stop(0); speed = spd;
      const lead = 0.12; state = { id, step: 0, next: ctx.currentTime + lead };
      timer = setInterval(tick, 25); tick();
      return lead + (ctx.outputLatency || ctx.baseLatency || 0);
    },
    stop(fade = 0.25) {
      if (timer) { clearInterval(timer); timer = null; }
      state = null;
      if (engine && fade > 0) { const g = engine.master.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + fade); setTimeout(() => { if (!state) applyGain(); }, fade * 1000 + 40); }
      else if (engine) { engine.master.gain.cancelScheduledValues(ctx.currentTime); applyGain(); }
    },
    // kontrola bez zvukové karty: vykreslí skladbu do paměti a vrátí špičku, RMS a počet nul
    async renderOffline(id, seconds = 8, rate = 22050) {
      const oc = new OfflineAudioContext(1, Math.floor(seconds * rate), rate), E = makeEngine(oc), song = SONGS[id], stepDur = 60 / song.bpm / 4;
      for (let s = 0; stepDur * s < seconds; s++) scheduleStep(E, song, s, stepDur * s + (s % 2 ? (song.swing || 0) * stepDur : 0), stepDur);
      const buf = await oc.startRendering(), ch = buf.getChannelData(0); let peak = 0, sum = 0, zeros = 0; for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; sum += ch[i] * ch[i]; if (a < 1e-5) zeros++; }
      return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / ch.length).toFixed(3), silentShare: +(zeros / ch.length).toFixed(3) };
    },
  };
}
