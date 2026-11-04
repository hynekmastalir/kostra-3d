// Bezpečný obal nad localStorage (v soukromém režimu může házet výjimky).
const PREFIX = 'kostra3d:';
export const store = {
  get(key, def) {
    try { const v = localStorage.getItem(PREFIX + key); return v === null ? def : JSON.parse(v); } catch { return def; }
  },
  set(key, val) { try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); } catch { /* ignoruj */ } },
};
