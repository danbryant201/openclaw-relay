const { WebSocketServer } = require('ws');
const url = require('url');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Maps to keep track of connections
// Key: connection ID (e.g., pairing code or device ID)
const providers = new Map(); // id -> socket
const consumers = new Map();  // id -> socket

wss.on('connection', (ws, req) => {
    const parameters = url.parse(req.url, true).query;
    const { type, id } = parameters;

    if (!type || !id) {
        console.log('Missing type or id in URL');
        ws.close(1008, 'Missing type or id');
        return;
    }

    console.log(`New connection: type=${type}, id=${id}`);

    if (type === 'provider') {
        // A provider (Gateway) is connecting
        providers.set(id, ws);
        
        ws.on('message', (message) => {
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

        ws.on('message', (message) => {
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

console.log(`Relay server Alpha running on ws://localhost:${PORT}`);
