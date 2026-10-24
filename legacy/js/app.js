/* Hash router, role-based navigation and effects toggle. */

window.App = (function () {
  const view = document.getElementById("view");
  const nav = document.getElementById("nav");
  const fxBtn = document.getElementById("fx-toggle");

  function parse() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
    return { name: parts[0] || "", arg: parts[1] };
  }

  function route() {
    const { name, arg } = parse();
    switch (name) {
      case "":
        return Views.archive(view, { mode: "all" });
      case "classified":
        return Auth.can("read:classified") ? Views.archive(view, { mode: "classified" }) : Views.denied(view, 1);
      case "entry":
        return Views.entry(view, { id: arg });
      case "new":
        return Views.editor(view, {});
      case "edit":
        return Views.editor(view, { id: arg });
      case "personnel":
        return Views.personnel(view);
      case "login":
        return Views.login(view);
      default:
        return Views.notFound(view);
    }
  }

  function drawNav() {
    const user = Auth.current();
    const current = parse().name;
    const items = [{ href: "#/", key: "", label: "ARCHIVE" }];
    if (Auth.can("read:classified")) items.push({ href: "#/classified", key: "classified", label: "SEALED FILES" });
    if (Auth.can("edit")) items.push({ href: "#/new", key: "new", label: "NEW ENTRY" });
    if (Auth.can("users")) items.push({ href: "#/personnel", key: "personnel", label: "PERSONNEL" });

    nav.innerHTML =
      items.map(i => `<a href="${i.href}" class="glitch${i.key === current ? " active" : ""}" data-text="${i.label}">${i.label}</a>`).join("") +
      (user.username
        ? `<span class="whoami"><b>${escapeHTML(user.label.toUpperCase())}</b> ${escapeHTML(user.username)} · LVL ${user.level}</span>
           <button type="button" class="link-btn" id="logout">[LOG OUT]</button>`
        : `<span class="whoami">VISITOR · LVL 0</span>
           <a href="#/login" class="${current === "login" ? "active" : ""}">LOG IN</a>`);

    const out = nav.querySelector("#logout");
    if (out) out.addEventListener("click", () => { Auth.logout(); go("#/"); });
  }

  function render() {
    drawNav();
    route();
    window.scrollTo(0, 0);
    view.focus({ preventScroll: true });
  }

  // Navigate, re-rendering even when the hash is already the target
  function go(hash) {
    if (location.hash === hash || (hash === "#/" && location.hash === "")) render();
    else location.hash = hash;
  }

  // ----- Effects -----
  function applyFx(on) {
    document.body.classList.toggle("fx-off", !on);
    fxBtn.textContent = on ? "[FX: ON]" : "[FX: OFF]";
  }

  fxBtn.addEventListener("click", () => {
    const on = !Store.fx();
    Store.setFx(on);
    applyFx(on);
  });

  // An occasional, very brief page hiccup
  const reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function scheduleHiccup() {
    setTimeout(() => {
      if (Store.fx() && !reduced.matches && !document.hidden) {
        document.body.classList.add("hiccup");
        setTimeout(() => document.body.classList.remove("hiccup"), 200);
      }
      scheduleHiccup();
    }, 15000 + Math.random() * 25000);
  }

  // ----- Boot -----
  Store.init();
  applyFx(Store.fx());
  window.addEventListener("hashchange", render);
  render();
  scheduleHiccup();

  return { go, render };
})();
