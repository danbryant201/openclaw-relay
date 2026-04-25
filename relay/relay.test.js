'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');
const { createServer } = require('./index.js');
const { FileStorageProvider } = require('./storage.js');
const { Handshake } = require('../shared/crypto/Handshake.js');

// Helper: connect a WebSocket and collect messages via nextMessage()
function wsConnect(url) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(url);
        const pending = [];
        const waiters = [];

        ws.on('open', () => {
            resolve({
                ws,
                nextMessage: (timeoutMs = 3000) => new Promise((res, rej) => {
                    if (pending.length > 0) return res(pending.shift());
                    const timer = setTimeout(() => rej(new Error('nextMessage timed out')), timeoutMs);
                    waiters.push(msg => { clearTimeout(timer); res(msg); });
                }),
                close: () => new Promise(res => { ws.once('close', res); ws.close(); }),
                closeCode: () => new Promise(res => ws.once('close', (code) => res(code)))
            });
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data.toString());
            if (waiters.length > 0) waiters.shift()(msg);
            else pending.push(msg);
        });

        ws.on('error', reject);
    });
}

describe('Relay — provider/consumer routing', () => {
    let wss, port, tmpDir, storage;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-relay-test-'));
        storage = new FileStorageProvider(tmpDir);
        wss = createServer(0, storage);
        await new Promise(resolve => wss.once('listening', resolve));
        port = wss.address().port;
    });

    after(async () => {
        await new Promise(resolve => wss.close(resolve));
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('provider receives consumer_connected when consumer joins', async () => {
        const gid = 'gw-routing-test';
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${gid}`);
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=${gid}`);

        // The relay sends consumer_connected only to the provider, not the consumer
        const providerMsg = await provider.nextMessage();
        assert.strictEqual(providerMsg.type, 'consumer_connected');

        await provider.close();
        await consumer.close();
    });

    it('messages sent by provider are forwarded to consumer', async () => {
        const gid = 'gw-forward-p2c';
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${gid}`);
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=${gid}`);

        // consumer_connected notification goes to provider
        await provider.nextMessage();

        provider.ws.send(JSON.stringify({ type: 'hs_step1', pub: 'aabbcc' }));
        const received = await consumer.nextMessage();
        assert.strictEqual(received.type, 'hs_step1');
        assert.strictEqual(received.pub, 'aabbcc');

        await provider.close();
        await consumer.close();
    });

    it('messages sent by consumer are forwarded to provider', async () => {
        const gid = 'gw-forward-c2p';
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${gid}`);
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=${gid}`);

        await provider.nextMessage(); // consumer_connected

        consumer.ws.send(JSON.stringify({ type: 'hs_step2', pub: 'ddeeff' }));
        const received = await provider.nextMessage();
        assert.strictEqual(received.type, 'hs_step2');
        assert.strictEqual(received.pub, 'ddeeff');

        await provider.close();
        await consumer.close();
    });
});

