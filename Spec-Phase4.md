# OpenClaw Global Relay: Phase 4 - Remote Execution & Multi-Session

The goal of Phase 4 is to transform the Dashboard from a passive viewer into an active controller that can spawn and manage multiple OpenClaw sessions remotely.

## 4.1 Architecture: Session Dispatcher
We need a way for the Cockpit to request not just a "command," but a specific *runtime context*.

- **Protocol Change:** Requests from Cockpit will now include a `sessionId`.
- **Bridge Logic:** The Bridge will maintain a map of active OpenClaw child processes or sub-agents.
- **Persistence:** Metadata about active sessions (title, last active) will be stored in the Azure Relay metadata for the Cockpit to resume later.

## 4.2 Bridge Integration: The "OpenClaw Connector"
The Bridge needs to talk to the local OpenClaw CLI.
- **Runtime:** Bridge will use `child_process.spawn` to run `openclaw chat --json` or similar commands.
- **Streaming:** Standard output from the OpenClaw session will be piped back through the E2EE tunnel in real-time.
- **Signal Handling:** Support for terminating sessions (SIGINT) remotely from the dashboard.

## 4.3 Dashboard: Multi-Thread UI
- **Thread Sidebar:** A real list of active/past sessions fetched from the Relay.
- **"New Session" Button:** Triggers a fresh OpenClaw instance on the home server.
- **Session Switching:** Seamlessly swapping between the "Main Session" and a specific task-bound sub-agent (e.g., a "Coding" thread).

## Task List
- [ ] **Task 4.1:** Update Bridge to handle `spawn_session` and `send_input` actions.
- [ ] **Task 4.2:** Implement "Session Metadata" storage in the Relay/Blob layer.
- [ ] **Task 4.3:** Refactor Dashboard `threads` state to sync with the Bridge via E2EE.
- [ ] **Task 4.4:** Enable "Live Streaming" of AI responses to the Dashboard (chunk-by-chunk).

## Security Note
Remote command execution is the most powerful feature yet. We will ensure:
1.  **Identity Lock:** Only the browser session that performed the handshake can send execution commands.
2.  **Audit Log:** Every remote command is logged locally on the NucBox for transparency.
