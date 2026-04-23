const { x25519, ed25519 } = require('@noble/curves/ed25519.js');
const { randomBytes, createCipheriv, createDecipheriv, createVerify, createSign } = require('node:crypto');

/**
 * Handshake class implementing basic E2EE primitives for a Noise-like handshake.
 */
class Handshake {
  /**
   * Generates a new X25519 keypair.
   * @returns {Object} { publicKey, privateKey } as Uint8Array
   */
  static generateKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = x25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
  }

  /**
   * Generates a new Ed25519 identity keypair.
   * @returns {Object} { publicKey, privateKey } as Uint8Array
   */
  static generateIdentityKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = ed25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
  }

  /**
   * Performs Diffie-Hellman exchange.
   * @param {Uint8Array} privateKey Your private key
   * @param {Uint8Array} publicKey Their public key
   * @returns {Uint8Array} Shared secret
   */
  static deriveSharedSecret(privateKey, publicKey) {
    return x25519.getSharedSecret(privateKey, publicKey);
  }

  /**
   * Signs a message using Ed25519.
   * @param {Uint8Array} privateKey Ed25519 private key
   * @param {Uint8Array} message Message to sign
   * @returns {Uint8Array} Signature
   */
  static sign(privateKey, message) {
    return ed25519.sign(message, privateKey);
  }

  /**
   * Verifies an Ed25519 signature.
   * @param {Uint8Array} publicKey Ed25519 public key
   * @param {Uint8Array} message Message that was signed
   * @param {Uint8Array} signature Signature to verify
   * @returns {boolean}
   */
  static verify(publicKey, message, signature) {
    return ed25519.verify(signature, message, publicKey);
  }

  /**
   * Encrypts a payload using AES-256-GCM.
   * @param {Buffer|Uint8Array} key 32-byte key
   * @param {Buffer|Uint8Array} payload Data to encrypt
   * @returns {Object} { ciphertext, iv, tag }
   */
  static encrypt(key, payload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
  }

  /**
   * Decrypts a payload using AES-256-GCM.
   * @param {Buffer|Uint8Array} key 32-byte key
   * @param {Buffer|Uint8Array} iv 12-byte IV
   * @param {Buffer|Uint8Array} tag 16-byte Auth Tag
   * @param {Buffer|Uint8Array} ciphertext Encrypted data
   * @returns {Buffer} Decrypted payload
   */
  static decrypt(key, iv, tag, ciphertext) {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}

module.exports = { Handshake };
