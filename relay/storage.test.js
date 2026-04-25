'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { FileStorageProvider } = require('./storage.js');

describe('FileStorageProvider', () => {
    let tmpDir;
    let storage;

    before(async () => {
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-storage-test-'));
        storage = new FileStorageProvider(tmpDir);
    });

    after(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('getMetadata returns null for unknown id', async () => {
        const result = await storage.getMetadata('nonexistent-id');
        assert.strictEqual(result, null);
    });

    it('setMetadata then getMetadata roundtrips correctly', async () => {
        const metadata = { gatewayPublicKey: 'abc123def456', registeredAt: '2024-01-01T00:00:00.000Z' };
        await storage.setMetadata('gw-roundtrip', metadata);
        const result = await storage.getMetadata('gw-roundtrip');
        assert.deepStrictEqual(result, metadata);
    });

    it('overwriting metadata replaces the previous value', async () => {
        await storage.setMetadata('gw-overwrite', { version: 1 });
        await storage.setMetadata('gw-overwrite', { version: 2 });
        const result = await storage.getMetadata('gw-overwrite');
        assert.strictEqual(result.version, 2);
    });

    it('different ids are stored independently', async () => {
        await storage.setMetadata('gw-alpha', { name: 'alpha' });
        await storage.setMetadata('gw-beta', { name: 'beta' });
        const a = await storage.getMetadata('gw-alpha');
        const b = await storage.getMetadata('gw-beta');
        assert.strictEqual(a.name, 'alpha');
        assert.strictEqual(b.name, 'beta');
    });

    it('creates the storage directory if it does not exist', async () => {
        const nestedPath = path.join(tmpDir, 'nested', 'subdir');
        const nestedStorage = new FileStorageProvider(nestedPath);
        await nestedStorage.setMetadata('test-id', { ok: true });
        const result = await nestedStorage.getMetadata('test-id');
        assert.deepStrictEqual(result, { ok: true });
    });

    it('preserves all metadata fields including nested objects', async () => {
        const metadata = {
            gatewayPublicKey: 'deadbeef',
            registeredAt: '2024-06-01T00:00:00.000Z',
            nested: { a: 1, b: [2, 3] }
        };
        await storage.setMetadata('gw-complex', metadata);
        const result = await storage.getMetadata('gw-complex');
        assert.deepStrictEqual(result, metadata);
    });
});
