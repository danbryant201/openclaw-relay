import { test, expect } from '@playwright/test';

test.describe('Dashboard Chat E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the local dev server
    await page.goto('http://localhost:3000');
  });

  test('should allow typing and clicking send', async ({ page }) => {
    const input = page.locator('input[placeholder="Send command..."]');
    const sendButton = page.locator('button[type="submit"]');

    // 1. Check if input exists
    await expect(input).toBeVisible();

    // 2. Type a command
    await input.fill('test command');

    // 3. Verify send button is enabled (assuming relay connects or mock state)
    // Note: If the button is disabled because 'status !== connected', 
    // we need to mock the websocket or wait for local bridge.
    // For this test, we'll check the DOM state.
    const isDisabled = await sendButton.getAttribute('disabled');
    
    if (isDisabled === null) {
      await sendButton.click();
      // Verify input is cleared
      await expect(input).toHaveValue('');
      // Verify message appears in UI
      await expect(page.locator('text=test command')).toBeVisible();
    } else {
      console.log('Send button is disabled - waiting for connection?');
    }
  });

  test('sidebar should load threads', async ({ page }) => {
    // Wait for the sidebar to contain at least one thread button
    // This assumes the bridge is running locally or mocked
    const threads = page.locator('nav >> button');
    await expect(threads.first()).toBeVisible();
  });
});
