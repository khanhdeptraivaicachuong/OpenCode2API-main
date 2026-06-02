# 🖥️ Direct Launch (no Docker)

Run `opencode2api` directly on **Windows CMD**, **Linux terminal**, or **macOS terminal** without Docker, Podman, or any container runtime.

> For the Docker path, see [docker.md](./docker.md). For the 30-second quick start, see [README.md](../README.md#-快速开始).

---

## ✅ Requirements

| Requirement     | Minimum       | Notes |
|:----------------|:--------------|:------|
| Node.js         | 18.17+        | 20 LTS recommended. Includes `npm`. |
| OpenCode CLI    | latest stable | See install table below. |
| OS              | Windows 10/11, macOS 12+, any modern Linux | |
| RAM             | ~300 MB idle  | Plus whatever the LLM provider needs. |

### Install the OpenCode CLI (one-time per machine)

| OS      | Command                                                       |
|:--------|:--------------------------------------------------------------|
| Windows | `npm install -g opencode-ai`                                  |
| Linux   | `curl -fsSL https://opencode.ai/install \| bash`              |
| macOS   | `brew install opencode`  or  `curl -fsSL https://opencode.ai/install \| bash` |

Verify: `opencode --version` should print a version.

---

## 🚀 Start in 3 commands (works on every platform)

```bash
git clone https://github.com/TiaraBasori/opencode2api.git
cd opencode2api
cp .env.example .env
```

Edit `.env` and set at minimum:

```env
API_KEY=any-long-random-string
OPENCODE_SERVER_PASSWORD=any-long-random-string
```

Then start with whichever command matches your shell:

```bat
:: Windows CMD or PowerShell
start.bat
```

```bash
# Linux / macOS terminal (or Git Bash / WSL on Windows)
chmod +x start.sh
./start.sh
```

…or the npm equivalent, which is identical everywhere:

```bash
npm install   # only on the very first run
npm start
```

On first run the launcher will:

1. `npm install` (if `node_modules/` is missing).
2. Copy `.env.example` → `.env` (if missing).
3. Start the proxy on `http://127.0.0.1:10000`.
4. The proxy will then auto-spawn `opencode serve` on `127.0.0.1:10001` (default behaviour for non-Docker runs).

Stop with `Ctrl+C`.

---

## 🧪 Verify it works

```bash
# health endpoint (always public)
curl http://127.0.0.1:10000/health
# => {"status":"ok","proxy":true}

# list models (requires API_KEY if you set one)
curl -H "Authorization: Bearer YOUR_API_KEY" http://127.0.0.1:10000/v1/models
```

A first chat request:

```bash
curl -X POST http://127.0.0.1:10000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "opencode/big-pickle",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 🔧 How it works under the hood

- `index.js` auto-detects whether it is running inside Docker. If it is not, it sets `MANAGE_BACKEND=true` so the proxy will **spawn and supervise the OpenCode backend on its own**. You do not need to start `opencode serve` manually.
- A tiny built-in `.env` loader fills `process.env` from `.env` (if present). Real shell env vars always win — `.env` is only a fallback, identical to how `dotenv` behaves.
- All platform-specific code (paths, signals, `.cmd`/`.bat` shims, isolated home jails) already lives in `src/proxy.js`. No code changes are required for the three target platforms.

---

## 🪟 Windows-specific notes

- The launcher is `start.bat` (works in both **CMD** and **PowerShell**).
- `opencode` is usually installed by npm-global at
  `C:\Users\<you>\AppData\Roaming\npm\opencode.cmd`. The proxy auto-finds it via `APPDATA\npm` even when the global npm bin folder is not on `PATH`.
- If you prefer an explicit path, set in `.env`:
  ```env
  OPENCODE_PATH=C:\Users\YourName\AppData\Roaming\npm\opencode.cmd
  ```
- The proxy spawns the backend with `shell: true` on Windows so `.cmd`/`.bat` shims resolve correctly.
- Signal handling is the OS-default on Windows: use `Ctrl+C` to stop, or `taskkill /IM node.exe /F` from another shell.
- If you see `EACCES` on port `10000`, another process is bound. Either stop it, or set in `.env`:
  ```env
  OPENCODE_PROXY_PORT=10010
  OPENCODE_SERVER_PORT=10011
  ```

### Using the legacy `npm test`

The old `npm test` script set `NODE_OPTIONS` with bash-style syntax that does not work in Windows CMD. It has been rewritten to call `node --experimental-vm-modules` directly. On every platform you can now run:

```bash
npm test
```

---

## 🐧 Linux-specific notes

- Make `start.sh` executable once: `chmod +x start.sh`. After that `./start.sh` is the only thing you need.
- The proxy looks for the opencode binary in `$PATH`, `/usr/local/bin`, `/usr/bin`, `/bin`, `/opt/homebrew/bin`, and `~/.local/bin`, `~/.opencode/bin`. It also follows `nvm`, `fnm`, `asdf`, and `volta` install layouts automatically.
- If you have a previous `opencode serve` running on port `10001`, the proxy will reuse it. Stop it with `pkill -f "opencode serve"` first if you want the proxy to spawn a fresh one.
- Run in the background with `nohup` or `tmux`/`screen`:
  ```bash
  nohup ./start.sh > opencode2api.log 2>&1 &
  ```

---

## 🍎 macOS-specific notes

- Apple Silicon: `brew install opencode` installs to `/opt/homebrew/bin/opencode`, which the proxy searches automatically.
- Intel: `brew install opencode` installs to `/usr/local/bin/opencode` (also auto-discovered).
- If you use the official installer (`curl -fsSL https://opencode.ai/install | bash`), the binary lands at `~/.local/bin/opencode` — again auto-discovered.
- Apple’s Gatekeeper will only block binaries that are not notarized. The official installer and the Homebrew bottle are both notarized.

---

## ⚙️ All configuration paths

The merge order is: **real env var > `.env` > `config.json` > default**.

- **Real env vars** — set in your shell, highest priority. Example: `OPENCODE_PROXY_PORT=20000 npm start`.
- **`.env`** — created from `.env.example` on first run. Best place to keep persistent settings.
- **`config.json`** — copied from `config.json.example`. Useful if you prefer JSON; ignored unless the file exists.

Pick one. Don’t set the same key in two places or you’ll get confused which one won.

### Useful `.env` overrides

```env
# Run proxy on a different port
OPENCODE_PROXY_PORT=20000
OPENCODE_SERVER_PORT=20001

# Reuse your real ~/.local/share/opencode (keeps your login / cache)
OPENCODE_USE_ISOLATED_HOME=false

# Verbose logging
OPENCODE_PROXY_DEBUG=true

# Let the client control the model (must match your OpenCode auth)
OPENCODE_SERVER_PASSWORD=...
```

---

## 🐞 Troubleshooting direct launches

| Symptom | Cause / Fix |
|:--------|:------------|
| `[Error] Cannot locate OpenCode CLI` | Install opencode (see top of this doc), or set `OPENCODE_PATH` in `.env`. |
| `EADDRINUSE 0.0.0.0:10000` | Another process owns the port. Change `OPENCODE_PROXY_PORT`. |
| First chat request hangs | The proxy can’t reach `opencode serve`. Check `OPENCODE_USE_ISOLATED_HOME=false` to reuse your local login. |
| `401 Unauthorized` | The `API_KEY` you set in `.env` doesn’t match the one in the `Authorization: Bearer …` header. |
| `Cannot find module '@opencode-ai/sdk'` | `npm install` didn’t finish, or `node_modules` was deleted. Re-run `npm install`. |
| Windows: `opencode` is not recognized | The npm-global bin folder is missing from PATH. Either add `%APPDATA%\npm` to PATH, or set `OPENCODE_PATH` explicitly. |

More in [troubleshooting.md](./troubleshooting.md).

---

## 🆙 Updating

```bash
git pull
npm install
# (restart the launcher)
```

Your `.env` and `config.json` are never overwritten by `git pull` (they’re in `.gitignore`).
