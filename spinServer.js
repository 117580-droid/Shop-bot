/**
 * spinServer.js — Lightweight HTTP + WebSocket server for live lottery wheel views.
 *
 * Each spin gets a unique spinId. Clients connect to:
 *   GET  /spin/:spinId          → serves the live wheel HTML page
 *   WS   /spin/:spinId/ws       → real-time event stream for that spin
 *
 * The bot calls the exported API to create sessions and push events:
 *   spinServer.createSession(spinId, participants)
 *   spinServer.pushEvent(spinId, eventObj)
 *   spinServer.closeSession(spinId)          // called ~5 min after spin ends
 */

'use strict';

const http      = require('http');
const fs        = require('fs');
const path      = require('path');
const { WebSocketServer } = require('ws');
const { URL }   = require('url');

// ─── Config ───────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.SPIN_PORT ?? '3000', 10);

// PUBLIC_URL is the externally reachable base URL of this service, e.g.
// "https://my-bot.up.railway.app". If not set we fall back to a localhost URL
// so the feature still works in local dev.
const PUBLIC_URL = (process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL ?? `http://localhost:${PORT}`
).replace(/\/$/, '');

// ─── In-memory session store ──────────────────────────────────────────────────
// spinId → { participants, events, sockets: Set<WebSocket>, timer }
const sessions = new Map();

// ─── HTML template ────────────────────────────────────────────────────────────
const HTML_PATH = path.join(__dirname, 'spinwheel.html');

function getHtml() {
  try {
    return fs.readFileSync(HTML_PATH, 'utf8');
  } catch {
    return '<h1>Spin page not found</h1>';
  }
}

// ─── HTTP server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://localhost`);
  const pathname = reqUrl.pathname;

  // Health check
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // Serve spin page: GET /spin/:spinId
  const pageMatch = pathname.match(/^\/spin\/([^/]+)$/);
  if (pageMatch) {
    const spinId = decodeURIComponent(pageMatch[1]);
    if (!sessions.has(spinId)) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 — Spin not found or has expired</h1>');
      return;
    }
    const html = getHtml();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

// ─── WebSocket server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const reqUrl = new URL(req.url, `http://localhost`);
  const wsMatch = reqUrl.pathname.match(/^\/spin\/([^/]+)\/ws$/);

  if (!wsMatch) {
    ws.close(1008, 'Invalid path');
    return;
  }

  const spinId = decodeURIComponent(wsMatch[1]);
  const session = sessions.get(spinId);

  if (!session) {
    // Send a "not found" event then close
    ws.send(JSON.stringify({ type: 'error', message: 'Spin not found or has expired' }));
    ws.close(1008, 'Spin not found');
    return;
  }

  // Register this socket
  session.sockets.add(ws);

  // Replay all past events so late-joiners catch up immediately
  for (const evt of session.events) {
    try { ws.send(JSON.stringify(evt)); } catch { /* ignore */ }
  }

  ws.on('close', () => {
    session.sockets.delete(ws);
  });

  ws.on('error', () => {
    session.sockets.delete(ws);
  });
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create a new spin session.
 * @param {string} spinId - Unique identifier for this spin.
 * @param {Array<{userId: string, username: string, tickets: number}>} participants
 * @returns {string} The public URL for this spin's live page.
 */
function createSession(spinId, participants) {
  const initEvent = {
    type: 'init',
    spinId,
    participants,
    startedAt: Date.now(),
  };

  sessions.set(spinId, {
    participants,
    events: [initEvent],
    sockets: new Set(),
    timer: null,
  });

  return `${PUBLIC_URL}/spin/${encodeURIComponent(spinId)}`;
}

/**
 * Push a real-time event to all connected clients for this spin.
 * The event is also stored so late-joiners can replay it.
 * @param {string} spinId
 * @param {object} event - Must have a `type` field.
 */
function pushEvent(spinId, event) {
  const session = sessions.get(spinId);
  if (!session) return;

  session.events.push(event);

  const payload = JSON.stringify(event);
  for (const ws of session.sockets) {
    try { ws.send(payload); } catch { /* ignore dead socket */ }
  }
}

/**
 * Schedule the session to be cleaned up after `delayMs` milliseconds.
 * Defaults to 5 minutes.
 * @param {string} spinId
 * @param {number} [delayMs=300000]
 */
function closeSession(spinId, delayMs = 5 * 60 * 1000) {
  const session = sessions.get(spinId);
  if (!session) return;

  // Clear any existing timer
  if (session.timer) clearTimeout(session.timer);

  session.timer = setTimeout(() => {
    // Notify connected clients that the session is expiring
    pushEvent(spinId, { type: 'expired' });

    // Close all open WebSocket connections
    for (const ws of session.sockets) {
      try { ws.close(1001, 'Session expired'); } catch { /* ignore */ }
    }

    sessions.delete(spinId);
  }, delayMs);
}

/**
 * Start the HTTP server and return the public base URL.
 * @returns {Promise<string>} Resolves with the public URL once the server is listening.
 */
function start() {
  return new Promise((resolve, reject) => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[spinServer] Listening on port ${PORT} — public URL: ${PUBLIC_URL}`);
      resolve(PUBLIC_URL);
    });
    server.on('error', reject);
  });
}

module.exports = { start, createSession, pushEvent, closeSession, PUBLIC_URL };
