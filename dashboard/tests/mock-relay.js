'use strict';

const { WebSocketServer } = require('ws');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { x25519 } = require('@noble/curves/ed25519');

function generateKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = x25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
}

function deriveSharedSecret(privateKey, publicKey) {
    return x25519.getSharedSecret(privateKey, publicKey);
}

function encrypt(key, payload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
}

function decrypt(key, iv, tag, ciphertext) {
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Creates a mock relay that simulates the bridge side of the Noise_XX handshake.
 * Handles list_sessions, send_command, and start_logs with configurable responses.
 *
 * @param {number} port - Port to listen on (default 8080)
 * @param {object} options
 * @param {Array}  options.sessions - Mock session list returned for list_sessions
 */
function createMockRelay(port = 8080, { sessions = [] } = {}) {
    const wss = new WebSocketServer({ port });

    wss.on('connection', (ws) => {
        const ephemeral = generateKeyPair();
        let sharedSecret = null;

        // Immediately initiate handshake (simulating bridge already connected)
        ws.send(JSON.stringify({
            type: 'hs_step1',
            pub: Buffer.from(ephemeral.publicKey).toString('hex')
        }));

        ws.on('message', (data) => {
            let message;
            try {
                message = JSON.parse(data.toString());
            } catch {
                return;
            }

            if (message.type === 'hs_step2') {
                const dashboardPub = Buffer.from(message.pub, 'hex');
                sharedSecret = deriveSharedSecret(ephemeral.privateKey, dashboardPub);
                ws.send(JSON.stringify({ type: 'hs_step3' }));
                return;
            }

            if (message.type === 'encrypted_message' && sharedSecret) {
                let payload;
                try {
                    const decrypted = decrypt(
                        sharedSecret,
                        Buffer.from(message.iv, 'hex'),
                        Buffer.from(message.tag, 'hex'),
                        Buffer.from(message.ciphertext, 'hex')
                    );
                    payload = JSON.parse(decrypted.toString());
                } catch {
                    return;
                }

                let response;
                if (payload.action === 'list_sessions') {
                    response = { type: 'session_list', sessions };
                } else if (payload.action === 'send_command') {
                    response = {
                        type: 'command_result',
                        threadId: payload.threadId,
                        output: `[mock] received: ${payload.text}`
                    };
                } else if (payload.action === 'start_logs') {
                    response = { type: 'log_entry', level: 'info', message: 'Mock log stream started.' };
                } else {
                    response = { type: 'error', message: `Unknown action: ${payload.action}` };
                }

                const enc = encrypt(sharedSecret, Buffer.from(JSON.stringify(response)));
                ws.send(JSON.stringify({
                    type: 'encrypted_message',
                    ciphertext: enc.ciphertext.toString('hex'),
                    iv: enc.iv.toString('hex'),
                    tag: enc.tag.toString('hex')
                }));
            }
        });
    });

    return wss;
}

module.exports = { createMockRelay };
