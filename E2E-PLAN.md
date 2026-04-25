# E2E Test Strategy: OpenClaw Relay Dashboard

## 1. Objectives
- Verify the **Handshake**: Confirm Dashboard and Bridge establish a secure E2EE tunnel.
- Verify **Session Loading**: Sidebar should populate with real thread names from `titles.json`.
- Verify **Command Dispatch**: Typing a command and clicking 'Send' must trigger an encrypted websocket message.
- Verify **Command Execution**: Bridge must receive the command and return a response.

## 2. Testing Framework
- **Tool:** Playwright (already installed in `dashboard/`).
- **Environment:** Local `npm run dev` for the frontend + Local `node bridge/bridge.js` for the backend.
- **Mocking Strategy:** 
  - *Option A (Pure Frontend):* Mock the WebSocket connection to simulate Bridge responses.
  - *Option B (Full Integration):* Use a 'Test Identity' in a local bridge instance to verify the real Noise_XX handshake.

## 3. Implementation Plan
### Phase 1: Reliable Test Runner
- Fix the `playwright.config.js` to ensure it doesn't time out waiting for the WebServer on the NucBox.
- Add a `test:e2e` script to `package.json`.

### Phase 2: Mocking the Relay/Bridge
Since the Relay is an external Azure service, we will create a **Mock Relay Helper** for tests that:
1. Simulates the `hs_step1`, `hs_step2`, `hs_step3` flow.
2. Responds to `list_sessions` with static test data.
3. Echoes back `send_command` payloads to verify the encryption/decryption chain.

### Phase 3: Scenario Coverage
- `handshake.spec.js`: Verifies the status indicator turns green (Emerald).
- `sidebar.spec.js`: Verifies threads appear and are selectable.
- `chat.spec.js`: Verifies the input/button lifecycle.

### Phase 4: UI & Accessibility (Visual Verification)
- **Responsive Layout:** Verify the sidebar collapses correctly on mobile viewports.
- **Visual Regression:** Use Playwright's `toHaveScreenshot()` to ensure the indigo/slate theme doesn't break during updates.
- **Interactive State:** Verify button hover states, disabled states (when disconnected), and loading animations (shimmer/spinners).
- **Console Audit:** Ensure no React hydration errors or unhandled exceptions appear in the UI console during interaction.

## 4. Success Criteria
A test run must pass `npx playwright test` locally with the following console output verified:
- `[Dashboard] E2EE Tunnel ready`
- `[Dashboard] Dispatch complete.`
