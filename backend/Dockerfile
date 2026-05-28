# syntax=docker/dockerfile:1
# Backend Dockerfile for LLM Council
# Build context: repo root (pyproject.toml + uv.lock + backend/ all accessible)

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim

WORKDIR /app

# Copy dependency manifests first to maximize layer cache hit on code-only changes
COPY pyproject.toml uv.lock ./

# Install dependencies without the project itself (uses uv.lock for reproducibility)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-dev

# Copy the backend source
COPY backend/ ./backend/

# Install the project (fast — deps already resolved)
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

EXPOSE 8001

# Entrypoint matches the native `start.sh` / `start.bat` behavior
CMD ["uv", "run", "python", "-m", "backend.main"]
