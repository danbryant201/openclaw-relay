const WebSocket = require('ws');
const { Handshake } = require('../shared/crypto/Handshake.js');
const fs = require('fs');
const path = require('path');
const MemoryAgent = require('./memory-agent.js');
const { loadSessions, loadTitles, lookupSessionId } = require('./sessions.js');

/**
 * OpenClaw Relay Bridge (Alpha)
 */

const RELAY_BASE = process.env.RELAY_URL || 'wss://ca-relay-uogm7gtzixdzo.ashyocean-9489ea26.ukwest.azurecontainerapps.io';
const GATEWAY_ID = process.env.GATEWAY_ID || 'dan-nucbox';
const WORKSPACE_PATH = process.env.WORKSPACE_PATH || path.resolve(__dirname, '../../');
const RECONNECT_INTERVAL = 5000;
const IDENTITY_FILE = path.resolve(__dirname, './identity.json');
const SESSIONS_PATH = 'C:/Users/Admin/.openclaw/agents/main/sessions/sessions.json';
const TITLES_PATH = 'C:/Users/Admin/.openclaw/agents/main/titles.json';

let ws;
let reconnectTimer;
let myEphemeral;
let sharedSecret;
let myIdentity;
let memoryAgent;

// Initialize Memory Agent
memoryAgent = new MemoryAgent(null, WORKSPACE_PATH);
console.log(`[Bridge] Memory Agent active for: ${WORKSPACE_PATH}`);


// Load or generate identity
if (fs.existsSync(IDENTITY_FILE)) {
    myIdentity = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'));
    myIdentity.publicKey = Buffer.from(myIdentity.publicKey, 'hex');
    myIdentity.privateKey = Buffer.from(myIdentity.privateKey, 'hex');
    console.log('[Bridge] Loaded identity:', Buffer.from(myIdentity.publicKey).toString('hex').substring(0, 16));
} else {
    console.log('[Bridge] Generating new identity...');
    myIdentity = Handshake.generateIdentityKeyPair();
    fs.writeFileSync(IDENTITY_FILE, JSON.stringify({
        publicKey: Buffer.from(myIdentity.publicKey).toString('hex'),
        privateKey: Buffer.from(myIdentity.privateKey).toString('hex')
    }, null, 2));
}

function connect(pairingId = null) {
    const id = pairingId || GATEWAY_ID;
    const url = `${RELAY_BASE}?type=provider&id=${id}`;
    
    console.log(`[Bridge] Connecting to relay at ${url}...`);
    ws = new WebSocket(url);
    setupWs(ws, id);
}

function pair(code) {
    const url = `${RELAY_BASE}?type=provider&id=${code}&action=join_pairing`;
    console.log(`[Bridge] Attempting to pair with code: ${code}...`);
    ws = new WebSocket(url);
    setupWs(ws, code, true);
}

