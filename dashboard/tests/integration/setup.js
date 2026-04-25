'use strict';

const { spawn } = require('child_process');
const { createConnection } = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT  = path.resolve(__dirname, '../../..');
const STATE_FILE = path.join(os.tmpdir(), 'openclaw-integration-state.json');

function waitForPort(port, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        const deadline = Date.now() + timeoutMs;
        const attempt = () => {
            const sock = createConnection(port, 'localhost');
            sock.once('connect', () => { sock.destroy(); resolve(); });
            sock.once('error', () => {
                if (Date.now() >= deadline) return reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`));
                setTimeout(attempt, 150);
            });
        };
        attempt();
    });
}

function waitForOutput(proc, pattern, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Timed out waiting for: ${pattern}`)),
            timeoutMs
        );
        const check = (data) => {
            if (pattern.test(data.toString())) {
                clearTimeout(timer);
                resolve();
            }
        };
        proc.stdout.on('data', check);
        proc.stderr.on('data', check);
    });
}

module.exports = async function globalSetup() {
    const tmpStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-relay-storage-'));

    console.log('\n[Integration Setup] Starting local relay...');
    const relay = spawn('node', ['index.js'], {
        cwd: path.join(REPO_ROOT, 'relay'),
        env: { ...process.env, PORT: '8080', STORAGE_PATH: tmpStorageDir },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    relay.stdout.on('data', d => process.stdout.write(`  [relay] ${d}`));
    relay.stderr.on('data', d => process.stderr.write(`  [relay] ${d}`));

    await waitForPort(8080);
    console.log('[Integration Setup] Relay ready on :8080');

    console.log('[Integration Setup] Starting local bridge...');
    const bridge = spawn('node', ['bridge.js'], {
        cwd: path.join(REPO_ROOT, 'bridge'),
        env: { ...process.env, RELAY_URL: 'ws://localhost:8080' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    bridge.stdout.on('data', d => process.stdout.write(`  [bridge] ${d}`));
    bridge.stderr.on('data', d => process.stderr.write(`  [bridge] ${d}`));

    await waitForOutput(bridge, /Connected to relay/, 10000);
    console.log('[Integration Setup] Bridge connected to relay');

    // Let the relay process the provider registration
    await new Promise(r => setTimeout(r, 500));

    fs.writeFileSync(STATE_FILE, JSON.stringify({
        relayPid:     relay.pid,
        bridgePid:    bridge.pid,
        tmpStorageDir,
    }));

    console.log('[Integration Setup] Stack ready.\n');
};
