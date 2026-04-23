# PROD.md

## Production Relay Status
- **Relay URL:** `wss://ca-relay-uogm7gtzixdzo.ashyocean-9489ea26.ukwest.azurecontainerapps.io`
- **Region:** `ukwest`
- **GitHub:** `https://github.com/danbryant201/openclaw-relay.git`

## Architecture Overview
The OpenClaw Global Relay acts as a signaling and E2EE bridge between your browser (Cockpit) and your local OpenClaw gateway (Bridge).

### 1. Security (E2EE)
- **Handshake:** Noise_XX (Diffie-Hellman Ephemeral)
- **Encryption:** AES-256-GCM
- **Identity:** Ed25519 signatures
- **Trust:** The Relay never sees plaintext; it only routes opaque encrypted blobs.

### 2. Components
- **Bridge:** Runs locally on your machine (NucBox/Pi). Initiates an outbound WebSocket to the Relay.
- **Cockpit (Dashboard):** Next.js PWA. Connects to Relay and performs handshake with the Bridge.
- **Relay:** Node.js server on Azure Container Apps. Manages stateless signaling and Azure Blob storage for metadata.

## Management Commands

### Deploy Infrastructure (Azure)
```bash
az deployment group create --resource-group rg-openclaw --template-file infra/main.bicep
```

### Build & Push Container
```bash
az acr build --registry acropenclaw --image relay:latest ./relay
```

### Run Local Bridge
```bash
cd bridge
export RELAY_URL=wss://...
node bridge.js
```

## Maintenance Logs
- **2026-04-23:** Completed Phase 3 (The Cockpit). Implemented live Memory Editor, real-time Logs, and automated Pairing UI.
- **2026-04-23:** Stateless storage integrated via Azure Blob Storage.