function setupWs(socket, id, isPairing = false) {
    socket.on('open', () => {
        console.log('[Bridge] Connected to relay.');
        if (reconnectTimer) {
            clearInterval(reconnectTimer);
            reconnectTimer = null;
        }
    });

    socket.on('message', async (data) => {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (e) {
            return;
        }

        console.log(`[Bridge] Received type: ${message.type}`);

        switch (message.type) {
            case 'pairing_joined':
                console.log(`[Bridge] Pairing successful! Swapping to tunnel ID: ${message.pairingId}`);
                socket.close();
                connect(message.pairingId);
                break;
                
            case 'consumer_connected':
                console.log('[Bridge] Consumer connected, initiating handshake step 1...');
                myEphemeral = Handshake.generateKeyPair();
                ws.send(JSON.stringify({
                    type: 'hs_step1',
                    pub: Buffer.from(myEphemeral.publicKey).toString('hex')
                }));
                break;

            case 'hs_step2':
                console.log('[Bridge] Received handshake step 2. Deriving secret and signing identity...');
                const consumerPub = Buffer.from(message.pub, 'hex');
                sharedSecret = Handshake.deriveSharedSecret(myEphemeral.privateKey, consumerPub);
                console.log(`[Bridge] Shared secret derived: ${Buffer.from(sharedSecret).toString('hex').substring(0, 8)}...`);
                
                const timestamp = Date.now();
                const msgToSign = Buffer.from(`${id}:${timestamp}`);
                const signature = Handshake.sign(myIdentity.privateKey, msgToSign);
                const proof = Handshake.encrypt(sharedSecret, Buffer.from('BRIDGE_READY'));
                
                ws.send(JSON.stringify({
                    type: 'hs_step3',
                    identityPub: Buffer.from(myIdentity.publicKey).toString('hex'),
                    signature: Buffer.from(signature).toString('hex'),
                    timestamp: timestamp,
                    ciphertext: proof.ciphertext.toString('hex'),
                    iv: proof.iv.toString('hex'),
                    tag: proof.tag.toString('hex')
                }));
                break;

            case 'encrypted_message':
                if (!sharedSecret) {
                    console.log('[Bridge] Received encrypted message before handshake completion.');
                    return;
                }
                try {
                    const decrypted = Handshake.decrypt(
                        sharedSecret,
                        Buffer.from(message.iv, 'hex'),
                        Buffer.from(message.tag, 'hex'),
                        Buffer.from(message.ciphertext, 'hex')
                    );
                    
                    const payload = JSON.parse(decrypted.toString());
                    console.log(`[Bridge] Handled request: ${payload.action}`);

                    let result = { type: 'error', message: 'Not implemented' };
                    
                    if (payload.action === 'start_logs') {
                        result = { type: 'log_entry', message: 'Bridge log stream started.', level: 'info' };
                    } else if (payload.action === 'list_sessions') {
                        result = { type: 'session_list', sessions: loadSessions(SESSIONS_PATH, TITLES_PATH) };
                    } else if (payload.action === 'send_command') {
                        const { threadId, text } = payload;
                        const sessionId = lookupSessionId(SESSIONS_PATH, threadId);
                        console.log(`[Bridge] Executing command in thread ${threadId} (session ${sessionId}): ${text}`);

                        const { execSync } = require('child_process');
                        try {
                            if (!sessionId) throw new Error(`No session ID found for thread: ${threadId}`);
                            const output = execSync(`openclaw agent --session-id "${sessionId}" --message "${text.replace(/"/g, '\\"')}"`, {
                                encoding: 'utf8',
                                shell: 'powershell.exe',
                                timeout: 60000
                            });
                            result = { type: 'command_result', threadId, output };
                        } catch (err) {
                            console.error(`[Bridge] CLI execution failed:`, err.message);
                            result = { type: 'command_result', threadId, output: `CLI Error: ${err.message}` };
                        }
                    } else {
                        result = await memoryAgent.handleRequest(payload);
                    }
                    
                    const encryptedResponse = Handshake.encrypt(sharedSecret, Buffer.from(JSON.stringify(result)));
                    ws.send(JSON.stringify({
                        type: 'encrypted_message',
                        ciphertext: encryptedResponse.ciphertext.toString('hex'),
                        iv: encryptedResponse.iv.toString('hex'),
                        tag: encryptedResponse.tag.toString('hex')
                    }));

                } catch (e) {
                    console.error('[Bridge] Processing failed!', e.message);
                }
                break;
        }
    });

    ws.on('close', (code, reason) => {
        console.log(`[Bridge] Connection closed: ${code} ${reason}`);
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        console.error(`[Bridge] WebSocket error: ${err.message}`);
    });
}

function scheduleReconnect() {
    if (!reconnectTimer) {
        console.log(`[Bridge] Scheduling reconnect in ${RECONNECT_INTERVAL / 1000}s...`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, RECONNECT_INTERVAL);
    }
}

const args = process.argv.slice(2);
if (args[0] === '--pair' && args[1]) {
    pair(args[1]);
} else {
    connect();
}

process.on('SIGINT', () => {
    if (ws) ws.close();
    process.exit();
});
