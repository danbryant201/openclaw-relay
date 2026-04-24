import { test, expect } from '@playwright/test';

test.describe('Dashboard Chat E2E', () => {
  test('component should render and handle input', async ({ page }) => {
    // 1. Visit the app
    await page.goto('http://localhost:3000');
    
    // 2. Wait for loading to finish (indicated by 'OpenClaw' text)
    await expect(page.getByText('OpenClaw', { exact: true })).toBeVisible({ timeout: 15000 });

    const input = page.locator('input[placeholder="Send command..."]');
    const sendButton = page.locator('button[type="submit"]');

    // 3. Check if input exists
    await expect(input).toBeVisible();

    // 4. Type a command
    await input.fill('test command');

    // 5. Check send button
    // In CI/Test without a bridge, it might be disabled. 
    // We want to verify it's at least there.
    await expect(sendButton).toBeVisible();
    
    // 6. Force click if needed or just check value
    await expect(input).toHaveValue('test command');
  });
});
