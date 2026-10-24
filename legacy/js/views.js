/* View renderers. Each takes the <main> element and route params, writes
   its markup, and wires up its own events. Every piece of stored text goes
   through escapeHTML (or Redact.render, which escapes first). */

window.Views = (function () {
  const esc = escapeHTML;

  const THREAT = {
    1: "I · BENIGN",
    2: "II · UNSETTLING",
    3: "III · HOSTILE",
    4: "IV · LETHAL",
    5: "V · UNCLASSIFIABLE"
  };

  function threatMeter(level) {
    let pips = "";
    for (let i = 1; i <= 5; i++) pips += `<span class="pip${i <= level ? " on" : ""}"></span>`;
    return `<span class="threat t${level}" title="Threat level ${esc(THREAT[level])}"><span class="pips">${pips}</span>${esc(THREAT[level])}</span>`;
  }

  // Two-click confirmation, since the artifact viewer and some browsers block confirm()
  function armConfirm(btn, onConfirm) {
    const label = btn.textContent;
    let timer = null;
    btn.addEventListener("click", () => {
      if (btn.classList.contains("armed")) {
        clearTimeout(timer);
        onConfirm();
        return;
      }
      btn.classList.add("armed");
      btn.textContent = "CONFIRM?";
      timer = setTimeout(() => {
        btn.classList.remove("armed");
        btn.textContent = label;
      }, 3000);
    });
  }

  // ---------------------------------------------------------------- Archive
  function archive(root, params) {
    const onlyClassified = params.mode === "classified";
    const title = onlyClassified ? "SEALED FILES" : "THE ARCHIVE";
    const lede = onlyClassified
      ? "Entries restricted to cleared personnel. Do not discuss their contents off this terminal."
      : "Recovered accounts of things seen at the edges of roads, rivers and rooms. Some files are sealed. Some passages have been removed for your protection.";

    root.innerHTML = `
      <h1 class="flicker">${title}</h1>
      <p class="lede">${lede}</p>
      <div class="toolbar">
        <input type="search" id="q" placeholder="> search name, location, designation" aria-label="Search entries">
        <select id="tl" aria-label="Filter by threat level">
          <option value="">ALL THREAT LEVELS</option>
          ${[1, 2, 3, 4, 5].map(n => `<option value="${n}">${THREAT[n]}</option>`).join("")}
        </select>
      </div>
      <div class="grid" id="list"></div>`;

    const list = root.querySelector("#list");
    const q = root.querySelector("#q");
    const tl = root.querySelector("#tl");

    function draw() {
      const term = q.value.trim().toLowerCase();
      const threat = Number(tl.value) || 0;
      const items = Store.entries().filter(e => {
        if (onlyClassified && e.classification !== "classified") return false;
        const readable = Auth.canRead(e);
        // Sealed files only match on designation, so the search box can't leak details
        const hay = readable ? [e.designation, e.name, e.location, e.summary].join(" ") : e.designation;
        if (term && !hay.toLowerCase().includes(term)) return false;
        if (threat && (!readable || e.threatLevel !== threat)) return false;
        return true;
      });

      list.innerHTML = items.length
        ? items.map(e => Auth.canRead(e) ? card(e) : sealedCard(e)).join("")
        : `<p class="empty">NO MATCHING RECORDS. OR NONE YOU ARE PERMITTED TO SEE.</p>`;
    }

    q.addEventListener("input", draw);
    tl.addEventListener("change", draw);
    draw();
  }

  function card(e) {
    const cls = e.classification === "classified" ? " classified" : "";
    return `
      <a class="card${cls}" href="#/entry/${encodeURIComponent(e.id)}">
        <div class="desig"><span>${esc(e.designation)}${cls ? " · CLASSIFIED" : ""}</span>${threatMeter(e.threatLevel)}</div>
        <h3 class="glitch" data-text="${esc(e.name)}">${esc(e.name)}</h3>
        <div class="loc">${esc(e.location)}</div>
        <p>${esc(e.summary)}</p>
      </a>`;
  }

  function sealedCard(e) {
    const width = Math.max(6, Math.min(16, (e.name || "").length * 0.6));
    return `
      <div class="card sealed" title="Clearance level 1 required">
        <div class="desig"><span>${esc(e.designation)} · SEALED</span><span>THREAT ██</span></div>
        <h3><span class="sealed-name" style="width:${width}em" aria-label="name withheld"></span></h3>
        <div class="loc">LOCATION WITHHELD</div>
        <p>This file is restricted to Field Agents and above.</p>
      </div>`;
  }

  // ---------------------------------------------------------------- Entry
  function entry(root, params) {
    const e = Store.entry(params.id);
    if (!e) return notFound(root);
    if (!Auth.canRead(e)) return denied(root, 1);

    const user = Auth.current();
    const level = user.level;
    const classified = e.classification === "classified";
    const related = (e.related || []).map(id => Store.entry(id)).filter(Boolean);

    root.innerHTML = `
      <p><a href="#/">&lt; back to archive</a></p>
      <article class="doc">
        <div class="stamp ${classified ? "classified" : "public"}">${classified ? "CLASSIFIED" : "PUBLIC RECORD"}</div>
        <div class="desig-line">FILE ${esc(e.designation)}</div>
        <h1 class="flicker">${esc(e.name)}</h1>

        <dl class="meta">
          <dt>Sighting location</dt><dd>${esc(e.location)}</dd>
          ${e.coordinates ? `<dt>Coordinates</dt><dd>${esc(e.coordinates)}</dd>` : ""}
          <dt>Threat level</dt><dd>${threatMeter(e.threatLevel)}</dd>
          <dt>Classification</dt><dd>${classified ? "Clearance 1+" : "Open access"}</dd>
          <dt>Your clearance</dt><dd>${esc(user.label.toUpperCase())} (LVL ${level})</dd>
        </dl>

        <p class="summary">${esc(e.summary)}</p>

        <h2>Lore</h2>
        <div class="prose">${Redact.render(e.lore, level)}</div>

        <div class="tear" aria-hidden="true"></div>

        <h2>Linked stories</h2>
        ${(e.stories || []).length ? e.stories.map(s => `
          <details class="story">
            <summary><span class="t">${esc(s.title)}</span><span class="by">${esc(s.author)}${s.date ? " · " + esc(s.date) : ""}</span></summary>
            <div class="body prose">${Redact.render(s.body, level)}</div>
          </details>`).join("") : `<p class="empty">NO ACCOUNTS ON FILE.</p>`}

        ${related.length ? `
          <h2>Cross-referenced</h2>
          <ul class="related">
            ${related.map(r => Auth.canRead(r)
              ? `<li><a href="#/entry/${encodeURIComponent(r.id)}"><span class="glitch" data-text="${esc(r.designation)} ${esc(r.name)}">${esc(r.designation)} ${esc(r.name)}</span></a></li>`
              : `<li><a href="#/entry/${encodeURIComponent(r.id)}">${esc(r.designation)} <span class="sealed-name" style="width:6em"></span></a></li>`
            ).join("")}
          </ul>` : ""}

        ${e.updatedAt ? `<p class="revised">Last revised ${esc(e.updatedAt.slice(0, 10))} by ${esc(e.updatedBy || "unknown")}</p>` : ""}

        ${Auth.can("edit") ? `
          <div class="doc-actions">
            <a class="btn" href="#/edit/${encodeURIComponent(e.id)}">EDIT ENTRY</a>
            <button type="button" class="danger" id="del">PURGE ENTRY</button>
          </div>` : ""}
      </article>`;

    const del = root.querySelector("#del");
    if (del) armConfirm(del, () => {
      Store.deleteEntry(e.id);
      location.hash = "#/";
    });
  }

  // ---------------------------------------------------------------- Editor
  function editor(root, params) {
    if (!Auth.can("edit")) return denied(root, 2);

    const existing = params.id ? Store.entry(params.id) : null;
    if (params.id && !existing) return notFound(root);

    const e = existing ? JSON.parse(JSON.stringify(existing)) : {
      id: null,
      designation: Store.nextDesignation(),
      name: "", location: "", coordinates: "",
      threatLevel: 2, classification: "public",
      summary: "", lore: "", stories: [], related: []
    };

    const others = Store.entries().filter(x => x.id !== e.id);

    root.innerHTML = `
      <p><a href="${existing ? "#/entry/" + encodeURIComponent(e.id) : "#/"}">&lt; cancel</a></p>
      <h1 class="flicker">${existing ? "AMEND FILE " + esc(e.designation) : "OPEN NEW FILE"}</h1>
      <form class="editor" id="form" novalidate>
        <div class="field-row">
          <div class="field"><label for="f-des">Designation</label><input id="f-des" value="${esc(e.designation)}" required></div>
          <div class="field"><label for="f-name">Name</label><input id="f-name" value="${esc(e.name)}" required></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="f-loc">Sighting location</label><input id="f-loc" value="${esc(e.location)}"></div>
          <div class="field"><label for="f-coord">Coordinates</label><input id="f-coord" value="${esc(e.coordinates || "")}"></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="f-threat">Threat level</label>
            <select id="f-threat">${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${n === e.threatLevel ? " selected" : ""}>${THREAT[n]}</option>`).join("")}</select>
          </div>
          <div class="field"><label for="f-class">Classification</label>
            <select id="f-class">
              <option value="public"${e.classification === "public" ? " selected" : ""}>PUBLIC: visible to all</option>
              <option value="classified"${e.classification === "classified" ? " selected" : ""}>CLASSIFIED: Field Agent and above</option>
            </select>
          </div>
        </div>
        <div class="field"><label for="f-sum">Summary (always unredacted)</label><textarea id="f-sum" style="min-height:5rem">${esc(e.summary)}</textarea></div>
        <div class="field">
          <label for="f-lore">Lore</label>
          <textarea id="f-lore" style="min-height:14rem">${esc(e.lore)}</textarea>
          <p class="hint">Wrap restricted passages in <code>[[1:…]]</code> (Field Agent+) or <code>[[2:…]]</code> (Archivist+). Leave a blank line between paragraphs.</p>
        </div>
        <div class="field">
          <label>Preview: markers highlighted</label>
          <div class="panel prose" id="preview" style="margin-top:.3rem"></div>
        </div>

        <h2>Linked stories</h2>
        <div id="stories"></div>
        <button type="button" id="add-story">+ ATTACH STORY</button>

        <h2>Cross-references</h2>
        <div class="checks">
          ${others.length ? others.map(o => `
            <label><input type="checkbox" name="rel" value="${esc(o.id)}"${(e.related || []).includes(o.id) ? " checked" : ""}> ${esc(o.designation)} ${esc(o.name)}</label>`).join("") : `<span class="hint">No other files.</span>`}
        </div>

        <div id="err" class="msg error" role="alert"></div>
        <div class="actions">
          <button type="submit">COMMIT TO ARCHIVE</button>
        </div>
      </form>`;

    const form = root.querySelector("#form");
    const storiesEl = root.querySelector("#stories");
    const lore = root.querySelector("#f-lore");
    const preview = root.querySelector("#preview");

    function updatePreview() { preview.innerHTML = Redact.render(lore.value, 3) || "<span class='hint'>(empty)</span>"; }
    lore.addEventListener("input", updatePreview);
    updatePreview();

    let stories = (e.stories || []).slice();

    function collectStories() {
      return Array.from(storiesEl.querySelectorAll(".story-edit")).map(el => ({
        title: el.querySelector("[data-k=title]").value.trim(),
        author: el.querySelector("[data-k=author]").value.trim(),
        date: el.querySelector("[data-k=date]").value.trim(),
        body: el.querySelector("[data-k=body]").value
      }));
    }

    function drawStories() {
      storiesEl.innerHTML = stories.map((s, i) => `
        <div class="story-edit" data-i="${i}">
          <div class="head"><span>ACCOUNT #${i + 1}</span><button type="button" class="danger" data-remove="${i}">DETACH</button></div>
          <div class="field-row">
            <div class="field"><label>Title<input data-k="title" value="${esc(s.title)}"></label></div>
            <div class="field"><label>Author / source<input data-k="author" value="${esc(s.author)}"></label></div>
            <div class="field"><label>Date<input data-k="date" value="${esc(s.date)}" placeholder="YYYY-MM-DD"></label></div>
          </div>
          <div class="field"><label>Body<textarea data-k="body">${esc(s.body)}</textarea></label></div>
        </div>`).join("");
      storiesEl.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
        stories = collectStories();
        stories.splice(Number(btn.dataset.remove), 1);
        drawStories();
      }));
    }
    drawStories();

    root.querySelector("#add-story").addEventListener("click", () => {
      stories = collectStories();
      stories.push({ title: "", author: "", date: "", body: "" });
      drawStories();
      const last = storiesEl.querySelector(".story-edit:last-child [data-k=title]");
      if (last) last.focus();
    });

    form.addEventListener("submit", ev => {
      ev.preventDefault();
      const err = root.querySelector("#err");
      const designation = root.querySelector("#f-des").value.trim().toUpperCase();
      const name = root.querySelector("#f-name").value.trim();

      if (!designation || !name) { err.textContent = "DESIGNATION AND NAME ARE REQUIRED."; return; }
      const clash = Store.entries().find(x => x.designation.toUpperCase() === designation && x.id !== e.id);
      if (clash) { err.textContent = `DESIGNATION ${designation} IS ALREADY ASSIGNED TO ANOTHER FILE.`; return; }

      const id = e.id || designation.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
      const saved = {
        id,
        designation,
        name,
        location: root.querySelector("#f-loc").value.trim(),
        coordinates: root.querySelector("#f-coord").value.trim(),
        threatLevel: Number(root.querySelector("#f-threat").value),
        classification: root.querySelector("#f-class").value,
        summary: root.querySelector("#f-sum").value.trim(),
        lore: lore.value,
        stories: collectStories().filter(s => s.title || s.body.trim()),
        related: Array.from(root.querySelectorAll("input[name=rel]:checked")).map(c => c.value),
        updatedBy: Auth.current().username,
        updatedAt: new Date().toISOString()
      };
      Store.saveEntry(saved);
      location.hash = "#/entry/" + encodeURIComponent(id);
    });
  }

  // ---------------------------------------------------------------- Login
  function login(root) {
    const user = Auth.current();
    root.innerHTML = `
      <div class="terminal">
        <div class="boot">
          EIDOTHEA TERMINAL 7<br>
          LINK ESTABLISHED .......... OK<br>
          ${user.username ? `CURRENT SESSION .......... ${esc(user.username.toUpperCase())}` : "IDENTIFY YOURSELF."}
        </div>
        <form id="login" novalidate>
          <div class="field"><label for="u">Operator ID</label><input id="u" autocomplete="username" autocapitalize="off" spellcheck="false" required></div>
          <div class="field"><label for="p">Passphrase</label><input id="p" type="password" autocomplete="current-password" required></div>
          <div id="err" class="msg error" role="alert"></div>
          <div class="actions">
            <button type="submit">AUTHENTICATE</button>
            <button type="button" id="anon" class="link-btn">continue as visitor</button>
          </div>
        </form>
      </div>
      <aside class="scrap">
        Found taped under the keyboard:
        <ul>
          <li><code>visitor / visitor</code></li>
          <li><code>agent / agent</code></li>
          <li><code>archivist / archivist</code></li>
          <li><code>overseer / overseer</code></li>
        </ul>
      </aside>`;

    const u = root.querySelector("#u");
    u.focus();

    root.querySelector("#login").addEventListener("submit", ev => {
      ev.preventDefault();
      if (Auth.login(u.value, root.querySelector("#p").value)) {
        App.go("#/");
      } else {
        root.querySelector("#err").textContent = "ACCESS DENIED. THIS ATTEMPT HAS BEEN LOGGED.";
        root.querySelector("#p").value = "";
      }
    });

    root.querySelector("#anon").addEventListener("click", () => {
      Auth.logout();
      App.go("#/");
    });
  }

  // ---------------------------------------------------------------- Personnel
  function personnel(root) {
    if (!Auth.can("users")) return denied(root, 3);

    const me = Auth.current();
    const users = Store.users();
    const overseers = users.filter(u => u.role === "overseer").length;
    const roleOptions = sel => Object.keys(Auth.ROLES).map(r =>
      `<option value="${r}"${r === sel ? " selected" : ""}>${esc(Auth.ROLES[r].label)} (LVL ${Auth.ROLES[r].level})</option>`).join("");

    root.innerHTML = `
      <h1 class="flicker">PERSONNEL</h1>
      <p class="lede">Clearance changes take effect immediately. There must always be one Overseer.</p>
      <div id="msg" class="msg" role="status"></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Operator</th><th>Clearance</th><th></th></tr></thead>
          <tbody>
            ${users.map(u => {
              const isMe = u.username === me.username;
              const lastOverseer = u.role === "overseer" && overseers <= 1;
              return `<tr>
                <td class="${isMe ? "you" : ""}">${esc(u.username)}${isMe ? " (you)" : ""}</td>
                <td><select data-role="${esc(u.username)}" aria-label="Role for ${esc(u.username)}"${lastOverseer ? " disabled title='Last Overseer cannot be demoted'" : ""}>${roleOptions(u.role)}</select></td>
                <td><button type="button" class="danger" data-del="${esc(u.username)}"${isMe || lastOverseer ? " disabled" : ""}>REVOKE</button></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>

      <section class="panel">
        <h3>Enrol operator</h3>
        <form id="new-user" novalidate>
          <div class="field-row" style="margin-top:1rem">
            <div class="field"><label for="nu">Operator ID</label><input id="nu" autocapitalize="off" spellcheck="false"></div>
            <div class="field"><label for="np">Passphrase</label><input id="np" type="text" autocomplete="off"></div>
            <div class="field"><label for="nr">Clearance</label><select id="nr">${roleOptions("visitor")}</select></div>
          </div>
          <div id="nerr" class="msg error" role="alert"></div>
          <button type="submit">ENROL</button>
        </form>
      </section>

      <section class="panel">
        <h3>Purge &amp; restore</h3>
        <p class="hint">Restores the six original files and the four default operators. All edits and new operators will be lost, and you will be logged out.</p>
        <button type="button" class="danger" id="reset">RESET ARCHIVE</button>
      </section>`;

    const msg = root.querySelector("#msg");

    root.querySelectorAll("[data-role]").forEach(sel => sel.addEventListener("change", () => {
      const list = Store.users();
      const u = list.find(x => x.username === sel.dataset.role);
      u.role = sel.value;
      Store.saveUsers(list);
      // Demoting yourself drops your access to this page
      if (u.username === me.username && sel.value !== "overseer") return App.go("#/");
      personnel(root);
      root.querySelector("#msg").textContent = `${u.username.toUpperCase()} RECLASSIFIED: ${Auth.ROLES[u.role].label.toUpperCase()}.`;
      root.querySelector("#msg").className = "msg ok";
    }));

    root.querySelectorAll("[data-del]").forEach(btn => armConfirm(btn, () => {
      Store.saveUsers(Store.users().filter(x => x.username !== btn.dataset.del));
      personnel(root);
      root.querySelector("#msg").textContent = `${btn.dataset.del.toUpperCase()} HAS BEEN REMOVED FROM ALL RECORDS.`;
      root.querySelector("#msg").className = "msg ok";
    }));

    root.querySelector("#new-user").addEventListener("submit", ev => {
      ev.preventDefault();
      const nerr = root.querySelector("#nerr");
      const name = root.querySelector("#nu").value.trim().toLowerCase();
      const pass = root.querySelector("#np").value;
      const role = root.querySelector("#nr").value;
      if (!/^[a-z0-9_-]{3,20}$/.test(name)) { nerr.textContent = "ID MUST BE 3–20 CHARACTERS: a-z 0-9 _ -"; return; }
      if (!pass) { nerr.textContent = "PASSPHRASE REQUIRED."; return; }
      if (Store.users().some(x => x.username === name)) { nerr.textContent = "OPERATOR ALREADY EXISTS."; return; }
      Store.saveUsers(Store.users().concat({ username: name, password: pass, role }));
      personnel(root);
      root.querySelector("#msg").textContent = `${name.toUpperCase()} ENROLLED AS ${Auth.ROLES[role].label.toUpperCase()}.`;
      root.querySelector("#msg").className = "msg ok";
    });

    armConfirm(root.querySelector("#reset"), () => {
      Store.reset();
      App.go("#/login");
    });
  }

  // ---------------------------------------------------------------- Errors
  function denied(root, need) {
    const user = Auth.current();
    root.innerHTML = `
      <div class="denied">
        <h1 class="flicker glitch" data-text="ACCESS DENIED">ACCESS DENIED</h1>
        <p>Clearance level ${need} required. You are ${esc(user.label.toUpperCase())} (LVL ${user.level}).</p>
        <p>This attempt has been noted in your file.</p>
        <p><a href="#/">&lt; return to archive</a>${user.username ? "" : ` · <a href="#/login">authenticate</a>`}</p>
      </div>`;
  }

  function notFound(root) {
    root.innerHTML = `
      <div class="denied">
        <h1 class="flicker">FILE NOT FOUND</h1>
        <p>There is no record here. There may never have been.</p>
        <p><a href="#/">&lt; return to archive</a></p>
      </div>`;
  }

  return { archive, entry, editor, login, personnel, denied, notFound };
})();
