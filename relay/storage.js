const fs = require('fs/promises');
const path = require('path');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

/**
 * Abstract StorageProvider interface
 */
class StorageProvider {
  async getMetadata(id) { throw new Error('Not implemented'); }
  async setMetadata(id, metadata) { throw new Error('Not implemented'); }
}

/**
 * Local File Storage Provider for development
 */
class FileStorageProvider extends StorageProvider {
  constructor(basePath = './storage') {
    super();
    this.basePath = path.resolve(basePath);
  }

  async _ensureDir() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }

  async getMetadata(id) {
    await this._ensureDir();
    const filePath = path.join(this.basePath, `${id}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      if (e.code === 'ENOENT') return null;
      throw e;
    }
  }

  async setMetadata(id, metadata) {
    await this._ensureDir();
    const filePath = path.join(this.basePath, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf8');
  }
}

/**
 * Azure Blob Storage Provider
 * Uses Managed Identity for Zero-Credentials Auth
 */
class AzureBlobStorageProvider extends StorageProvider {
  constructor(accountName, containerName = 'metadata') {
    super();
    this.accountName = accountName;
    this.containerName = containerName;
    
    const blobServiceUrl = `https://${accountName}.blob.core.windows.net`;
    const credential = new DefaultAzureCredential();
    
    this.blobServiceClient = new BlobServiceClient(blobServiceUrl, credential);
    this.containerClient = this.blobServiceClient.getContainerClient(containerName);
  }

  async getMetadata(id) {
    const blobName = `${id}.json`;
    const blobClient = this.containerClient.getBlobClient(blobName);
    
    try {
      const downloadResponse = await blobClient.download();
      const downloaded = await this.streamToBuffer(downloadResponse.readableStreamBody);
      return JSON.parse(downloaded.toString());
    } catch (e) {
      if (e.details?.errorCode === 'BlobNotFound') return null;
      console.error(`[AzureStorage] Error fetching ${id}:`, e.message);
      return null;
    }
  }

  async setMetadata(id, metadata) {
    const blobName = `${id}.json`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    const data = JSON.stringify(metadata, null, 2);
    
    try {
      await blockBlobClient.upload(data, data.length);
      console.log(`[AzureStorage] Saved metadata for ${id}.`);
    } catch (e) {
      console.error(`[AzureStorage] Error saving ${id}:`, e.message);
    }
  }

  async streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on('data', (data) => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
      readableStream.on('end', () => resolve(Buffer.concat(chunks)));
      readableStream.on('error', reject);
    });
  }
}

module.exports = {
  StorageProvider,
  FileStorageProvider,
  AzureBlobStorageProvider
};
