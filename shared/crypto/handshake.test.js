'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { Handshake } = require('./Handshake.js');

describe('Handshake — X25519 key exchange', () => {
    it('both sides derive the same shared secret', () => {
        const alice = Handshake.generateKeyPair();
        const bob = Handshake.generateKeyPair();
        const aliceSecret = Handshake.deriveSharedSecret(alice.privateKey, bob.publicKey);
        const bobSecret = Handshake.deriveSharedSecret(bob.privateKey, alice.publicKey);
        assert.deepStrictEqual(aliceSecret, bobSecret);
    });

    it('different remote peers produce different secrets', () => {
        const alice = Handshake.generateKeyPair();
        const bob = Handshake.generateKeyPair();
        const charlie = Handshake.generateKeyPair();
        const s1 = Handshake.deriveSharedSecret(alice.privateKey, bob.publicKey);
        const s2 = Handshake.deriveSharedSecret(alice.privateKey, charlie.publicKey);
        assert.notDeepStrictEqual(s1, s2);
    });

    it('generateKeyPair returns 32-byte keys', () => {
        const kp = Handshake.generateKeyPair();
        assert.strictEqual(kp.publicKey.length, 32);
        assert.strictEqual(kp.privateKey.length, 32);
    });
});

describe('Handshake — AES-256-GCM encrypt/decrypt', () => {
    function makeSecret() {
        const a = Handshake.generateKeyPair();
        const b = Handshake.generateKeyPair();
        return Handshake.deriveSharedSecret(a.privateKey, b.publicKey);
    }

    it('roundtrip returns original plaintext', () => {
        const secret = makeSecret();
        const plaintext = Buffer.from('hello, openclaw!');
        const { ciphertext, iv, tag } = Handshake.encrypt(secret, plaintext);
        const decrypted = Handshake.decrypt(secret, iv, tag, ciphertext);
        assert.deepStrictEqual(decrypted, plaintext);
    });

    it('empty payload roundtrips correctly', () => {
        const secret = makeSecret();
        const { ciphertext, iv, tag } = Handshake.encrypt(secret, Buffer.alloc(0));
        const decrypted = Handshake.decrypt(secret, iv, tag, ciphertext);
        assert.deepStrictEqual(decrypted, Buffer.alloc(0));
    });

    it('tampered ciphertext throws (AES-GCM auth tag)', () => {
        const secret = makeSecret();
        const { ciphertext, iv, tag } = Handshake.encrypt(secret, Buffer.from('secret'));
        const tampered = Buffer.from(ciphertext);
        tampered[0] ^= 0xff;
        assert.throws(() => Handshake.decrypt(secret, iv, tag, tampered));
    });

    it('tampered auth tag throws', () => {
        const secret = makeSecret();
        const { ciphertext, iv, tag } = Handshake.encrypt(secret, Buffer.from('secret'));
        const tamperedTag = Buffer.from(tag);
        tamperedTag[0] ^= 0xff;
        assert.throws(() => Handshake.decrypt(secret, iv, tamperedTag, ciphertext));
    });

    it('wrong decryption key throws', () => {
        const secret = makeSecret();
        const wrongSecret = makeSecret();
        const { ciphertext, iv, tag } = Handshake.encrypt(secret, Buffer.from('secret'));
        assert.throws(() => Handshake.decrypt(wrongSecret, iv, tag, ciphertext));
    });

    it('each encryption produces a unique IV', () => {
        const secret = makeSecret();
        const payload = Buffer.from('same payload');
        const r1 = Handshake.encrypt(secret, payload);
        const r2 = Handshake.encrypt(secret, payload);
        assert.notDeepStrictEqual(r1.iv, r2.iv);
        assert.notDeepStrictEqual(r1.ciphertext, r2.ciphertext);
    });
});

describe('Handshake — Ed25519 sign/verify', () => {
    it('valid signature verifies correctly', () => {
        const identity = Handshake.generateIdentityKeyPair();
        const message = Buffer.from('gateway-id:1700000000000');
        const sig = Handshake.sign(identity.privateKey, message);
        assert.strictEqual(Handshake.verify(identity.publicKey, message, sig), true);
    });

    it('tampered message fails verification', () => {
        const identity = Handshake.generateIdentityKeyPair();
        const sig = Handshake.sign(identity.privateKey, Buffer.from('original'));
        assert.strictEqual(Handshake.verify(identity.publicKey, Buffer.from('tampered'), sig), false);
    });

    it('wrong public key fails verification', () => {
        const signer = Handshake.generateIdentityKeyPair();
        const other = Handshake.generateIdentityKeyPair();
        const message = Buffer.from('test');
        const sig = Handshake.sign(signer.privateKey, message);
        assert.strictEqual(Handshake.verify(other.publicKey, message, sig), false);
    });

    it('generateIdentityKeyPair returns 32-byte keys', () => {
        const kp = Handshake.generateIdentityKeyPair();
        assert.strictEqual(kp.publicKey.length, 32);
        assert.strictEqual(kp.privateKey.length, 32);
    });
});
