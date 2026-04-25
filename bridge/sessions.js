'use strict';

const fs = require('fs');

function loadTitles(titlesPath) {
    if (!fs.existsSync(titlesPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(titlesPath, 'utf8'));
    } catch (e) {
        return {};
    }
}

function loadSessions(sessionsPath, titlesPath) {
    if (!fs.existsSync(sessionsPath)) return [];
    try {
        const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
        const titles = loadTitles(titlesPath);

        return Object.entries(data).map(([threadId, meta]) => ({
            threadId,
            sessionId: meta.sessionId,
            updatedAt: meta.updatedAt,
            origin: meta.origin,
            title: titles[meta.sessionId] || meta.sessionId.substring(0, 8)
        }));
    } catch (e) {
        return [];
    }
}

function lookupSessionId(sessionsPath, threadId) {
    if (!fs.existsSync(sessionsPath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(sessionsPath, 'utf8'));
        return data[threadId]?.sessionId || null;
    } catch (e) {
        return null;
    }
}

module.exports = { loadTitles, loadSessions, lookupSessionId };
