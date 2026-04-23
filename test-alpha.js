const WebSocket = require('./relay/node_modules/ws');

/**
 * OpenClaw Relay Test CLI
 * 
 * Usage:
 * 1. Start Relay: node relay/index.js
 * 2. Run this test: node test-alpha.js
 */

async function runTest() {
    console.log('--- OpenClaw Global Relay: Alpha Test ---');
    
    // 1. Consumer initiates pairing
    const consumerWs = new WebSocket('ws://localhost:8080?type=consumer&action=init_pairing&id=dan-web');
    
    consumerWs.on('open', () => console.log('[Consumer] Connected to Relay.'));
    
    consumerWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        console.log('[Consumer] Received:', msg.type);

        if (msg.type === 'pairing_initiated') {
            console.log(`[Test] PAIRING CODE GENERATED: ${msg.pairingCode}`);
            
            // 2. Start Provider (Bridge) in pairing mode
            const code = msg.pairingCode.replace(' ', '');
            const bridgeWs = new WebSocket(`ws://localhost:8080?type=provider&id=${code}&action=join_pairing`);
            
            bridgeWs.on('open', () => console.log('[Bridge] Connected for pairing...'));
            
            bridgeWs.on('message', (bData) => {
                const bMsg = JSON.parse(bData.toString());
                console.log('[Bridge] Received:', bMsg.type);

                if (bMsg.type === 'pairing_joined') {
                    console.log(`[Test] SUCCESS! Gateway joined tunnel: ${bMsg.pairingId}`);
                    
                    // Cleanup
                    console.log('[Test] Alpha Test Successful. Closing connections...');
                    bridgeWs.close();
                    consumerWs.close();
                    process.exit(0);
                }
            });
        }
    });

    // Timeout if test takes too long
    setTimeout(() => {
        console.error('[Test] FAIL: Test timed out after 10s.');
        process.exit(1);
    }, 10000);
}

runTest();
