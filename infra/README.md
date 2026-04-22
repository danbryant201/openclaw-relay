# Deploying the OpenClaw Global Relay Infrastructure

This directory contains the Bicep templates for deploying the OpenClaw Global Relay to Azure.

## Prerequisites

- Azure CLI installed
- Logged into your Azure account (`az login`)
- An existing Resource Group (or create one using the instructions below)

## Deployment Steps

### 1. Create a Resource Group (Optional)

If you don't have a resource group yet, create one:

```powershell
$resourceGroupName = "rg-openclaw-relay"
$location = "uksouth"
az group create --name $resourceGroupName --location $location
```

### 2. Deploy the Bicep Template

Run the following command to deploy the infrastructure:

```powershell
$resourceGroupName = "rg-openclaw-relay"
az deployment group create `
  --resource-group $resourceGroupName `
  --template-file main.bicep
```

## Resources Provisioned

- **Azure Container Apps Environment**: Consumption plan for hosting the relay.
- **Azure Container App**: The relay service (currently using a placeholder image).
- **Azure Storage Account**: Used for storing relay metadata.
- **User Assigned Managed Identity**: Used by the Container App to securely access the Storage Account without secrets.
- **Role Assignment**: Grants 'Storage Blob Data Contributor' permissions to the managed identity on the storage account.

## Environment Variables

The Container App is pre-configured with the following environment variables:
- `PORT`: 8080
- `STORAGE_ACCOUNT_NAME`: Automatically resolved name of the provisioned storage account.
- `BLOB_CONTAINER_NAME`: 'metadata'
- `AZURE_CLIENT_ID`: The client ID of the User Assigned Identity.
