/* localStorage wrapper. All persistent state goes through here. */

window.Store = (function () {
  const KEYS = {
    entries: "eidothea.entries",
    users: "eidothea.users",
    session: "eidothea.session",
    fx: "eidothea.fx"
  };

  // In-memory fallback for when storage is blocked (private mode, etc.)
  const memory = {};

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return key in memory ? memory[key] : fallback;
    }
  }

  function write(key, value) {
    memory[key] = value;
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* memory copy is enough */ }
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function init() {
    if (!read(KEYS.entries, null)) write(KEYS.entries, clone(SEED.entries));
    if (!read(KEYS.users, null)) write(KEYS.users, clone(SEED.users));
  }

  function reset() {
    write(KEYS.entries, clone(SEED.entries));
    write(KEYS.users, clone(SEED.users));
    write(KEYS.session, null);
  }

  // ----- Entries -----
  function entries() {
    return read(KEYS.entries, []).slice().sort((a, b) => a.designation.localeCompare(b.designation));
  }

  function entry(id) {
    return read(KEYS.entries, []).find(e => e.id === id) || null;
  }

  function saveEntry(e) {
    const all = read(KEYS.entries, []);
    const i = all.findIndex(x => x.id === e.id);
    if (i >= 0) all[i] = e; else all.push(e);
    write(KEYS.entries, all);
  }

  function deleteEntry(id) {
    const all = read(KEYS.entries, []).filter(e => e.id !== id);
    all.forEach(e => { e.related = (e.related || []).filter(r => r !== id); });
    write(KEYS.entries, all);
  }

  function nextDesignation() {
    const nums = read(KEYS.entries, []).map(e => parseInt(String(e.designation).replace(/\D/g, ""), 10) || 0);
    const n = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return "CX-" + String(n).padStart(3, "0");
  }

  // ----- Users -----
  function users() { return read(KEYS.users, []); }
  function saveUsers(list) { write(KEYS.users, list); }

  // ----- Session / prefs -----
  function session() { return read(KEYS.session, null); }
  function setSession(s) { write(KEYS.session, s); }
  function fx() { return read(KEYS.fx, true); }
  function setFx(on) { write(KEYS.fx, on); }

  return {
    init, reset,
    entries, entry, saveEntry, deleteEntry, nextDesignation,
    users, saveUsers,
    session, setSession, fx, setFx
  };
})();
