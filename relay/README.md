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

## Docker

You can build and run the relay server using Docker.

### Building the Image

From the repository root (not the `relay/` directory), run:

```bash
docker build -t openclaw-relay -f relay/Dockerfile .
```

### Running the Container

```bash
docker run -p 8080:8080 openclaw-relay
```

To run it in the background:

```bash
docker run -d -p 8080:8080 --name relay openclaw-relay
```

The relay will then be available at `ws://localhost:8080`.

