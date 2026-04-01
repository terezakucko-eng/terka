#!/usr/bin/env node
/**
 * Basecamp CORS proxy - spusť: node basecamp-proxy.js
 * Čte token z ~/.config/basecamp/credentials.json (nastaveno přes `basecamp auth login`)
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const ACCOUNT_ID = '3317373';

function getToken() {
  const credPath = path.join(process.env.HOME || '/root', '.config/basecamp/credentials.json');
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const entry = Object.values(creds)[0];
  return entry.access_token;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // /api/<path> → https://3.basecampapi.com/3317373/<path>
  const apiPath = req.url.replace(/^\/api/, '');
  const targetUrl = `https://3.basecampapi.com/${ACCOUNT_ID}${apiPath}`;

  let token;
  try { token = getToken(); }
  catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: 'Token not found. Run: basecamp auth login' })); return; }

  const options = {
    method: req.method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Terka Campaign Calendar (tereza.kuckova@ruzovyslon.cz)',
      'Content-Type': 'application/json',
    }
  };

  const proxyReq = https.request(targetUrl, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.writeHead(502);
    res.end(JSON.stringify({ error: e.message }));
  });

  if (req.method !== 'GET') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

server.listen(PORT, () => {
  console.log(`Basecamp proxy běží na http://localhost:${PORT}`);
  console.log(`Účet: ${ACCOUNT_ID} | Spusť toto v pozadí při práci s kalendářem`);
});
