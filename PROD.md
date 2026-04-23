# OpenClaw Relay: Production Management

Your Relay is now live in Azure!

## Infrastructure Details
- **Resource Group:** `OpenClawRelay`
- **Location:** `ukwest`
- **Relay URL (WebSocket):** `wss://ca-relay-uogm7gtzixdzo.ashyocean-9489ea26.ukwest.azurecontainerapps.io`
- **Storage Account:** `strelayuogm7gtzixdzo` (Used for gateway metadata/keys)
- **Container Registry:** `ocrelayreg.azurecr.io`

## How to Update the Relay
If you make changes to the code in `/relay` or `/shared`:

1.  **Build and Push the new image:**
    ```powershell
    # Run from the root of the openclaw-relay repo
    az acr build --registry ocrelayreg --image relay:latest --file Dockerfile.relay .
    ```
2.  **Restart the Container App:**
    The app will automatically pull the new `latest` image on its next restart, or you can force it:
    ```powershell
    az containerapp revision restart --resource-group OpenClawRelay --name ca-relay-uogm7gtzixdzo --revision $(az containerapp revision list --resource-group OpenClawRelay --name ca-relay-uogm7gtzixdzo --query "[0].name" -o tsv)
    ```

## Monitoring
- **View Logs:**
  ```powershell
  az containerapp logs show --resource-group OpenClawRelay --name ca-relay-uogm7gtzixdzo --follow
  ```
- **Check Status:**
  ```powershell
  az containerapp show --resource-group OpenClawRelay --name ca-relay-uogm7gtzixdzo --query properties.provisioningState
  ```

## Cleanup (Caution!)
To delete the entire cloud environment:
```powershell
az group delete --name OpenClawRelay --yes
```
