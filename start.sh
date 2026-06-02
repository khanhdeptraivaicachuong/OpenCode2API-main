#!/usr/bin/env bash
# ============================================================
#  opencode2api launcher for Linux / macOS
#  - Installs npm dependencies on first run
#  - Copies .env.example -> .env if missing
#  - Starts the proxy (which will also spawn `opencode serve`
#    automatically when MANAGE_BACKEND is true, i.e. the default
#    for non-Docker runs)
# ============================================================

set -e

cd "$(dirname "$0")"

echo
echo "=== opencode2api (Unix) ==="

# --- Check Node.js ---
if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not installed or not in PATH."
    echo "        Install Node.js 18.17+ from https://nodejs.org/ or via your package manager."
    exit 1
fi
NODE_VER="$(node --version)"
echo "Node.js: ${NODE_VER}"

# --- Check npm ---
if ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] npm is not installed. It should ship with Node.js."
    exit 1
fi

# --- Install deps on first run ---
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# --- Create .env from example on first run ---
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "Creating .env from .env.example..."
        cp .env.example .env
    else
        echo "[WARN] .env.example not found. Continuing with no .env."
    fi
fi

# --- Run ---
PROXY_PORT="${OPENCODE_PROXY_PORT:-10000}"
echo "Starting proxy on http://127.0.0.1:${PROXY_PORT} ..."
exec node index.js
