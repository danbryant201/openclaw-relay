# OpenClaw Relay Bridge (Alpha)

The Bridge is a local client that maintains a persistent outbound connection to the OpenClaw Relay. It allows the Relay to communicate with local resources behind NAT/firewalls.

## Features

- **Persistent Connection:** Automatically establishes an outbound WebSocket connection.
- **Auto-Reconnect:** If the connection drops, it will attempt to reconnect every 5 seconds.
- **Bi-directional Pipe:** Ready to receive commands from the relay and send responses back.

## Setup

1. Ensure you have Node.js installed.
2. Navigate to this directory: `cd bridge`
3. Install dependencies: `npm install`

## Configuration

You can configure the relay URL via environment variables:

- `RELAY_URL`: The WebSocket URL of the relay (default: `ws://localhost:8080?type=provider&id=dan-nucbox`)

## Usage

Start the bridge:

```bash
node bridge.js
```

## Alpha Testing

For testing purposes, the bridge is currently configured to:
1. Log all incoming messages from the relay.
2. Send a "pong" response back to the relay immediately to verify bi-directional communication.
