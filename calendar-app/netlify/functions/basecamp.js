/**
 * Netlify Function: Basecamp API proxy s automatickým obnováním tokenu
 *
 * Env vars (povinné jednou nastavit, nikdy neexpirují):
 *   BASECAMP_REFRESH_TOKEN  – refresh token (platí 10 let)
 *   BC_CLIENT_SECRET        – OAuth client secret
 *
 * Env vars (volitelné, fallback):
 *   BASECAMP_TOKEN          – přímý access token (fallback pokud Firestore selže)
 *   BASECAMP_ACCOUNT        – account ID (default 3317373)
 */
const https = require('https');

const BC_CLIENT_ID    = '5fdd0da8e485ae6f80f4ce0a4938640bb22f1348';
const FIREBASE_KEY    = 'AIzaSyD_F-TOZo08_5gx7SyNxhd0IoY5Tezl3G4';
const FIREBASE_DOC    = 'projects/bc-slon/databases/(default)/documents/config/basecampToken';
const TOKEN_BUFFER_S  = 60 * 60; // obnovit 1 hodinu před expirací

// ── Firestore REST helpers ──────────────────────────────────────────────────

function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.status || res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function readToken() {
  try {
    const { body } = await httpsRequest(`https://firestore.googleapis.com/v1/${FIREBASE_DOC}?key=${FIREBASE_KEY}`);
    const doc = JSON.parse(body);
    if (doc.error) return null;
    const f = doc.fields || {};
    return {
      access_token:  f.access_token?.stringValue  || null,
      refresh_token: f.refresh_token?.stringValue || null,
      expires_at:    parseInt(f.expires_at?.integerValue || 0),
    };
  } catch { return null; }
}

async function writeToken(data) {
  try {
    await httpsRequest(
      `https://firestore.googleapis.com/v1/${FIREBASE_DOC}?key=${FIREBASE_KEY}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
      JSON.stringify({
        fields: {
          access_token:  { stringValue: data.access_token },
          refresh_token: { stringValue: data.refresh_token },
          expires_at:    { integerValue: String(data.expires_at) },
        },
      })
    );
  } catch { /* tichá chyba */ }
}

async function refreshToken(refreshTok, clientSecret) {
  const params = new URLSearchParams({
    type: 'refresh', client_id: BC_CLIENT_ID, client_secret: clientSecret,
    refresh_token: refreshTok, redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
  });
  const { body } = await httpsRequest(
    `https://launchpad.37signals.com/authorization/token?${params}`,
    { method: 'POST', headers: { 'User-Agent': 'Terka Dashboard (tereza.kuckova@ruzovyslon.cz)' } }
  );
  return JSON.parse(body);
}

// ── Handler ─────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const clientSecret   = process.env.BC_CLIENT_SECRET;
  const refreshTokenEnv = process.env.BASECAMP_REFRESH_TOKEN;
  const account        = process.env.BASECAMP_ACCOUNT || '3317373';
  const nowS           = Math.floor(Date.now() / 1000);

  let token = null;

  // 1. Zkus načíst platný token z Firestore
  const stored = await readToken();
  if (stored?.access_token && stored.expires_at > nowS + TOKEN_BUFFER_S) {
    token = stored.access_token;
  }

  // 2. Token chybí nebo brzy expiruje → obnov
  if (!token && clientSecret && refreshTokenEnv) {
    try {
      const usedRefresh = stored?.refresh_token || refreshTokenEnv;
      const fresh = await refreshToken(usedRefresh, clientSecret);
      if (fresh.access_token) {
        token = fresh.access_token;
        const expiresAt = nowS + (fresh.expires_in || 14 * 24 * 60 * 60);
        await writeToken({
          access_token:  token,
          refresh_token: fresh.refresh_token || usedRefresh,
          expires_at:    expiresAt,
        });
      }
    } catch { /* fall through to env fallback */ }
  }

  // 3. Fallback na statický env var
  if (!token) token = process.env.BASECAMP_TOKEN;

  if (!token) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'Žádný Basecamp token není dostupný.' }),
    };
  }

  // 4. Proxy request na Basecamp API
  const bcPath = event.queryStringParameters?.path || '/';
  const targetUrl = `https://3.basecampapi.com/${account}${bcPath}`;

  return new Promise((resolve) => {
    const req = https.request(targetUrl, {
      method: event.httpMethod,
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Terka Dashboard (tereza.kuckova@ruzovyslon.cz)',
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const rh = { ...headers };
        if (res.headers['link']) rh['Link'] = res.headers['link'];
        resolve({ statusCode: res.statusCode, headers: rh, body: data });
      });
    });
    req.on('error', (e) => resolve({ statusCode: 502, headers, body: JSON.stringify({ error: e.message }) }));
    if (event.body) req.write(event.body);
    req.end();
  });
};
