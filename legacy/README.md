# The Unlit Archive

A static creepypasta and cryptid archive. It is plain HTML, CSS and JS with no build step and no backend. All data lives in your browser's `localStorage`.

## Run

Open `index.html` in a browser. Serving the folder also works:

```sh
python -m http.server 8000   # then visit http://localhost:8000
```

## Demo accounts

| Login | Role | Clearance | Can |
|---|---|---|---|
| *(none)* / `visitor` | Visitor | 0 | Read public files; classified files are sealed |
| `agent` | Field Agent | 1 | Read classified files and level-1 passages |
| `archivist` | Archivist | 2 | Read everything, create, edit and purge entries |
| `overseer` | Overseer | 3 | All of the above, plus manage operators and reset the archive |

The password is the same as the username. This login is set dressing only: passwords are stored in plain text in `localStorage`.

## Redaction markup

In lore and story text:

```
Ordinary text. [[1:Only Field Agents and up can read this.]] [[2:Archivists and up.]]
```

Readers below the required level see a black bar instead of the text. The hidden text is never written to the page. Leave a blank line between paragraphs.

## Files

```
index.html        page shell and overlays
css/base.css      layout, palette, components
css/effects.css   scanlines, static, flicker, glitch, redaction bars
js/seed.js        the 6 original entries and default operators
js/store.js       localStorage access, seeding, reset
js/auth.js        roles, clearance, login and logout
js/redact.js      HTML escaping and redaction rendering
js/views.js       archive, entry, editor, login, personnel, error views
js/app.js         hash router, role-based nav, FX toggle
```

`[FX: ON/OFF]` in the footer turns off all motion and overlays. Animations also stop automatically when the OS has reduced motion enabled.

To restore the original data, log in as Overseer and use Personnel → Reset archive, or clear the site's storage.
