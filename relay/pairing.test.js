'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { PairingManager } = require('./pairing.js');

describe('PairingManager.generatePairingCode', () => {
    it('returns a 6-digit numeric string', () => {
        const code = PairingManager.generatePairingCode();
        assert.match(code, /^\d{6}$/);
    });

    it('is always in range 100000–999999', () => {
        for (let i = 0; i < 50; i++) {
            const n = parseInt(PairingManager.generatePairingCode(), 10);
            assert.ok(n >= 100000 && n <= 999999, `code ${n} out of range`);
        }
    });

    it('produces distinct codes across calls (probabilistic)', () => {
        const codes = new Set(Array.from({ length: 20 }, () => PairingManager.generatePairingCode()));
        assert.ok(codes.size > 1, 'all 20 codes were identical — RNG appears broken');
    });
});

describe('PairingManager.initiatePairing', () => {
    it('returns pairingCode, pairingId, and ephemeralKeyPair', () => {
        const result = PairingManager.initiatePairing();
        assert.ok(typeof result.pairingCode === 'string');
        assert.ok(typeof result.pairingId === 'string');
        assert.ok(result.ephemeralKeyPair);
        assert.ok(result.ephemeralKeyPair.publicKey);
        assert.ok(result.ephemeralKeyPair.privateKey);
    });

    it('pairingId embeds the pairingCode', () => {
        const result = PairingManager.initiatePairing();
        assert.ok(result.pairingId.includes(result.pairingCode));
    });

    it('pairingCode is valid 6-digit format', () => {
        const { pairingCode } = PairingManager.initiatePairing();
        assert.match(pairingCode, /^\d{6}$/);
    });

    it('ephemeral keys are 32 bytes', () => {
        const { ephemeralKeyPair } = PairingManager.initiatePairing();
        assert.strictEqual(ephemeralKeyPair.publicKey.length, 32);
        assert.strictEqual(ephemeralKeyPair.privateKey.length, 32);
    });

    it('each call produces a fresh ephemeral keypair', () => {
        const a = PairingManager.initiatePairing();
        const b = PairingManager.initiatePairing();
        const aPub = Buffer.from(a.ephemeralKeyPair.publicKey).toString('hex');
        const bPub = Buffer.from(b.ephemeralKeyPair.publicKey).toString('hex');
        assert.notStrictEqual(aPub, bPub);
    });
});
