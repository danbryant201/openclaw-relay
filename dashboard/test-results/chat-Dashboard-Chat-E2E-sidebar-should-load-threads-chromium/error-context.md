# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: chat.spec.js >> Dashboard Chat E2E >> sidebar should load threads
- Location: tests\chat.spec.js:36:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('nav').locator('button').first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('nav').locator('button').first()

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - heading "404" [level=1] [ref=e4]
    - heading "This page could not be found." [level=2] [ref=e6]
  - button "Open Next.js Dev Tools" [ref=e12] [cursor=pointer]:
    - img [ref=e13]
  - alert [ref=e16]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Dashboard Chat E2E', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // Navigate to the local dev server
  6  |     await page.goto('http://localhost:3000');
  7  |   });
  8  | 
  9  |   test('should allow typing and clicking send', async ({ page }) => {
  10 |     const input = page.locator('input[placeholder="Send command..."]');
  11 |     const sendButton = page.locator('button[type="submit"]');
  12 | 
  13 |     // 1. Check if input exists
  14 |     await expect(input).toBeVisible();
  15 | 
  16 |     // 2. Type a command
  17 |     await input.fill('test command');
  18 | 
  19 |     // 3. Verify send button is enabled (assuming relay connects or mock state)
  20 |     // Note: If the button is disabled because 'status !== connected', 
  21 |     // we need to mock the websocket or wait for local bridge.
  22 |     // For this test, we'll check the DOM state.
  23 |     const isDisabled = await sendButton.getAttribute('disabled');
  24 |     
  25 |     if (isDisabled === null) {
  26 |       await sendButton.click();
  27 |       // Verify input is cleared
  28 |       await expect(input).toHaveValue('');
  29 |       // Verify message appears in UI
  30 |       await expect(page.locator('text=test command')).toBeVisible();
  31 |     } else {
  32 |       console.log('Send button is disabled - waiting for connection?');
  33 |     }
  34 |   });
  35 | 
  36 |   test('sidebar should load threads', async ({ page }) => {
  37 |     // Wait for the sidebar to contain at least one thread button
  38 |     // This assumes the bridge is running locally or mocked
  39 |     const threads = page.locator('nav >> button');
> 40 |     await expect(threads.first()).toBeVisible();
     |                                   ^ Error: expect(locator).toBeVisible() failed
  41 |   });
  42 | });
  43 | 
```