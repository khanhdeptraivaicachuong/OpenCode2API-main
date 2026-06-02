import { startProxy } from './src/proxy.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Minimal .env loader (no external dependency).
 * Existing process.env values are NEVER overridden (matches dotenv default).
 */
function loadDotEnv(filepath) {
    if (!filepath || !fs.existsSync(filepath)) return 0;
    let text;
    try {
        text = fs.readFileSync(filepath, 'utf8');
    } catch (e) {
        return 0;
    }
    let loaded = 0;
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        if (!key || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
        let value = line.slice(eqIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
            process.env[key] = value;
            loaded += 1;
        }
    }
    return loaded;
}

function isRunningInDocker() {
    try {
        return fs.existsSync('/.dockerenv') ||
            (fs.existsSync('/proc/1/cgroup') &&
                fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
    } catch (e) {
        return false;
    }
}

const inDocker = isRunningInDocker();
const envLoaded = loadDotEnv(path.join(__dirname, '.env'));
if (envLoaded > 0 && !process.env.OPENCODE_QUIET_ENV) {
    console.log(`[Config] Loaded ${envLoaded} variable(s) from .env`);
}

function parseBool(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
        if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
    }
    if (value === undefined || value === null) return fallback;
    return Boolean(value);
}

function parseToolAllowlist(value, fallback = []) {
    if (Array.isArray(value)) {
        return [...new Set(value.map((entry) => String(entry || '').trim()).filter(Boolean))];
    }
    if (typeof value === 'string') {
        return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))];
    }
    if (value === undefined || value === null || value === '') return fallback;
    return fallback;
}

// Default configuration
const defaultConfig = {
    PORT: parseInt(process.env.OPENCODE_PROXY_PORT) || 10000,
    API_KEY: '',
    OPENCODE_SERVER_URL: `http://127.0.0.1:${process.env.OPENCODE_SERVER_PORT || 10001}`,
    OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || '',
    // When running OUTSIDE Docker we want the proxy to spawn and supervise
    // the OpenCode backend automatically. Inside Docker, the entrypoint.sh
    // already starts `opencode serve`, so the proxy should not manage it.
    MANAGE_BACKEND: parseBool(
        process.env.OPENCODE_PROXY_MANAGE_BACKEND,
        inDocker ? false : true
    ),
    OPENCODE_PATH: 'opencode',
    BIND_HOST: '0.0.0.0',
    DISABLE_TOOLS: true,
    EXTERNAL_TOOLS_MODE: 'proxy-bridge',
    EXTERNAL_TOOLS_CONFLICT_POLICY: 'namespace',
    INTERNAL_WEB_FETCH_ENABLED: parseBool(process.env.OPENCODE_INTERNAL_WEB_FETCH_ENABLED, false),
    INTERNAL_ALLOWED_TOOLS: parseToolAllowlist(process.env.OPENCODE_INTERNAL_ALLOWED_TOOLS, []),
    INTERNAL_TOOL_METRICS_ENABLED: parseBool(process.env.OPENCODE_INTERNAL_TOOL_METRICS_ENABLED, true),
    INTERNAL_TOOL_DISCOVERY_FIXTURE: parseToolAllowlist(process.env.OPENCODE_TOOL_DISCOVERY_FIXTURE, []),
    HEALTH_DETAILS_ENABLED: parseBool(process.env.OPENCODE_HEALTH_DETAILS_ENABLED, true),
    HEALTH_DETAILS_REQUIRE_AUTH: parseBool(process.env.OPENCODE_HEALTH_DETAILS_REQUIRE_AUTH, true),
    METRICS_ENABLED: parseBool(process.env.OPENCODE_METRICS_ENABLED, false),
    METRICS_REQUIRE_AUTH: parseBool(process.env.OPENCODE_METRICS_REQUIRE_AUTH, true),
    PROMPT_MODE: process.env.OPENCODE_PROXY_PROMPT_MODE || 'standard',
    OMIT_SYSTEM_PROMPT: parseBool(process.env.OPENCODE_PROXY_OMIT_SYSTEM_PROMPT, false),
    AUTO_CLEANUP_CONVERSATIONS: parseBool(process.env.OPENCODE_PROXY_AUTO_CLEANUP_CONVERSATIONS, false),
    CLEANUP_INTERVAL_MS: parseInt(process.env.OPENCODE_PROXY_CLEANUP_INTERVAL_MS) || 43200000,
    CLEANUP_MAX_AGE_MS: parseInt(process.env.OPENCODE_PROXY_CLEANUP_MAX_AGE_MS) || 86400000
};

