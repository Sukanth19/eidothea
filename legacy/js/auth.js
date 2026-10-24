/* Fake authentication. Passwords sit in localStorage as plain text:
   this is set dressing, not security. */

window.Auth = (function () {
  const ROLES = {
    visitor:   { label: "Visitor",     level: 0 },
    agent:     { label: "Field Agent", level: 1 },
    archivist: { label: "Archivist",   level: 2 },
    overseer:  { label: "Overseer",    level: 3 }
  };

  const ANON = { username: null, role: "visitor", level: 0, label: "Visitor" };

  // Minimum clearance for each action
  const ACTIONS = {
    "read:classified": 1,
    "edit": 2,
    "users": 3
  };

  function current() {
    const s = Store.session();
    if (!s) return ANON;
    const u = Store.users().find(x => x.username === s.username);
    if (!u || !ROLES[u.role]) { Store.setSession(null); return ANON; }
    return { username: u.username, role: u.role, level: ROLES[u.role].level, label: ROLES[u.role].label };
  }

  function login(username, password) {
    const u = Store.users().find(x => x.username === username.trim().toLowerCase() && x.password === password);
    if (!u) return false;
    Store.setSession({ username: u.username });
    return true;
  }

  function logout() { Store.setSession(null); }

  function can(action) { return current().level >= ACTIONS[action]; }

  function canRead(entry) {
    return entry.classification !== "classified" || can("read:classified");
  }

  return { ROLES, current, login, logout, can, canRead };
})();
