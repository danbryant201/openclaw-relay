'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { loadTitles, loadSessions } = require('./sessions.js');

describe('loadTitles', () => {
    it('returns empty object when file does not exist', () => {
        const result = loadTitles('/nonexistent/path/titles.json');
        assert.deepStrictEqual(result, {});
    });

    it('returns parsed object from a valid file', () => {
        const tmpFile = path.join(os.tmpdir(), `titles-${Date.now()}.json`);
        const data = { 'session-abc': 'My Test Session', 'session-xyz': 'Another Session' };
        fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf8');
        try {
            assert.deepStrictEqual(loadTitles(tmpFile), data);
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });

    it('returns empty object for a corrupt/invalid JSON file', () => {
        const tmpFile = path.join(os.tmpdir(), `titles-bad-${Date.now()}.json`);
        fs.writeFileSync(tmpFile, '{ this is not json }', 'utf8');
        try {
            assert.deepStrictEqual(loadTitles(tmpFile), {});
        } finally {
            fs.unlinkSync(tmpFile);
        }
    });
});

describe('loadSessions', () => {
    let tmpDir;

    before(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openclaw-sessions-'));
    });

    after(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns empty array when sessions file does not exist', () => {
        const result = loadSessions('/nonexistent/sessions.json', '/nonexistent/titles.json');
        assert.deepStrictEqual(result, []);
    });

    it('returns sessions with titles from titles file', () => {
        const sessionsPath = path.join(tmpDir, 'sessions.json');
        const titlesPath = path.join(tmpDir, 'titles.json');

        const sessionsData = {
            'thread-001': { sessionId: 'sess-abc', updatedAt: 1700000000, origin: 'local' },
            'thread-002': { sessionId: 'sess-xyz', updatedAt: 1700001000, origin: 'remote' }
        };
        const titlesData = { 'sess-abc': 'Alpha Session', 'sess-xyz': 'Beta Session' };

        fs.writeFileSync(sessionsPath, JSON.stringify(sessionsData), 'utf8');
        fs.writeFileSync(titlesPath, JSON.stringify(titlesData), 'utf8');

        const sessions = loadSessions(sessionsPath, titlesPath);
        assert.strictEqual(sessions.length, 2);

        const alpha = sessions.find(s => s.threadId === 'thread-001');
        assert.ok(alpha);
        assert.strictEqual(alpha.title, 'Alpha Session');
        assert.strictEqual(alpha.sessionId, 'sess-abc');
        assert.strictEqual(alpha.updatedAt, 1700000000);
        assert.strictEqual(alpha.origin, 'local');
    });

    it('falls back to first 8 chars of sessionId when title is missing', () => {
        const sessionsPath = path.join(tmpDir, 'sessions-notitle.json');
        const titlesPath = path.join(tmpDir, 'titles-empty.json');

        const sessionsData = {
            'thread-003': { sessionId: 'session-longid-here', updatedAt: 0, origin: 'local' }
        };
        fs.writeFileSync(sessionsPath, JSON.stringify(sessionsData), 'utf8');
        fs.writeFileSync(titlesPath, JSON.stringify({}), 'utf8');

        const sessions = loadSessions(sessionsPath, titlesPath);
        assert.strictEqual(sessions[0].title, 'session-');
    });

    it('works when titles file does not exist (falls back to sessionId prefix)', () => {
        const sessionsPath = path.join(tmpDir, 'sessions-notitlesfile.json');

        const sessionsData = {
            'thread-004': { sessionId: 'abcdefghijk', updatedAt: 0, origin: 'local' }
        };
        fs.writeFileSync(sessionsPath, JSON.stringify(sessionsData), 'utf8');

        const sessions = loadSessions(sessionsPath, '/nonexistent/titles.json');
        assert.strictEqual(sessions[0].title, 'abcdefgh');
    });

    it('returns empty array when sessions file contains invalid JSON', () => {
        const sessionsPath = path.join(tmpDir, 'sessions-bad.json');
        fs.writeFileSync(sessionsPath, '{ not valid json', 'utf8');
        const result = loadSessions(sessionsPath, '/nonexistent/titles.json');
        assert.deepStrictEqual(result, []);
    });
});
