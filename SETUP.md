# Setup — LLM Council

This document is the source of truth for installing and running the project locally. It is written to be readable by **both humans and AI agents** (Claude Code, Cursor, Codex, etc.).

The original [README.md](README.md) is preserved as Karpathy wrote it; this file consolidates the fork's updated setup steps (`.env.example`, `start.bat`, the council manager UI, and the Docker quick-start).

---

## 1. Prerequisites

Two supported tracks. Pick one.

### Track A — Docker (recommended for evaluation)

| Requirement | Check command | Expected |
|---|---|---|
| Docker Engine | `docker --version` | `Docker version 27.x` or newer |
| Docker Compose | `docker compose version` | `Docker Compose version v2.x` or newer |
| OpenRouter account | manual | API key obtained at https://openrouter.ai/keys with credits loaded (≥ USD 5 recommended) |

### Track B — Native (recommended for active development)

| Requirement | Check command | Expected |
|---|---|---|
| Python 3.10+ | `python --version` or `uv python list` | `>= 3.10` |
| uv | `uv --version` | `>= 0.5` — install: https://docs.astral.sh/uv/getting-started/installation/ |
| Node.js | `node --version` | `>= 20` |
| npm | `npm --version` | `>= 10` |
| OpenRouter account | manual | same as Track A |

---

## 2. Clone

```bash
git clone https://github.com/jaimejotar/llm-council.git
cd llm-council
```

---

## 3. Configure API key

The same step for both tracks.

```bash
cp .env.example .env
```

Then edit `.env` and replace the empty value:

```dotenv
OPENROUTER_API_KEY=sk-or-v1-<your-real-key-here>
```

Get the key at https://openrouter.ai/keys. Verify it works by hitting the models endpoint:

```bash
curl -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/models | head -c 200
```

A 200 with JSON output means the key is valid.

---

## 4. Run — Track A (Docker)

```bash
docker compose up
```

First run builds both images (~2-3 minutes including base image downloads). Subsequent runs start in seconds.

Open http://localhost:5173 in your browser.

To stop: `Ctrl+C`, then `docker compose down`.

**What's running:**
- `llm-council-backend` on port 8001 — FastAPI via uv
- `llm-council-frontend` on port 5173 — Vite dev server via npm

**Persistent state:** the `data/` directory is bind-mounted, so conversations and `councils.json` survive container restarts.

**Hot reload:** edits to `backend/` and `frontend/src/` on the host are visible inside the containers. The frontend (Vite) HMR-reloads automatically; the backend does not auto-reload by default — restart the container if you want backend changes to take effect (`docker compose restart backend`).

---

## 5. Run — Track B (Native)

### 5.1 Install dependencies

```bash
# Backend
uv sync

# Frontend
cd frontend
npm install
cd ..
```

### 5.2 Launch

**macOS / Linux:**
```bash
./start.sh
```

**Windows:**
- Double-click `start.bat` in the project root, or
- Run from PowerShell: `.\start.bat`

Both open the backend (port 8001) and the frontend (port 5173) in separate terminal windows.

**Manual alternative (any OS, two terminals):**

```bash
# Terminal 1 — backend
uv run python -m backend.main
```

```bash
# Terminal 2 — frontend
cd frontend
npm run dev
```

Open http://localhost:5173.

---

## 6. First use — Council Manager

Once the UI loads, the fork's main addition is the **Council Manager**, accessed via the *"Consejos"* button at the bottom-left of the sidebar.

It opens a modal with three tabs:
1. **Presets** — saved councils with per-query cost estimate (e.g. `Exploración Barata` ≈ $0.0055/query, `Consejo Premium` ≈ $0.0379/query).
2. **Nuevo** — compose a new council picking models from the catalog; cost is recomputed live as you add/remove members.
3. **Catálogo** — full OpenRouter model catalog with provider, input/output pricing, context window, and a tier label (`cheap` / `mid` / `premium`).

To start your first conversation:
1. Click *"+ New Conversation"* (top of sidebar).
2. The *New Conversation Dialog* appears — pick a council.
3. Type your prompt and submit. You'll see Stage 1 (parallel) → Stage 2 (peer ranking) → Stage 3 (Chairman synthesis).

See [docs/screenshots/](docs/screenshots/) for visual reference of each step.

---

## 7. Verifying it works

After `docker compose up` (Track A) or `start.sh`/`start.bat` (Track B):

```bash
# Backend reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/conversations
# Expected: 200

# Frontend reachable
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
# Expected: 200
```

Both `200` = stack is healthy.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker compose up` fails: `.env: no such file` | You skipped step 3 | `cp .env.example .env` and add your key |
| App loads but every model query returns an error | `OPENROUTER_API_KEY` invalid, missing, or no credits | Re-check step 3; visit https://openrouter.ai/credits |
| `uv sync` fails: `python not found` | uv hasn't been told which Python to use | `uv python install 3.13` then retry |
| `start.bat` flashes and closes | Missing `.venv\Scripts\python.exe` or `frontend\node_modules` | Run `uv sync` and `cd frontend && npm install` first |
| Port 8001 or 5173 already in use | Another process is holding the port | `docker compose down` then `docker compose up`, or kill the conflicting process |
| Council default models fail with "model not found" | Models in `backend/config.py` defaults are stale | Use the Council Manager UI to pick a council from current presets instead of relying on the default config |

---

## 9. For AI agents

Compact form of the setup, suitable for autonomous execution:

```bash
# 1. Verify prerequisites (Docker track)
docker --version || echo "MISSING: install Docker Desktop from https://www.docker.com/products/docker-desktop/"
docker compose version || echo "MISSING: docker compose v2+"

# 2. Clone
git clone https://github.com/jaimejotar/llm-council.git
cd llm-council

# 3. Configure (ASK THE USER for OPENROUTER_API_KEY — never commit it)
cp .env.example .env
# Then prompt the user to populate OPENROUTER_API_KEY in .env

# 4. Build and run (Docker track)
docker compose up -d

# 5. Smoke test
sleep 8
curl -s -o /dev/null -w "%{http_code}" http://localhost:8001/api/conversations  # expect 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/                   # expect 200

# 6. Open http://localhost:5173 in the user's browser
```

**Invariants the agent should not violate:**
- Never commit `.env`, `data/`, `.venv/`, `node_modules/`, or anything matching `*.key` / `*.pem`.
- Do not edit `backend/config.py` defaults to "fix" model-not-found errors — instruct the user to use the Council Manager UI instead. The config defaults are a fallback that drifts as upstream OpenRouter changes model identifiers.
- The fork preserves `karpathy/llm-council` history. When adding commits, sign with the contributor's email so attribution is correct (`git config user.email` should match a verified GitHub email).

**Where things live:**
- Setup source of truth → this file (`SETUP.md`).
- Original project narrative → `README.md`.
- Feature design that informed the fork → `docs/superpowers/specs/`.
- Screenshots referenced by the README → `docs/screenshots/`.
- Maintainer contact → bottom of `README.md`.
