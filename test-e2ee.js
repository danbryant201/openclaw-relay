const WebSocket = require('ws');
const { Handshake } = require('./shared/crypto/Handshake.js');

/**
 * OpenClaw E2EE Test (Consumer Simulator)
 */

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8080?type=consumer&id=dan-nucbox';

console.log(`[Consumer] Connecting to relay at ${RELAY_URL}...`);
const ws = new WebSocket(RELAY_URL);

let myEphemeral;
let sharedSecret;

ws.on('open', () => {
    console.log('[Consumer] Connected to relay. Waiting for Bridge (Step 1)...');
});

ws.on('message', (data) => {
    let message;
    try {
        message = JSON.parse(data.toString());
    } catch (e) {
        console.log(`[Consumer] Received non-JSON: ${data.toString()}`);
        return;
    }

    console.log(`[Consumer] Received type: ${message.type}`);

    switch (message.type) {
        case 'hs_step1':
            console.log('[Consumer] Received Bridge public key. Generating my own (Step 2)...');
            myEphemeral = Handshake.generateKeyPair();
            
            const bridgePub = Buffer.from(message.pub, 'hex');
            sharedSecret = Handshake.deriveSharedSecret(myEphemeral.privateKey, bridgePub);
            console.log(`[Consumer] Shared secret derived: ${Buffer.from(sharedSecret).toString('hex').substring(0, 8)}...`);

            ws.send(JSON.stringify({
                type: 'hs_step2',
                pub: Buffer.from(myEphemeral.publicKey).toString('hex')
            }));
            break;

        case 'hs_step3':
            console.log('[Consumer] Received Step 3 (Bridge Proof). Decrypting verification...');
            try {
                const decrypted = Handshake.decrypt(
                    sharedSecret,
                    Buffer.from(message.iv, 'hex'),
                    Buffer.from(message.tag, 'hex'),
                    Buffer.from(message.ciphertext, 'hex')
                );
                console.log(`[Consumer] Bridge proof decrypted: "${decrypted.toString()}"`);

                if (decrypted.toString() === 'BRIDGE_READY') {
                    console.log('[Consumer] Handshake verified! Sending secure "Hello Secure World"...');
                    const testMsg = Handshake.encrypt(sharedSecret, Buffer.from('Hello Secure World'));
                    ws.send(JSON.stringify({
                        type: 'encrypted_message',
                        ciphertext: testMsg.ciphertext.toString('hex'),
                        iv: testMsg.iv.toString('hex'),
                        tag: testMsg.tag.toString('hex')
                    }));
                }
            } catch (e) {
                console.error('[Consumer] Verification failed!', e.message);
            }
            break;

        default:
            console.log(`[Consumer] Message from bridge: ${JSON.stringify(message)}`);
    }
});

ws.on('error', (err) => {
    console.error(`[Consumer] Error: ${err.message}`);
});

ws.on('close', () => {
    console.log('[Consumer] Connection closed.');
});
