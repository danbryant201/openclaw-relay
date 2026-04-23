const { Handshake } = require('../shared/crypto/Handshake');

/**
 * PairingManager handles the logic for a Consumer to link with a Gateway.
 * 
 * Flow (Phase 2.2):
 * 1. Consumer generates a short-lived "Pairing Secret" and a pairing ID.
 * 2. Dan enters the Pairing Code on the Gateway (NucBox).
 * 3. Gateway connects to Relay using the pairing ID.
 * 4. Gateway and Consumer perform a Noise_XX handshake over the relay.
 * 5. They exchange long-term identity public keys.
 * 6. Connection is finalized; Pairing ID is discarded.
 */
class PairingManager {
    /**
     * Generates a random 6-digit numeric pairing code.
     */
    static generatePairingCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    /**
     * Prepares the Consumer for a pairing session.
     * returns { pairingId, pairingCode, ephemeralKeyPair }
     */
    static initiatePairing() {
        const pairingCode = this.generatePairingCode();
        // The pairingId is a hash or derivative to avoid leaking the code in the URL
        const pairingId = `pair-${pairingCode}`; 
        const ephemeralKeyPair = Handshake.generateKeyPair();
        
        return {
            pairingId,
            pairingCode,
            ephemeralKeyPair
        };
    }
}

module.exports = { PairingManager };
