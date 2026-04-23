# Deploy OpenClaw Relay to Azure

This script automates the build and deployment of the relay service to Azure Container Apps.

```powershell
# 1. Configuration
$RG = "OpenClawRelay"
$LOC = "ukwest"
$ACR_NAME = "ocrelayreg" # Must be globally unique
$IMAGE_TAG = "relay:latest"

# 2. Register Providers (if not done)
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.App

# 3. Create ACR
az acr create --resource-group $RG --name $ACR_NAME --sku Basic --admin-enabled true

# 4. Build and Push (using ACR Tasks - no local docker needed)
cd C:\Users\Admin\.openclaw\workspace\openclaw-relay\relay
az acr build --registry $ACR_NAME --image $IMAGE_TAG .

# 5. Deploy Infrastructure (Updates image to the one we just pushed)
$ACR_LOGIN_SERVER = "$(az acr show --name $ACR_NAME --query loginServer -o tsv)"
$IMAGE_FULL = "$ACR_LOGIN_SERVER/$IMAGE_TAG"

az deployment group create `
  --resource-group $RG `
  --template-file C:\Users\Admin\.openclaw\workspace\openclaw-relay\infra\main.bicep `
  --parameters containerImage=$IMAGE_FULL
```