// Load config from file
const configPath = path.join(__dirname, 'config.json');
let fileConfig = {};

if (fs.existsSync(configPath)) {
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        fileConfig = JSON.parse(content);
        console.log('[Config] Loaded from config.json');
    } catch (err) {
        console.error('[Config] Error parsing config.json:', err.message);
    }
}

// Merge configs: env > file > default
const finalConfig = {
    PORT: parseInt(process.env.OPENCODE_PROXY_PORT) || parseInt(process.env.PORT) || fileConfig.PORT || defaultConfig.PORT,
    API_KEY: process.env.API_KEY || fileConfig.API_KEY || defaultConfig.API_KEY,
    OPENCODE_SERVER_URL: process.env.OPENCODE_SERVER_URL || fileConfig.OPENCODE_SERVER_URL || defaultConfig.OPENCODE_SERVER_URL,
    OPENCODE_SERVER_PASSWORD: process.env.OPENCODE_SERVER_PASSWORD || fileConfig.OPENCODE_SERVER_PASSWORD || defaultConfig.OPENCODE_SERVER_PASSWORD,
    MANAGE_BACKEND: parseBool(process.env.OPENCODE_PROXY_MANAGE_BACKEND, parseBool(fileConfig.MANAGE_BACKEND, defaultConfig.MANAGE_BACKEND)),
    OPENCODE_PATH: process.env.OPENCODE_PATH || fileConfig.OPENCODE_PATH || defaultConfig.OPENCODE_PATH,
    BIND_HOST: process.env.BIND_HOST || fileConfig.BIND_HOST || defaultConfig.BIND_HOST,
    DISABLE_TOOLS: parseBool(process.env.OPENCODE_DISABLE_TOOLS, parseBool(fileConfig.DISABLE_TOOLS, defaultConfig.DISABLE_TOOLS)),
    EXTERNAL_TOOLS_MODE: process.env.OPENCODE_EXTERNAL_TOOLS_MODE || fileConfig.EXTERNAL_TOOLS_MODE || defaultConfig.EXTERNAL_TOOLS_MODE,
    EXTERNAL_TOOLS_CONFLICT_POLICY: process.env.OPENCODE_EXTERNAL_TOOLS_CONFLICT_POLICY || fileConfig.EXTERNAL_TOOLS_CONFLICT_POLICY || defaultConfig.EXTERNAL_TOOLS_CONFLICT_POLICY,
    INTERNAL_WEB_FETCH_ENABLED: parseBool(process.env.OPENCODE_INTERNAL_WEB_FETCH_ENABLED, parseBool(fileConfig.INTERNAL_WEB_FETCH_ENABLED, defaultConfig.INTERNAL_WEB_FETCH_ENABLED)),
    INTERNAL_ALLOWED_TOOLS: parseToolAllowlist(process.env.OPENCODE_INTERNAL_ALLOWED_TOOLS, parseToolAllowlist(fileConfig.INTERNAL_ALLOWED_TOOLS, defaultConfig.INTERNAL_ALLOWED_TOOLS)),
    INTERNAL_TOOL_METRICS_ENABLED: parseBool(process.env.OPENCODE_INTERNAL_TOOL_METRICS_ENABLED, parseBool(fileConfig.INTERNAL_TOOL_METRICS_ENABLED, defaultConfig.INTERNAL_TOOL_METRICS_ENABLED)),
    INTERNAL_TOOL_DISCOVERY_FIXTURE: parseToolAllowlist(process.env.OPENCODE_TOOL_DISCOVERY_FIXTURE, parseToolAllowlist(fileConfig.INTERNAL_TOOL_DISCOVERY_FIXTURE, defaultConfig.INTERNAL_TOOL_DISCOVERY_FIXTURE)),
    HEALTH_DETAILS_ENABLED: parseBool(process.env.OPENCODE_HEALTH_DETAILS_ENABLED, parseBool(fileConfig.HEALTH_DETAILS_ENABLED, defaultConfig.HEALTH_DETAILS_ENABLED)),
    HEALTH_DETAILS_REQUIRE_AUTH: parseBool(process.env.OPENCODE_HEALTH_DETAILS_REQUIRE_AUTH, parseBool(fileConfig.HEALTH_DETAILS_REQUIRE_AUTH, defaultConfig.HEALTH_DETAILS_REQUIRE_AUTH)),
    METRICS_ENABLED: parseBool(process.env.OPENCODE_METRICS_ENABLED, parseBool(fileConfig.METRICS_ENABLED, defaultConfig.METRICS_ENABLED)),
    METRICS_REQUIRE_AUTH: parseBool(process.env.OPENCODE_METRICS_REQUIRE_AUTH, parseBool(fileConfig.METRICS_REQUIRE_AUTH, defaultConfig.METRICS_REQUIRE_AUTH)),
    USE_ISOLATED_HOME: parseBool(process.env.OPENCODE_USE_ISOLATED_HOME, parseBool(fileConfig.USE_ISOLATED_HOME, false)),
    REQUEST_TIMEOUT_MS: parseInt(process.env.OPENCODE_PROXY_REQUEST_TIMEOUT_MS) || fileConfig.REQUEST_TIMEOUT_MS || 180000,
    DEBUG: parseBool(process.env.OPENCODE_PROXY_DEBUG, parseBool(fileConfig.DEBUG, false)),
    ZEN_API_KEY: process.env.OPENCODE_ZEN_API_KEY || fileConfig.ZEN_API_KEY || '',
    PROMPT_MODE: process.env.OPENCODE_PROXY_PROMPT_MODE || fileConfig.PROMPT_MODE || defaultConfig.PROMPT_MODE,
    OMIT_SYSTEM_PROMPT: parseBool(process.env.OPENCODE_PROXY_OMIT_SYSTEM_PROMPT, parseBool(fileConfig.OMIT_SYSTEM_PROMPT, defaultConfig.OMIT_SYSTEM_PROMPT)),
    AUTO_CLEANUP_CONVERSATIONS: parseBool(process.env.OPENCODE_PROXY_AUTO_CLEANUP_CONVERSATIONS, parseBool(fileConfig.AUTO_CLEANUP_CONVERSATIONS, defaultConfig.AUTO_CLEANUP_CONVERSATIONS)),
    CLEANUP_INTERVAL_MS: parseInt(process.env.OPENCODE_PROXY_CLEANUP_INTERVAL_MS) || fileConfig.CLEANUP_INTERVAL_MS || defaultConfig.CLEANUP_INTERVAL_MS,
    CLEANUP_MAX_AGE_MS: parseInt(process.env.OPENCODE_PROXY_CLEANUP_MAX_AGE_MS) || fileConfig.CLEANUP_MAX_AGE_MS || defaultConfig.CLEANUP_MAX_AGE_MS
};

