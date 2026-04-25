import { test, expect } from '@playwright/test';

test.describe('Dashboard Command Lifecycle', () => {
  test('should send "hello" and receive an AI response within 30 seconds', async ({ page }) => {
    // 1. Setup: Navigate to the dashboard
    await page.goto('/dashboard');

    // 2. Wait for the connection to be established
    // We look for the "Bridge Active" text or the emerald status dot
    await expect(page.getByText('Bridge Active')).toBeVisible({ timeout: 20000 });

    const input = page.locator('input[placeholder="Send command..."]');
    const sendButton = page.locator('button[type="submit"]');

    // 3. Action: Type "hello"
    await input.fill('hello');
    
    // 4. Action: Click Send
    // We use a short wait to ensure React state has updated
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // 5. Verify: Message appears in the chat history as a user message
    await expect(page.locator('div').filter({ hasText: /^hello$/ })).toBeVisible();

    // 6. Verify: Receive AI response within 30 seconds
    // We look for any message with role 'ai' (styled with bg-slate-900) 
    // that appears after our user message.
    const aiResponse = page.locator('.bg-slate-900').last();
    await expect(aiResponse).toBeVisible({ timeout: 30000 });
    
    // Log the response for the test report
    const responseText = await aiResponse.innerText();
    console.log(`[E2E] Received response: ${responseText}`);
  });
});
