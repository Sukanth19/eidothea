# Eidothea

**Eidothea** is a dark-themed knowledge archive built for exploring internet horror, fictional universes, and unexplained stories.
The platform organizes creepypastas, SCP entries, cryptids, game lore, and real-life mysteries into structured archive entries while allowing the community to discuss ideas through dedicated discussion threads.

Eidothea blends **curated knowledge with community exploration**, creating a digital archive where readers can navigate mysterious stories, theories, and lore in a structured environment.

---

## Overview

Eidothea is designed around two core ideas:

**Structured Knowledge**

Official lore entries are organized as canonical archive pages that present curated information in a clean, readable format.

**Community Discussion**

Each archive entry supports discussion threads where users can explore interpretations, theories, and ideas without modifying the original canon.

This separation preserves the integrity of the archive while allowing the community to participate.

---

## Core Features

### Archive System

A structured archive of mysterious knowledge including:

* Creepypastas
* SCP entries
* Cryptids
* Game and fictional universe lore
* Curated mystery archives

Each entry is presented as a clean lore page designed for long-form reading.

---

### Discussion Threads

Every lore entry contains a dedicated thread system where users can:

* share theories
* discuss interpretations
* expand on canon material

Threads allow community exploration without altering official entries.

---

### Real Life Stories

A separate section allows users to publish real-world mysterious experiences.

Examples include:

* personal unexplained events
* urban legends
* internet mysteries

Users can create, edit, and manage their own submissions.

---

### User System

Accounts enable users to interact with the archive.

Features include:

* user registration and login
* bookmarking archive entries
* reading history tracking
* user profiles

---

### Moderation Roles

The platform uses a simple role hierarchy.

**Owner**

* full system control

**Admin**

* manages lore entries
* moderates threads

**User**

* publishes stories
* participates in discussions

---

## Current Implementation

A creepypasta archive. It's seeded with about 3,500 stories from the
[DavidGetter1/creepypastas](https://huggingface.co/datasets/DavidGetter1/creepypastas) dataset, and users can sign up and add their own.

```
api/      Python: FastAPI + SQLite (users, sessions, stories), pandas importer
web/      Next.js 16 + React 19 + Motion (the website)
data/     archive.db lives here (created on first run, not committed)
legacy/   the original static HTML/CSS/JS version
dev.sh    starts both servers
```

### Run it

```sh
./dev.sh
```

Then open http://localhost:3000. The first run creates the Python venv, installs the npm packages and imports the dataset.

### Make yourself the Overseer (once)

```sh
cd api
.venv/bin/python create_overseer.py <your-username>
```

It asks for a password. Only one Overseer can exist, and the website can't create or assign one. To change its password later, use `create_overseer.py <name> --reset`.

### Roles

| Role | Can |
|---|---|
| Visitor (logged out) | Read everything |
| User | Write stories; edit and delete **only their own** |
| Moderator | Edit and delete **any** story |
| Admin | Moderator powers, plus promote users to moderator and remove accounts below admin |
| Overseer | Everything, including appointing and removing admins |

Users who sign up start as **User**. Promote them on the **Control** page (`/admin`).

Removing an account also deletes that account's stories.

### Data notes

- **Import options:** `import_dataset.py --replace` re-imports from scratch, and `--csv path.csv` imports from a local copy instead of Hugging Face.
- **Authors:** the dataset has no author column. About 1,360 stories end with a "Credit To – Name" line, and the importer pulls the author's name from it. The rest show as "Unknown author".
- **Cut-off stories:** 278 stories in the dataset are cut off at 32,767 characters, the Excel cell limit. They're marked as cut off on the story page.
- **Video game stories** are put in the "Video Games and Gaming" category automatically, on import and whenever a story is posted or edited (`api/app/gaming.py`). `api/tag_games.py` re-applies it to the existing database.
- **Editing imports:** imported stories have no owner, so only moderators and above can edit them.

### Running parts by hand

```sh
cd api && .venv/bin/uvicorn app.main:app --reload --port 8000
cd web && npm run dev            # or: npm run build && npm start
```

Next.js forwards `/api/*` to FastAPI (`API_URL`, which defaults to `http://127.0.0.1:8000`), so the browser only ever talks to port 3000. Set `COOKIE_SECURE=1` for the API when serving over HTTPS.

---

## Roadmap

Planned improvements for Eidothea include:

* improved archive search
* tag-based discovery system
* contributor reputation system
* enhanced moderation tools
* improved reading interface

---

## Philosophy

```
Archive knowledge.
Encourage curiosity.
Preserve canon.
Explore the unknown.
```

---

## License

Released under the MIT License.
