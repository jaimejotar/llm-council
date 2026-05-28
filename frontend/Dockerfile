# syntax=docker/dockerfile:1
# Frontend Dockerfile for LLM Council
# Build context: ./frontend (package.json + package-lock.json + src/ all accessible)

FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json package-lock.json ./

# Reproducible install from lockfile
RUN npm ci

# Copy frontend source
COPY . .

EXPOSE 5173

# Run Vite dev server, accessible from host (default binds to 127.0.0.1 inside container)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
