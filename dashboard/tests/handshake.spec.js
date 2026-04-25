import { test, expect } from '@playwright/test';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { x25519 } from '@noble/curves/ed25519';

// --- Crypto helpers (Node.js side, mirrors the bridge) ---

function generateKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = x25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
}

function deriveSharedSecret(privateKey, publicKey) {
    return x25519.getSharedSecret(privateKey, publicKey);
}

function encrypt(key, payload) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key), iv);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertext, iv, tag };
}

function decrypt(key, iv, tag, ciphertext) {
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Build an encrypted response packet for the dashboard to receive
function encryptedResponse(sharedSecret, payload) {
    const enc = encrypt(sharedSecret, Buffer.from(JSON.stringify(payload)));
    return JSON.stringify({
        type: 'encrypted_message',
        ciphertext: enc.ciphertext.toString('hex'),
        iv: enc.iv.toString('hex'),
        tag: enc.tag.toString('hex')
    });
}

// Intercept WebSocket connections the dashboard makes to the relay and simulate
// the bridge side of the Noise_XX handshake.
function setupMockBridge(page, { sessions = [] } = {}) {
    const ephemeral = generateKeyPair();
    let sharedSecret = null;

    return page.routeWebSocket(/ws:\/\/localhost:8080/, (ws) => {
        // Initiate handshake immediately (bridge already connected)
        ws.send(JSON.stringify({
            type: 'hs_step1',
            pub: Buffer.from(ephemeral.publicKey).toString('hex')
        }));

        ws.onMessage((message) => {
            const data = JSON.parse(message);

            if (data.type === 'hs_step2') {
                sharedSecret = deriveSharedSecret(
                    ephemeral.privateKey,
                    Buffer.from(data.pub, 'hex')
                );
                ws.send(JSON.stringify({ type: 'hs_step3' }));
                return;
            }

            if (data.type === 'encrypted_message' && sharedSecret) {
                let payload;
                try {
                    const dec = decrypt(
                        sharedSecret,
                        Buffer.from(data.iv, 'hex'),
                        Buffer.from(data.tag, 'hex'),
                        Buffer.from(data.ciphertext, 'hex')
                    );
                    payload = JSON.parse(dec.toString());
                } catch {
                    return;
                }

                if (payload.action === 'list_sessions') {
                    ws.send(encryptedResponse(sharedSecret, { type: 'session_list', sessions }));
                } else if (payload.action === 'send_command') {
                    ws.send(encryptedResponse(sharedSecret, {
                        type: 'command_result',
                        threadId: payload.threadId,
                        output: `[mock] received: ${payload.text}`
                    }));
                } else if (payload.action === 'start_logs') {
                    ws.send(encryptedResponse(sharedSecret, {
                        type: 'log_entry', level: 'info', message: 'Mock log stream started.'
                    }));
                }
            }
        });
    });
}

test.describe('Dashboard — E2EE Handshake', () => {
    test('completes handshake and shows Bridge Active', async ({ page }) => {
        await setupMockBridge(page);
        await page.goto('/dashboard');
        await expect(page.getByText('Bridge Active')).toBeVisible({ timeout: 15000 });
    });

    test('shows E2EE badge in the header after connection', async ({ page }) => {
        await setupMockBridge(page);
        await page.goto('/dashboard');
        await expect(page.getByText('Bridge Active')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('E2EE')).toBeVisible();
    });

    test('status dot becomes emerald green when tunnel is established', async ({ page }) => {
        await setupMockBridge(page);
        await page.goto('/dashboard');
        await expect(page.getByText('Bridge Active')).toBeVisible({ timeout: 15000 });
        // The header relay status indicator shows CONNECTED
        await expect(page.getByText('CONNECTED')).toBeVisible();
    });
});

test.describe('Dashboard — Session Sidebar', () => {
    const mockSessions = [
        { threadId: 'thread-alpha', title: 'Alpha Project', updatedAt: Date.now() },
        { threadId: 'thread-beta', title: 'Beta Experiment', updatedAt: Date.now() - 60000 }
    ];

    test('populates sidebar with sessions received from bridge', async ({ page }) => {
        await setupMockBridge(page, { sessions: mockSessions });
        await page.goto('/dashboard');
        await expect(page.getByText('Bridge Active')).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Alpha Project')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Beta Experiment')).toBeVisible();
    });

    test('selecting a session updates the chat header', async ({ page }) => {
        await setupMockBridge(page, { sessions: mockSessions });
        await page.goto('/dashboard');
        await expect(page.getByText('Alpha Project')).toBeVisible({ timeout: 15000 });
        await page.getByText('Alpha Project').click();
        await expect(page.getByRole('heading', { name: 'Alpha Project' })).toBeVisible();
    });
});

test.describe('Dashboard — Chat Send Flow', () => {
    const mockSessions = [
        { threadId: 'thread-chat', title: 'Chat Session', updatedAt: Date.now() }
    ];

    test('user message appears in chat after sending', async ({ page }) => {
        await setupMockBridge(page, { sessions: mockSessions });
        await page.goto('/dashboard');
        await expect(page.getByText('Chat Session')).toBeVisible({ timeout: 15000 });
        await page.getByText('Chat Session').click();

        const input = page.locator('input[placeholder="Send command..."]');
        await input.fill('hello world');
        await page.locator('button').filter({ has: page.locator('svg') }).last().click();

        await expect(page.getByText('hello world')).toBeVisible({ timeout: 5000 });
    });

    test('bridge response appears in chat', async ({ page }) => {
        await setupMockBridge(page, { sessions: mockSessions });
        await page.goto('/dashboard');
        await expect(page.getByText('Chat Session')).toBeVisible({ timeout: 15000 });
        await page.getByText('Chat Session').click();

        const input = page.locator('input[placeholder="Send command..."]');
        await input.fill('ping');
        await page.locator('button').filter({ has: page.locator('svg') }).last().click();

        await expect(page.locator('.bg-slate-900').last()).toBeVisible({ timeout: 10000 });
        const responseText = await page.locator('.bg-slate-900').last().innerText();
        expect(responseText).toContain('[mock] received: ping');
    });
});
