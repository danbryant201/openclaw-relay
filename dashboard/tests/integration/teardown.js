'use strict';

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const STATE_FILE = path.join(os.tmpdir(), 'openclaw-integration-state.json');

function killGracefully(pid) {
    if (!pid) return;
    try {
        process.kill(pid, 'SIGTERM');
        setTimeout(() => {
            try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
        }, 2000);
    } catch { /* already gone */ }
}

module.exports = async function globalTeardown() {
    if (!fs.existsSync(STATE_FILE)) return;

    let state;
    try {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch {
        return;
    }

    console.log('\n[Integration Teardown] Stopping relay and bridge...');
    killGracefully(state.relayPid);
    killGracefully(state.bridgePid);

    if (state.tmpStorageDir && fs.existsSync(state.tmpStorageDir)) {
        fs.rmSync(state.tmpStorageDir, { recursive: true, force: true });
    }

    fs.unlinkSync(STATE_FILE);
    console.log('[Integration Teardown] Done.\n');
};