// Validate required configuration
if (!finalConfig.OPENCODE_PATH) {
    console.error('[Error] OPENCODE_PATH is not set. Please configure it in config.json or environment variable.');
    process.exit(1);
}

// Check if opencode is available. We use a small inline copy of the
// resolver logic from src/proxy.js so we can give a clear, early error
// when the binary is missing — even if the proxy itself will only need
// it lazily on the first request.

function findExecutableInPath() {
    const names = process.platform === 'win32'
        ? ['opencode.cmd', 'opencode.exe', 'opencode.bat', 'opencode']
        : ['opencode'];
    const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
    if (process.platform === 'win32') {
        if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, 'npm'));
    } else {
        dirs.push('/usr/local/bin', '/usr/bin', '/bin', '/opt/homebrew/bin');
    }
    const home = os.homedir();
    if (home) {
        dirs.push(path.join(home, '.opencode', 'bin'));
        dirs.push(path.join(home, '.local', 'bin'));
    }
    for (const dir of dirs) {
        for (const name of names) {
            const full = path.join(dir, name);
            if (fs.existsSync(full)) return full;
        }
    }
    return null;
}

function resolveOpencodePathLocal(requestedPath) {
    const input = (requestedPath || '').trim();
    if (input) {
        const looksLikePath = path.isAbsolute(input) || input.includes('/') || input.includes('\\');
        if (looksLikePath) {
            if (fs.existsSync(input)) return { path: input, source: 'config' };
            const resolved = path.resolve(process.cwd(), input);
            if (fs.existsSync(resolved)) return { path: resolved, source: 'config' };
        }
    }
    const fromPath = findExecutableInPath();
    if (fromPath) return { path: fromPath, source: 'PATH' };
    return { path: null, source: 'not-found' };
}

