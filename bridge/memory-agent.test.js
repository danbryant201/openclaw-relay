'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const MemoryAgent = require('./memory-agent.js');

describe('MemoryAgent', () => {
    let workspaceDir;
    let agent;

    before(() => {
        workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-agent-'));
        agent = new MemoryAgent(null, workspaceDir);

        // Seed some files
        fs.writeFileSync(path.join(workspaceDir, 'README.md'), '# Test Workspace', 'utf8');
        fs.writeFileSync(path.join(workspaceDir, 'notes.md'), '## Notes', 'utf8');
        fs.mkdirSync(path.join(workspaceDir, 'subdir'));
        fs.writeFileSync(path.join(workspaceDir, 'subdir', 'child.md'), '# Child', 'utf8');
        fs.mkdirSync(path.join(workspaceDir, 'node_modules'));
        fs.writeFileSync(path.join(workspaceDir, 'node_modules', 'pkg.js'), '', 'utf8');
    });

    after(() => {
        fs.rmSync(workspaceDir, { recursive: true, force: true });
    });

    describe('getStructure', () => {
        it('returns only markdown files and directories at the top level', async () => {
            const tree = await agent.getStructure();
            const names = tree.map(n => n.name);
            assert.ok(names.includes('README.md'));
            assert.ok(names.includes('notes.md'));
            assert.ok(names.includes('subdir'));
        });

        it('excludes node_modules', async () => {
            const tree = await agent.getStructure();
            const names = tree.map(n => n.name);
            assert.ok(!names.includes('node_modules'));
        });

        it('includes markdown files in subdirectories', async () => {
            const tree = await agent.getStructure();
            const subdir = tree.find(n => n.name === 'subdir');
            assert.ok(subdir);
            assert.ok(subdir.children.some(c => c.name === 'child.md'));
        });
    });

    describe('readFile', () => {
        it('reads a file by relative path', async () => {
            const content = await agent.readFile('README.md');
            assert.strictEqual(content, '# Test Workspace');
        });

        it('reads a file in a subdirectory', async () => {
            const content = await agent.readFile('subdir/child.md');
            assert.strictEqual(content, '# Child');
        });

        it('throws on simple .. path traversal', async () => {
            await assert.rejects(
                () => agent.readFile('../secret.txt'),
                /Access denied/
            );
        });

        it('throws on sibling-directory bypass (startsWith vulnerability)', async () => {
            // A path like ../DIRNAME_evil/file would pass a naive startsWith check
            // because the resolved path starts with the workspace path as a prefix.
            const siblingName = path.basename(workspaceDir) + '_evil';
            const siblingDir = path.join(path.dirname(workspaceDir), siblingName);
            fs.mkdirSync(siblingDir, { recursive: true });
            fs.writeFileSync(path.join(siblingDir, 'secret.txt'), 'EXFILTRATED', 'utf8');
            try {
                await assert.rejects(
                    () => agent.readFile(`../${siblingName}/secret.txt`),
                    /Access denied/
                );
            } finally {
                fs.rmSync(siblingDir, { recursive: true, force: true });
            }
        });

        it('throws on absolute path', async () => {
            // Use a platform-appropriate absolute path
            const absPath = process.platform === 'win32' ? 'C:\\Windows\\evil.txt' : '/etc/passwd';
            await assert.rejects(
                () => agent.readFile(absPath),
                /Access denied/
            );
        });
    });

    describe('writeFile', () => {
        it('creates a new file', async () => {
            await agent.writeFile('new-file.md', '# New');
            const content = fs.readFileSync(path.join(workspaceDir, 'new-file.md'), 'utf8');
            assert.strictEqual(content, '# New');
        });

        it('overwrites an existing file', async () => {
            await agent.writeFile('README.md', '# Updated');
            const content = fs.readFileSync(path.join(workspaceDir, 'README.md'), 'utf8');
            assert.strictEqual(content, '# Updated');
        });

        it('throws on .. path traversal', async () => {
            await assert.rejects(
                () => agent.writeFile('../outside.txt', 'evil'),
                /Access denied/
            );
        });

        it('throws on sibling-directory bypass', async () => {
            const siblingName = path.basename(workspaceDir) + '_write_evil';
            const siblingDir = path.join(path.dirname(workspaceDir), siblingName);
            fs.mkdirSync(siblingDir, { recursive: true });
            try {
                await assert.rejects(
                    () => agent.writeFile(`../${siblingName}/pwned.txt`, 'evil'),
                    /Access denied/
                );
            } finally {
                fs.rmSync(siblingDir, { recursive: true, force: true });
            }
        });
    });

    describe('handleRequest', () => {
        it('routes get_structure to getStructure', async () => {
            const result = await agent.handleRequest({ action: 'get_structure' });
            assert.strictEqual(result.type, 'memory_structure');
            assert.ok(Array.isArray(result.data));
        });

        it('routes read_file to readFile', async () => {
            await agent.writeFile('handle-test.md', '# Handle');
            const result = await agent.handleRequest({ action: 'read_file', path: 'handle-test.md' });
            assert.strictEqual(result.type, 'memory_content');
            assert.strictEqual(result.content, '# Handle');
            assert.strictEqual(result.path, 'handle-test.md');
        });

        it('routes write_file to writeFile', async () => {
            const result = await agent.handleRequest({ action: 'write_file', path: 'written.md', content: '# Written' });
            assert.strictEqual(result.type, 'memory_write_success');
            assert.strictEqual(result.path, 'written.md');
            const content = fs.readFileSync(path.join(workspaceDir, 'written.md'), 'utf8');
            assert.strictEqual(content, '# Written');
        });

        it('throws on unknown action', async () => {
            await assert.rejects(
                () => agent.handleRequest({ action: 'delete_everything' }),
                /Unknown memory action/
            );
        });
    });
});
