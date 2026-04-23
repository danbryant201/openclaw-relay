const WebSocket = require('ws');
const { Handshake } = require('../shared/crypto/Handshake.js');
const fs = require('fs');
const path = require('path');

/**
 * OpenClaw Relay Bridge (Alpha)
 */

const RELAY_BASE = process.env.RELAY_URL || 'wss://ca-relay-uogm7gtzixdzo.lemonriver-442d0bd1.ukwest.azurecontainerapps.io';
const GATEWAY_ID = process.env.GATEWAY_ID || 'dan-nucbox';
const RECONNECT_INTERVAL = 5000;
const IDENTITY_FILE = path.resolve(__dirname, './identity.json');

let ws;
let reconnectTimer;
let myEphemeral;
let sharedSecret;
let myIdentity;

// Load or generate identity
if (fs.existsSync(IDENTITY_FILE)) {
    myIdentity = JSON.parse(fs.readFileSync(IDENTITY_FILE, 'utf8'));
    // Convert hex back to Buffer
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

/**
 * Normal connection mode
 */
function connect(pairingId = null) {
    const id = pairingId || GATEWAY_ID;
    const url = `${RELAY_BASE}?type=provider&id=${id}`;
    
    console.log(`[Bridge] Connecting to relay at ${url}...`);
    ws = new WebSocket(url);
    setupWs(ws, id);
}

/**
 * Pairing mode
 */
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

    socket.on('message', (data) => {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (e) {
            console.log(`[Bridge] Received non-JSON: ${data.toString()}`);
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
                
                // Noise-XX Step 3: Identity + Signature Proof
                const timestamp = Date.now();
                const currentId = id; // use the id passed into setupWs
                const msgToSign = Buffer.from(`${currentId}:${timestamp}`);
                const signature = Handshake.sign(myIdentity.privateKey, msgToSign);

                // We still send the proof for the consumer
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
                console.log('[Bridge] Received encrypted message. Decrypting...');
                try {
                    const decrypted = Handshake.decrypt(
                        sharedSecret,
                        Buffer.from(message.iv, 'hex'),
                        Buffer.from(message.tag, 'hex'),
                        Buffer.from(message.ciphertext, 'hex')
                    );
                    console.log(`[Bridge] Decrypted content: "${decrypted.toString()}"`);
                } catch (e) {
                    console.error('[Bridge] Decryption failed!', e.message);
                }
                break;

            default:
                console.log(`[Bridge] Unhandled message type: ${message.type}`);
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

// Start the bridge
const args = process.argv.slice(2);
if (args[0] === '--pair' && args[1]) {
    pair(args[1]);
} else {
    connect();
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('[Bridge] Shutting down...');
    if (ws) ws.close();
    process.exit();
});