let opencodeResolved = null;
try {
    opencodeResolved = resolveOpencodePathLocal(finalConfig.OPENCODE_PATH);
    if (opencodeResolved.path) {
        try {
            execFileSync(opencodeResolved.path, ['--version'], { stdio: 'ignore' });
            if (!process.env.OPENCODE_QUIET_ENV) {
                console.log(`[Config] OpenCode CLI detected: ${opencodeResolved.path} (${opencodeResolved.source})`);
            }
        } catch (e) {
            console.warn(`[Warning] Found '${opencodeResolved.path}' but failed to execute --version: ${e.message}`);
        }
    } else {
        const severity = finalConfig.MANAGE_BACKEND ? 'Error' : 'Warning';
        console.error(`[${severity}] Cannot locate OpenCode CLI ('${finalConfig.OPENCODE_PATH}').`);
        console.error('         Install it with one of:');
        console.error('           Windows : npm install -g opencode-ai');
        console.error('           Linux   : curl -fsSL https://opencode.ai/install | bash');
        console.error('           macOS   : brew install opencode   OR   curl -fsSL https://opencode.ai/install | bash');
        console.error('         Or set OPENCODE_PATH in .env / config.json to the full path of the opencode executable, e.g.');
        if (process.platform === 'win32') {
            console.error('           OPENCODE_PATH=C:\\Users\\YourName\\AppData\\Roaming\\npm\\opencode.cmd');
        } else {
            console.error('           OPENCODE_PATH=/home/yourname/.local/bin/opencode');
        }
        if (finalConfig.MANAGE_BACKEND) {
            console.error('         MANAGE_BACKEND is on, so the proxy will not be able to auto-start the backend.');
            process.exit(1);
        }
    }
} catch (e) {
    console.warn(`[Warning] OpenCode pre-flight check failed: ${e.message}`);
}