describe('Relay — identity verification (security-critical)', () => {
    let wss, port, tmpDir, storage;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-relay-sec-'));
        storage = new FileStorageProvider(tmpDir);
        wss = createServer(0, storage);
        await new Promise(resolve => wss.once('listening', resolve));
        port = wss.address().port;
    });

    after(async () => {
        await new Promise(resolve => wss.close(resolve));
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    async function doValidHandshake(gwId, identity) {
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${gwId}`);
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=${gwId}`);
        await provider.nextMessage(); // consumer_connected

        const timestamp = Date.now();
        const msgToSign = Buffer.from(`${gwId}:${timestamp}`);
        const signature = Handshake.sign(identity.privateKey, msgToSign);

        provider.ws.send(JSON.stringify({
            type: 'hs_step3',
            identityPub: Buffer.from(identity.publicKey).toString('hex'),
            signature: Buffer.from(signature).toString('hex'),
            timestamp
        }));

        // Give relay time to process and write to storage
        await new Promise(r => setTimeout(r, 100));
        await provider.close();
        await consumer.close();
    }

    it('auto-registers a new gateway and accepts valid identity + signature', async () => {
        const gwId = 'gw-autoregister';
        const identity = Handshake.generateIdentityKeyPair();

        // Should not throw — valid first registration
        await doValidHandshake(gwId, identity);

        // Confirm the identity was stored
        const stored = await storage.getMetadata(gwId);
        assert.ok(stored, 'metadata should be saved');
        assert.strictEqual(stored.gatewayPublicKey, Buffer.from(identity.publicKey).toString('hex'));
    });

    it('rejects provider presenting a different identity key (identity mismatch)', async () => {
        const gwId = 'gw-mismatch';
        const identityA = Handshake.generateIdentityKeyPair();
        const identityB = Handshake.generateIdentityKeyPair();

        // Register identity A
        await doValidHandshake(gwId, identityA);

        // Now connect with identity B — should be rejected with close code 4003
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${gwId}`);
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=${gwId}`);
        await provider.nextMessage(); // consumer_connected

        const codePromise = new Promise(res => provider.ws.once('close', (code) => res(code)));

        const timestamp = Date.now();
        const msgToSign = Buffer.from(`${gwId}:${timestamp}`);
        const signature = Handshake.sign(identityB.privateKey, msgToSign);

        provider.ws.send(JSON.stringify({
            type: 'hs_step3',
            identityPub: Buffer.from(identityB.publicKey).toString('hex'),
            signature: Buffer.from(signature).toString('hex'),
            timestamp
        }));

        const closeCode = await codePromise;
        assert.strictEqual(closeCode, 4003);

        await consumer.close();
    });

    it('rejects provider with correct key but invalid signature', async () => {
        const gwId = 'gw-badsig';
        const identity = Handshake.generateIdentityKeyPair();
        const otherIdentity = Handshake.generateIdentityKeyPair();

        // Register the identity
        await doValidHandshake(gwId, identity);

        // Connect again: correct public key, but signed with a different private key
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${gwId}`);
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=${gwId}`);
        await provider.nextMessage(); // consumer_connected

        const codePromise = new Promise(res => provider.ws.once('close', (code) => res(code)));

        const timestamp = Date.now();
        const msgToSign = Buffer.from(`${gwId}:${timestamp}`);
        const badSig = Handshake.sign(otherIdentity.privateKey, msgToSign); // wrong key

        provider.ws.send(JSON.stringify({
            type: 'hs_step3',
            identityPub: Buffer.from(identity.publicKey).toString('hex'), // correct pub
            signature: Buffer.from(badSig).toString('hex'),               // wrong sig
            timestamp
        }));

        const closeCode = await codePromise;
        assert.strictEqual(closeCode, 4003);

        await consumer.close();
    });
});

describe('Relay — pairing flow', () => {
    let wss, port, tmpDir, storage;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-relay-pairing-'));
        storage = new FileStorageProvider(tmpDir);
        wss = createServer(0, storage);
        await new Promise(resolve => wss.once('listening', resolve));
        port = wss.address().port;
    });

    after(async () => {
        await new Promise(resolve => wss.close(resolve));
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('consumer receives pairing_initiated with a valid code', async () => {
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=init&action=init_pairing`);
        const msg = await consumer.nextMessage();

        assert.strictEqual(msg.type, 'pairing_initiated');
        assert.match(msg.pairingCode, /^\d{6}$/);
        assert.ok(msg.pairingId.includes(msg.pairingCode));

        await consumer.close();
    });

    it('provider joining with valid code notifies both sides', async () => {
        const consumer = await wsConnect(`ws://localhost:${port}?type=consumer&id=init2&action=init_pairing`);
        const initiated = await consumer.nextMessage();
        assert.strictEqual(initiated.type, 'pairing_initiated');

        const code = initiated.pairingCode;
        const provider = await wsConnect(`ws://localhost:${port}?type=provider&id=${code}&action=join_pairing`);

        const providerMsg = await provider.nextMessage();
        assert.strictEqual(providerMsg.type, 'pairing_joined');
        assert.ok(providerMsg.pairingId);

        const consumerMsg = await consumer.nextMessage();
        assert.strictEqual(consumerMsg.type, 'gateway_ready');
        assert.strictEqual(consumerMsg.pairingId, providerMsg.pairingId);

        await provider.close();
        await consumer.close();
    });

    it('provider joining with invalid code is rejected with close code 4004', async () => {
        const codePromise = new Promise(resolve => {
            const ws = new WebSocket(`ws://localhost:${port}?type=provider&id=000000&action=join_pairing`);
            ws.once('close', (code) => resolve(code));
        });
        const closeCode = await codePromise;
        assert.strictEqual(closeCode, 4004);
    });
});
