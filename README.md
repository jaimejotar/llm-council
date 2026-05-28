# LLM Council

![llmcouncil](header.jpg)

> **Fork of [karpathy/llm-council](https://github.com/karpathy/llm-council).** This fork preserves the original Vibe Code MVP and extends it with configurable councils (UI), per-query cost estimation, a Windows launcher, and a `.env.example` template. See [Fork additions](#fork-additions) at the bottom for details. The rest of this README is Karpathy's original text, kept intact.

## Screenshots

![Stage 3: Final synthesis from the Chairman](docs/screenshots/04-stage3-final-synthesis.png)

*The Chairman (Gemini 2.5 Pro in this run) synthesizes the council's deliberation after three stages: individual responses → anonymous peer rankings → final synthesis. See the full flow: [01 — prompt submitted](docs/screenshots/01-prompt-submitted-loading.png) · [02 — Stage 1 individual responses](docs/screenshots/02-stage1-individual-responses.png) · [03 — Stage 2 peer rankings](docs/screenshots/03-stage2-peer-rankings.png) · [04 — Stage 3 final synthesis](docs/screenshots/04-stage3-final-synthesis.png).*

![Council manager — presets](docs/screenshots/05-council-config-presets.png)

*The fork's council manager with per-query cost estimation. Three views: [Presets](docs/screenshots/05-council-config-presets.png) · [New council](docs/screenshots/06-council-config-new-council.png) · [Catalog](docs/screenshots/07-council-config-catalog.png).*

The idea of this repo is that instead of asking a question to your favorite LLM provider (e.g. OpenAI GPT 5.1, Google Gemini 3.0 Pro, Anthropic Claude Sonnet 4.5, xAI Grok 4, eg.c), you can group them into your "LLM Council". This repo is a simple, local web app that essentially looks like ChatGPT except it uses OpenRouter to send your query to multiple LLMs, it then asks them to review and rank each other's work, and finally a Chairman LLM produces the final response.

In a bit more detail, here is what happens when you submit a query:

1. **Stage 1: First opinions**. The user query is given to all LLMs individually, and the responses are collected. The individual responses are shown in a "tab view", so that the user can inspect them all one by one.
2. **Stage 2: Review**. Each individual LLM is given the responses of the other LLMs. Under the hood, the LLM identities are anonymized so that the LLM can't play favorites when judging their outputs. The LLM is asked to rank them in accuracy and insight.
3. **Stage 3: Final response**. The designated Chairman of the LLM Council takes all of the model's responses and compiles them into a single final answer that is presented to the user.

## Vibe Code Alert

This project was 99% vibe coded as a fun Saturday hack because I wanted to explore and evaluate a number of LLMs side by side in the process of [reading books together with LLMs](https://x.com/karpathy/status/1990577951671509438). It's nice and useful to see multiple responses side by side, and also the cross-opinions of all LLMs on each other's outputs. I'm not going to support it in any way, it's provided here as is for other people's inspiration and I don't intend to improve it. Code is ephemeral now and libraries are over, ask your LLM to change it in whatever way you like.

## Setup

> 💡 **Fork update.** This section is Karpathy's original native-install path. For a one-command Docker setup, the up-to-date `.env.example` workflow, and the new council manager UI, see **[SETUP.md](SETUP.md)** — written to be readable by both humans and AI agents.

### 1. Install Dependencies

The project uses [uv](https://docs.astral.sh/uv/) for project management.

**Backend:**
```bash
uv sync
```

**Frontend:**
```bash
cd frontend
npm install
cd ..
```

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
OPENROUTER_API_KEY=sk-or-v1-...
```

Get your API key at [openrouter.ai](https://openrouter.ai/). Make sure to purchase the credits you need, or sign up for automatic top up.

> 💡 **Fork update.** This fork ships `.env.example` — use `cp .env.example .env` and edit, instead of creating the file from scratch. Details in [SETUP.md §3](SETUP.md#3-configure-api-key).

### 3. Configure Models (Optional)

Edit `backend/config.py` to customize the council:

```python
COUNCIL_MODELS = [
    "openai/gpt-5.1",
    "google/gemini-3-pro-preview",
    "anthropic/claude-sonnet-4.5",
    "x-ai/grok-4",
]

CHAIRMAN_MODEL = "google/gemini-3-pro-preview"
```

> 💡 **Fork update.** With this fork you no longer need to edit `config.py` — the in-UI **Council Manager** lets you create, edit, and price-estimate councils visually. The values above are only used as a fallback if no councils exist yet. See [SETUP.md §6 — First use](SETUP.md#6-first-use--council-manager) and [Fork additions](#fork-additions) below.

## Running the Application

> 💡 **Fork update.** Three ways to run, in order of recommendation: **(a)** `docker compose up` (zero local deps — see [SETUP.md §4](SETUP.md#4-run--track-a-docker)), **(b)** `start.bat` on Windows / `start.sh` on macOS-Linux, **(c)** the manual two-terminal route below.

**Option 1: Use the start script**
```bash
./start.sh
```

**Option 2: Run manually**

Terminal 1 (Backend):
```bash
uv run python -m backend.main
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

## Tech Stack

- **Backend:** FastAPI (Python 3.10+), async httpx, OpenRouter API
- **Frontend:** React + Vite, react-markdown for rendering
- **Storage:** JSON files in `data/conversations/`
- **Package Management:** uv for Python, npm for JavaScript

---

## Fork additions

This fork (`jaimejotar/llm-council`) adds the following on top of [karpathy/llm-council](https://github.com/karpathy/llm-council):

### 1. Configurable councils via UI

Original config required editing `backend/config.py` to change the council. This fork stores councils in `data/councils.json` (gitignored) and exposes CRUD through the UI:

- **CouncilModal** — create, edit, duplicate, or delete councils (models + chairman) without touching code.
- **NewConversationDialog** — pick which council each conversation should use.
- Seeded with sensible defaults on first run (e.g. `exploracion_barata`, `consejo_robusto`, etc.).

Endpoints added in `backend/main.py`: `GET/POST /api/councils`, `PUT/DELETE /api/councils/{id}`.

### 2. Per-query cost estimation

The CouncilModal shows estimated USD cost per query based on:

- Static catalog of OpenRouter prices in `backend/models_catalog.py` (snapshot dated `2026-05-08` — update manually when prices change upstream).
- Assumed typical query of **1500 input tokens + 500 output tokens** per model.
- Sum across all members of the council.

Lets you compare a "cheap exploration" council vs a "frontier" council before launching a long conversation.

### 3. `start.bat` — Windows launcher

Double-click `start.bat` (Windows) to open backend and frontend in separate `cmd` windows. Mirrors the behavior of `start.sh` on Linux/macOS.

### 4. `.env.example` template

Copy `.env.example` to `.env` and fill in your OpenRouter key. Original repo expected you to read the README to know what to set; this template documents the env var inline with links to OpenRouter pricing.

### 5. Docker / Docker Compose

`docker compose up` brings up the whole stack in one command — zero local Python / Node / uv installations required. Useful for evaluators who want to try the project without installing the toolchain, and as a reproducible smoke-test target. Includes:

- `backend/Dockerfile` — uv-based image (`ghcr.io/astral-sh/uv:python3.13-bookworm-slim`).
- `frontend/Dockerfile` — `node:20-alpine` running Vite dev server.
- `docker-compose.yml` — orchestrates both services, mounts `./data/` for persistence, and bind-mounts source for hot reload.
- `.dockerignore` — keeps `.venv`, `node_modules`, `data/`, and the `.env` out of the build context.

Full instructions in [SETUP.md §4 — Track A (Docker)](SETUP.md#4-run--track-a-docker).

### 6. AI-readable `SETUP.md`

The fork adds a [`SETUP.md`](SETUP.md) written to be parsed and executed by AI agents (Claude Code, Cursor, Codex, etc.) as well as humans. It documents prerequisites with verification commands, both setup tracks (native + Docker), troubleshooting, and a compact "For AI agents" section with invariants the agent should not violate.

### Design docs

The design and implementation plan that informed the council manager live in `docs/superpowers/specs/`:

- `2026-05-08-council-config-design.md`
- `2026-05-08-council-config-plan.md`
- `mockup-layout-options.html`

## Upstream

This project originates from [Andrej Karpathy's tweet](https://x.com/karpathy/status/1990577951671509438) on reading books with multiple LLMs side by side, evolved into [karpathy/llm-council](https://github.com/karpathy/llm-council). This fork extends it with the additions above.

To sync with upstream changes:

```bash
git remote add upstream https://github.com/karpathy/llm-council.git
git fetch upstream
git merge upstream/master
```

## License

Same as upstream (see [`LICENSE`](LICENSE) if present in the original repo, otherwise the project follows the spirit of "code is ephemeral" stated in the Vibe Code Alert above).

## Maintainer of this fork

Jaime Jiménez Ruiz — [@jaimejotar](https://github.com/jaimejotar) · [in/jaime-jimenez-ruiz](https://www.linkedin.com/in/jaime-jimenez-ruiz/) · Co-founder & CTO at [HealthTracker Analytics](https://healthtracker.ai).

Fork built in [Tomé, Chile](https://en.wikipedia.org/wiki/Tom%C3%A9). `#toimprovelives`
