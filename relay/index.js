const { WebSocketServer } = require('ws');
const url = require('url');
const { FileStorageProvider, AzureBlobStorageProvider } = require('./storage');
const { Handshake } = require('../shared/crypto/Handshake');
const { PairingManager } = require('./pairing');

const PORT = process.env.PORT || 8080;
console.log(`[Relay] Starting on port ${PORT}...`);
const wss = new WebSocketServer({ port: Number(PORT) });

// Initialize storage based on environment
let storage;
if (process.env.STORAGE_ACCOUNT_NAME) {
    console.log(`[Relay] Using Azure Blob Storage: ${process.env.STORAGE_ACCOUNT_NAME}`);
    storage = new AzureBlobStorageProvider(process.env.STORAGE_ACCOUNT_NAME, process.env.BLOB_CONTAINER_NAME || 'metadata');
} else {
    console.log('[Relay] Using Local File Storage (Development)');
    storage = new FileStorageProvider('./storage');
}

// Maps to keep track of connections
const providers = new Map(); // id -> socket
const consumers = new Map();  // id -> socket
const handshakes = new Map(); // id -> { step: number, metadata: object }
const activePairings = new Map(); // pairingCode -> { pairingId, consumerWs, createdAt }

wss.on('connection', async (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const { type, id, action } = parameters;

    // Handle Pairing Initiation (Consumer side)
    if (type === 'consumer' && action === 'init_pairing') {
        const pairing = PairingManager.initiatePairing();
        activePairings.set(pairing.pairingCode, {
            pairingId: pairing.pairingId,
            consumerWs: ws,
            createdAt: Date.now()
        });
        
        console.log(`[Relay] Pairing initiated. Code: ${pairing.pairingCode}`);
        ws.send(JSON.stringify({ 
            type: 'pairing_initiated', 
            pairingCode: pairing.pairingCode,
            pairingId: pairing.pairingId
        }));
        
        ws.on('close', () => activePairings.delete(pairing.pairingCode));
        return;
    }

    // Handle Pairing Join (Gateway/Provider side)
    if (type === 'provider' && action === 'join_pairing') {
        const code = id; // In join mode, 'id' is the code entered by user
        const pairing = activePairings.get(code);

        if (!pairing) {
            console.log(`[Relay] Invalid pairing code attempt: ${code}`);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid pairing code' }));
            ws.close(4004, 'Invalid pairing code');
            return;
        }

        console.log(`[Relay] Gateway joined pairing for code ${code}`);
        
        // Link them via the pairingId
        const pId = pairing.pairingId;
        providers.set(pId, ws);
        consumers.set(pId, pairing.consumerWs);
        
        // Notify both sides to start Noise_XX handshake
        ws.send(JSON.stringify({ type: 'pairing_joined', pairingId: pId }));
        pairing.consumerWs.send(JSON.stringify({ type: 'gateway_ready', pairingId: pId }));
        
        // Store temp handshake info
        handshakes.set(pId, { step: 0, metadata: null });

        // Cleanup the short-lived code
        activePairings.delete(code);
        return;
    }

    if (!type || !id) {
        console.log('Missing type or id in URL');
        ws.close(1008, 'Missing type or id');
        return;
    }

    console.log(`New connection: type=${type}, id=${id}`);

    // Fetch or initialize metadata/handshake state
    let hs = handshakes.get(id);
    if (!hs) {
        const metadata = await storage.getMetadata(id);
        hs = { step: 0, metadata };
        handshakes.set(id, hs);
    }

    if (type === 'provider') {
        // A provider (Gateway) is connecting
        providers.set(id, ws);
        
        // If consumer is already connected, notify them or vice versa
        const consumerWs = consumers.get(id);
        if (consumerWs && consumerWs.readyState === 1) {
            console.log(`[Relay] Handshake pairing available for ${id}`);
        }

        ws.on('message', async (message) => {
            const hs = handshakes.get(id);
            
            try {
                const parsed = JSON.parse(message);
                
                // Noise_XX Step 3: Provider proof (Identity + Signature)
                if (parsed.type === 'hs_step3') {
                    console.log(`[Relay] Handshake ${id}: Step 3 (Provider Identity Verification)`);
                    
                    const { identityPub, signature, timestamp } = parsed;

                    // Alpha Auto-Registration: Claim the ID if it's new
                    if (!hs.metadata) {
                        console.log(`[Relay] ID ${id} is unclaimed. Auto-registering provider...`);
                        const newMetadata = {
                            gatewayPublicKey: identityPub,
                            registeredAt: new Date().toISOString()
                        };
                        await storage.setMetadata(id, newMetadata);
                        hs.metadata = newMetadata;
                        console.log(`[Relay] Registered public key for ${id}: ${identityPub.substring(0, 16)}...`);
                    }

                    // Verify Identity
                    const storedKey = Buffer.from(hs.metadata.gatewayPublicKey, 'hex');
                    const receivedKey = Buffer.from(identityPub, 'hex');

                    if (!storedKey.equals(receivedKey)) {
                        console.error(`[Relay] SECURITY ALERT: Identity mismatch for ${id}!`);
                        ws.close(4003, 'Identity mismatch');
                        return;
                    }

                    // Verify Signature
                    const msgToVerify = Buffer.from(`${id}:${timestamp}`);
                    const sigBuffer = Buffer.from(signature, 'hex');
                    
                    const isValid = Handshake.verify(storedKey, msgToVerify, sigBuffer);
                    if (!isValid) {
                        console.error(`[Relay] SECURITY ALERT: Signature verification failed for ${id}!`);
                        ws.close(4003, 'Invalid signature');
                        return;
                    }

                    console.log(`[Relay] Handshake ${id}: Provider verified successfully.`);
                    hs.step = 3;
                } else if (parsed.type === 'hs_step1') {
                    console.log(`[Relay] Handshake ${id}: Step 1 (Provider -> Consumer)`);
                    hs.step = 1;
                }
            } catch (e) {
                console.error(`[Relay] Error processing provider message: ${e.message}`);
            }

            // Forward from provider to consumer
            const consumerWs = consumers.get(id);
            if (consumerWs && consumerWs.readyState === 1) {
                consumerWs.send(message);
            }
        });

        ws.on('close', () => {
            if (providers.get(id) === ws) {
                providers.delete(id);
                console.log(`Provider ${id} disconnected`);
            }
        });

    } else if (type === 'consumer') {
        // A consumer (App) is connecting
        consumers.set(id, ws);

        // Notify provider that a consumer is ready to start handshake
        const providerWs = providers.get(id);
        if (providerWs && providerWs.readyState === 1) {
            console.log(`[Relay] Consumer ${id} connected, notifying provider.`);
            providerWs.send(JSON.stringify({ type: 'consumer_connected' }));
        }

        ws.on('message', (message) => {
            const hs = handshakes.get(id);

            try {
                const parsed = JSON.parse(message);
                if (parsed.type === 'hs_step2') {
                    console.log(`[Relay] Handshake ${id}: Step 2 (Consumer -> Provider)`);
                    hs.step = 2;
                }
            } catch (e) {
                // Ignore
            }

            // Forward from consumer to provider
            const providerWs = providers.get(id);
            if (providerWs && providerWs.readyState === 1) {
                providerWs.send(message);
            }
        });

        ws.on('close', () => {
            if (consumers.get(id) === ws) {
                consumers.delete(id);
                console.log(`Consumer ${id} disconnected`);
            }
        });
    } else {
        ws.close(1008, 'Invalid type');
    }
});

console.log(`Relay server Alpha running on PORT ${PORT}`);
