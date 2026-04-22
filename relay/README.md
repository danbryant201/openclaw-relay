# OpenClaw Relay Server (Alpha)

This is a simple WebSocket relay server to facilitate communication between a local OpenClaw Gateway and a remote Consumer (e.g., mobile app) when a direct connection is not possible.

## How it works

The relay routes messages based on an `id` and a `type` provided in the connection URL.

- **Provider**: The local Gateway. Connects via `ws://<relay-host>/?type=provider&id=<unique-id>`
- **Consumer**: The client app. Connects via `ws://<relay-host>/?type=consumer&id=<unique-id>`

The server matches the `id` and forwards messages bi-directionally between the connected provider and consumer for that ID.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the server:
   ```bash
   node index.js
   ```

Default port is 8080. You can set the `PORT` environment variable to override it.
