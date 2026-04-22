const WebSocket = require('ws');

/**
 * OpenClaw Relay Bridge (Alpha)
 * 
 * This script maintains a persistent outbound connection to the Relay.
 * It handles automatic reconnection and responds to messages for testing.
 */

const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:8080?type=provider&id=dan-nucbox';
const RECONNECT_INTERVAL = 5000;

let ws;
let reconnectTimer;

function connect() {
    console.log(`[Bridge] Connecting to relay at ${RELAY_URL}...`);
    
    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
        console.log('[Bridge] Connected to relay.');
        if (reconnectTimer) {
            clearInterval(reconnectTimer);
            reconnectTimer = null;
        }
    });

    ws.on('message', (data) => {
        const message = data.toString();
        console.log(`[Bridge] Received: ${message}`);

        // Alpha testing: respond with a pong/mock response
        try {
            const parsed = JSON.parse(message);
            const response = {
                type: 'pong',
                original: parsed,
                timestamp: new Date().toISOString(),
                status: 'alive'
            };
            ws.send(JSON.stringify(response));
            console.log('[Bridge] Sent pong response.');
        } catch (e) {
            // If not JSON, just send a plain text pong
            ws.send(`pong: ${message}`);
            console.log('[Bridge] Sent plain text pong.');
        }
    });

    ws.on('close', () => {
        console.log('[Bridge] Connection closed.');
        scheduleReconnect();
    });

    ws.on('error', (err) => {
        console.error(`[Bridge] WebSocket error: ${err.message}`);
        // 'close' event will trigger reconnect
    });
}

function scheduleReconnect() {
    if (!reconnectTimer) {
        console.log(`[Bridge] Scheduling reconnect in ${RECONNECT_INTERVAL / 1000}s...`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, RECONNECT_INTERVAL);
    }
}

// Start the bridge
connect();

// Handle process termination
process.on('SIGINT', () => {
    console.log('[Bridge] Shutting down...');
    if (ws) ws.close();
    process.exit();
});