console.log(`[Config] Mode: ${inDocker ? 'docker' : 'direct'} (platform=${process.platform}, node=${process.versions.node})`);
console.log('[Config] Starting with configuration:');
console.log(`  - Port: ${finalConfig.PORT}`);
console.log(`  - Bind Host: ${finalConfig.BIND_HOST}`);
console.log(`  - Backend: ${finalConfig.OPENCODE_SERVER_URL}`);
console.log(`  - Backend Password: ${finalConfig.OPENCODE_SERVER_PASSWORD ? 'Configured' : 'Not configured'}`);
console.log(`  - OpenCode Path: ${finalConfig.OPENCODE_PATH}`);
console.log(`  - API Key: ${finalConfig.API_KEY ? 'Configured' : 'Not configured (no auth)'}`);
console.log(`  - Zen API Key: ${finalConfig.ZEN_API_KEY ? 'Configured' : 'Not configured'}`);
console.log(`  - Disable Tools: ${finalConfig.DISABLE_TOOLS ? 'Yes' : 'No'}`);
console.log(`  - External Tools Mode: ${finalConfig.EXTERNAL_TOOLS_MODE}`);
console.log(`  - External Tools Conflict Policy: ${finalConfig.EXTERNAL_TOOLS_CONFLICT_POLICY}`);
console.log(`  - Internal web_fetch Enabled: ${finalConfig.INTERNAL_WEB_FETCH_ENABLED ? 'Yes' : 'No'}`);
console.log(`  - Internal Allowed Tools: ${finalConfig.INTERNAL_ALLOWED_TOOLS.length ? finalConfig.INTERNAL_ALLOWED_TOOLS.join(', ') : '(none)'}`);
console.log(`  - Internal Tool Metrics Enabled: ${finalConfig.INTERNAL_TOOL_METRICS_ENABLED ? 'Yes' : 'No'}`);
console.log(`  - Internal Tool Discovery Fixture: ${finalConfig.INTERNAL_TOOL_DISCOVERY_FIXTURE.length ? finalConfig.INTERNAL_TOOL_DISCOVERY_FIXTURE.join(', ') : '(none)'}`);
console.log(`  - Health Details Enabled: ${finalConfig.HEALTH_DETAILS_ENABLED ? 'Yes' : 'No'}`);
console.log(`  - Health Details Require Auth: ${finalConfig.HEALTH_DETAILS_REQUIRE_AUTH ? 'Yes' : 'No'}`);
console.log(`  - Metrics Enabled: ${finalConfig.METRICS_ENABLED ? 'Yes' : 'No'}`);
console.log(`  - Metrics Require Auth: ${finalConfig.METRICS_REQUIRE_AUTH ? 'Yes' : 'No'}`);
console.log(`  - Use Isolated Home: ${finalConfig.USE_ISOLATED_HOME ? 'Yes' : 'No'}`);
console.log(`  - Request Timeout: ${finalConfig.REQUEST_TIMEOUT_MS}ms`);
console.log(`  - Prompt Mode: ${finalConfig.PROMPT_MODE}`);
console.log(`  - Omit System Prompt: ${finalConfig.OMIT_SYSTEM_PROMPT ? 'Yes' : 'No'}`);
console.log(`  - Auto Cleanup Conversations: ${finalConfig.AUTO_CLEANUP_CONVERSATIONS ? 'Yes' : 'No'}`);
console.log(`  - Cleanup Interval: ${finalConfig.CLEANUP_INTERVAL_MS}ms`);
console.log(`  - Cleanup Max Age: ${finalConfig.CLEANUP_MAX_AGE_MS}ms`);
console.log(`  - Debug: ${finalConfig.DEBUG ? 'Yes' : 'No'}`);

// Start the proxy
try {
    const proxy = startProxy(finalConfig);
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Shutdown] Received SIGINT, shutting down gracefully...');
        proxy.killBackend();
        proxy.server.close(() => {
            console.log('[Shutdown] Server closed');
            process.exit(0);
        });
    });
    
    process.on('SIGTERM', () => {
        console.log('\n[Shutdown] Received SIGTERM, shutting down gracefully...');
        proxy.killBackend();
        proxy.server.close(() => {
            console.log('[Shutdown] Server closed');
            process.exit(0);
        });
    });
} catch (error) {
    console.error('[Fatal] Failed to start proxy:', error.message);
    process.exit(1);
}
