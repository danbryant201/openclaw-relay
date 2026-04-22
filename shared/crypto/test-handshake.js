const { Handshake } = require('./Handshake.js');
const assert = require('node:assert');

console.log('--- Testing Handshake Class ---');

// 1. Generate Keypairs
console.log('1. Generating keypairs...');
const alice = Handshake.generateKeyPair();
const bob = Handshake.generateKeyPair();

console.log('Alice Public Key:', Buffer.from(alice.publicKey).toString('hex'));
console.log('Bob Public Key:  ', Buffer.from(bob.publicKey).toString('hex'));

// 2. Perform DH Exchange
console.log('\n2. Performing Diffie-Hellman exchange...');
const aliceSecret = Handshake.deriveSharedSecret(alice.privateKey, bob.publicKey);
const bobSecret = Handshake.deriveSharedSecret(bob.privateKey, alice.publicKey);

console.log('Alice Shared Secret:', Buffer.from(aliceSecret).toString('hex'));
console.log('Bob Shared Secret:  ', Buffer.from(bobSecret).toString('hex'));

assert.deepStrictEqual(aliceSecret, bobSecret, 'Secrets must match');
console.log('✅ Shared secrets match!');

// 3. Encrypt / Decrypt Test
console.log('\n3. Testing Encrypt/Decrypt...');
const message = 'Hello, this is a secret message!';
const payload = Buffer.from(message);

const { ciphertext, iv, tag } = Handshake.encrypt(aliceSecret, payload);
console.log('Ciphertext:', ciphertext.toString('hex'));

const decrypted = Handshake.decrypt(bobSecret, iv, tag, ciphertext);
console.log('Decrypted: ', decrypted.toString());

assert.strictEqual(decrypted.toString(), message, 'Decrypted message must match original');
console.log('✅ Encryption/Decryption successful!');

// 4. Identity Signature Test
console.log('\n4. Testing Identity Signatures (Ed25519)...');
const identity = Handshake.generateIdentityKeyPair();
const testMsg = Buffer.from('test-message');
const signature = Handshake.sign(identity.privateKey, testMsg);

const isValid = Handshake.verify(identity.publicKey, testMsg, signature);
console.log('Signature valid:', isValid);
assert.strictEqual(isValid, true, 'Signature should be valid');

const isInvalid = Handshake.verify(identity.publicKey, Buffer.from('wrong message'), signature);
console.log('Invalid message rejection:', !isInvalid);
assert.strictEqual(isInvalid, false, 'Signature should be invalid for different message');

console.log('✅ Signature verification successful!');

console.log('\n--- All Tests Passed ---');
