const fs = require('fs/promises');
const path = require('path');

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
 * Azure Blob Storage Provider (Skeleton)
 */
class AzureBlobStorageProvider extends StorageProvider {
  constructor(connectionString, containerName = 'openclaw-relay') {
    super();
    // Implementation placeholder for @azure/storage-blob
    console.warn('[Relay] AzureBlobStorageProvider is a skeleton. Requires @azure/storage-blob and @azure/identity.');
    this.connectionString = connectionString;
    this.containerName = containerName;
  }

  async getMetadata(id) {
    // TODO: Implement BlobClient.downloadToBuffer() logic
    console.log(`[AzureStorage] Fetching metadata for ${id}...`);
    return null; 
  }

  async setMetadata(id, metadata) {
    // TODO: Implement BlockBlobClient.upload() logic
    console.log(`[AzureStorage] Saving metadata for ${id}...`);
  }
}

module.exports = {
  StorageProvider,
  FileStorageProvider,
  AzureBlobStorageProvider
};
