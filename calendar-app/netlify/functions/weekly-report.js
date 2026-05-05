/**
 * Netlify Scheduled Function: Páteční report projektu SLON 4.0
 * Spouští se každý pátek v 8:00 UTC (9:00 / 10:00 CET).
 * Načte stav úkolů, porovná s minulým týdnem a přidá komentář ke zprávě.
 *
 * Env vars (stejné jako basecamp.js):
 *   BASECAMP_REFRESH_TOKEN, BC_CLIENT_SECRET, BASECAMP_TOKEN (fallback)
 */
const https = require('https');

const BC_CLIENT_ID   = '5fdd0da8e485ae6f80f4ce0a4938640bb22f1348';
const BC_ACCOUNT     = '3317373';
const PROJECT_ID     = '45681681';
const MESSAGE_ID     = '9701476737';
const FIREBASE_KEY   = 'AIzaSyD_F-TOZo08_5gx7SyNxhd0IoY5Tezl3G4';
const TOKEN_DOC      = 'projects/bc-slon/databases/(default)/documents/config/basecampToken';
const REPORT_DOC     = 'projects/bc-slon/databases/(default)/documents/config/weeklyReportSlon40';
const TOKEN_BUFFER_S = 60 * 60;

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpsRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function readFirestore(docPath) {
  try {
    const { body } = await httpsRequest(`https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE_KEY}`);
    const doc = JSON.parse(body);
    return doc.error ? null : doc;
  } catch { return null; }
}

async function writeFirestore(docPath, fields) {
  try {
    await httpsRequest(
      `https://firestore.googleapis.com/v1/${docPath}?key=${FIREBASE_KEY}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' } },
      JSON.stringify({ fields })
    );
  } catch { /* tichá chyba */ }
}

async function getToken() {
  const nowS = Math.floor(Date.now() / 1000);
  const doc = await readFirestore(TOKEN_DOC);
  const f = doc?.fields || {};
  const stored = {
    access_token:  f.access_token?.stringValue  || null,
    refresh_token: f.refresh_token?.stringValue || null,
    expires_at:    parseInt(f.expires_at?.integerValue || 0),
  };

  if (stored.access_token && stored.expires_at > nowS + TOKEN_BUFFER_S) {
    return stored.access_token;
  }

  const clientSecret  = process.env.BC_CLIENT_SECRET;
  const refreshTokEnv = process.env.BASECAMP_REFRESH_TOKEN;
  const usedRefresh   = stored.refresh_token || refreshTokEnv;

  if (clientSecret && usedRefresh) {
    try {
      const params = new URLSearchParams({
        type: 'refresh', client_id: BC_CLIENT_ID, client_secret: clientSecret,
        refresh_token: usedRefresh, redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
      });
      const { body } = await httpsRequest(
        `https://launchpad.37signals.com/authorization/token?${params}`,
        { method: 'POST', headers: { 'User-Agent': 'Terka Dashboard (tereza.kuckova@ruzovyslon.cz)' } }
      );
      const fresh = JSON.parse(body);
      if (fresh.access_token) {
        await writeFirestore(TOKEN_DOC, {
          access_token:  { stringValue: fresh.access_token },
          refresh_token: { stringValue: fresh.refresh_token || usedRefresh },
          expires_at:    { integerValue: String(nowS + (fresh.expires_in || 14 * 24 * 60 * 60)) },
        });
        return fresh.access_token;
      }
    } catch { /* fall through */ }
  }

  return process.env.BASECAMP_TOKEN || null;
}

async function bcGet(path, token) {
  const items = [];
  let url = `https://3.basecampapi.com/${BC_ACCOUNT}${path}`;
  while (url) {
    const { status, body } = await httpsRequest(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Terka Dashboard (tereza.kuckova@ruzovyslon.cz)',
      },
    });
    if (status === 204 || !body) break;
    if (status !== 200) throw new Error(`BC API ${status}: ${body.slice(0, 200)}`);
    const data = JSON.parse(body);
    if (Array.isArray(data)) items.push(...data);
    else return data; // single object

    // pagination via Link header (zjednodušené — pro todos stačí)
    break;
  }
  return items;
}

async function bcPost(path, token, payload) {
  const body = JSON.stringify(payload);
  const { status, body: resBody } = await httpsRequest(
    `https://3.basecampapi.com/${BC_ACCOUNT}${path}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Terka Dashboard (tereza.kuckova@ruzovyslon.cz)',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    },
    body
  );
  return { status, data: resBody ? JSON.parse(resBody) : null };
}

// ── Načtení stavu projektu ────────────────────────────────────────────────────

async function fetchProjectState(token) {
  const todolists = await bcGet(`/buckets/${PROJECT_ID}/todolists.json`, token);
  const groups = [];

  for (const list of todolists) {
    // Fetch group sections
    const groupsPath = `/buckets/${PROJECT_ID}/todolists/${list.id}/groups.json`;
    let subgroups = [];
    try { subgroups = await bcGet(groupsPath, token); } catch { /* no groups */ }

    const allSections = subgroups.length > 0 ? subgroups : [list];

    for (const section of allSections) {
      const todosPath = section.todos_url
        ? section.todos_url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '')
        : `/buckets/${PROJECT_ID}/todolists/${section.id}/todos.json`;

      let todos = [];
      try { todos = await bcGet(todosPath, token); } catch { /* skip */ }

      const completed = todos.filter(t => t.completed).length;
      const total = todos.length;

      if (total > 0) {
        groups.push({
          name: section.name || list.name,
          completed,
          total,
          open: todos.filter(t => !t.completed).map(t => t.content),
        });
      }
    }
  }

  const totalCompleted = groups.reduce((s, g) => s + g.completed, 0);
  const totalAll = groups.reduce((s, g) => s + g.total, 0);
  const pct = totalAll > 0 ? Math.round((totalCompleted / totalAll) * 100) : 0;

  return { groups, totalCompleted, totalAll, pct };
}

// ── Sestavení textu komentáře ─────────────────────────────────────────────────

function buildComment(state, prevPct) {
  const today = new Date().toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' });
  const change = prevPct !== null ? state.pct - prevPct : null;
  const changeStr = change !== null
    ? (change > 0 ? ` ↑ +${change} % oproti minulému týdnu` : change < 0 ? ` ↓ ${change} % oproti minulému týdnu` : ' — bez posunu oproti minulému týdnu')
    : '';

  let lines = [`## 📊 Týdenní update SLON 4.0 — ${today}`];
  lines.push('');
  lines.push(`**Celkový postup: ${state.pct} % (${state.totalCompleted}/${state.totalAll} úkolů)${changeStr}**`);
  lines.push('');

  for (const g of state.groups) {
    const bar = `${g.completed}/${g.total}`;
    lines.push(`### ${g.name} — ${bar}`);
    if (g.open.length > 0) {
      lines.push('Otevřené úkoly:');
      g.open.forEach(t => lines.push(`- ${t}`));
    } else {
      lines.push('✅ Vše dokončeno');
    }
    lines.push('');
  }

  if (change === 0) {
    lines.push('_Tento týden nebyl zaznamenán žádný posun._');
  }

  return lines.join('\n');
}

// ── Hlavní handler ────────────────────────────────────────────────────────────

exports.handler = async () => {
  try {
    const token = await getToken();
    if (!token) throw new Error('Žádný BC token');

    // Načti aktuální stav projektu
    const state = await fetchProjectState(token);

    // Načti předchozí stav z Firestore
    const prevDoc = await readFirestore(REPORT_DOC);
    const prevPct = prevDoc?.fields?.pct?.integerValue
      ? parseInt(prevDoc.fields.pct.integerValue)
      : null;

    // Sestav a pošli komentář
    const text = buildComment(state, prevPct);
    const { status } = await bcPost(
      `/buckets/${PROJECT_ID}/recordings/${MESSAGE_ID}/comments.json`,
      token,
      { content: text }
    );

    // Ulož nový stav do Firestore
    await writeFirestore(REPORT_DOC, {
      pct:       { integerValue: String(state.pct) },
      completed: { integerValue: String(state.totalCompleted) },
      total:     { integerValue: String(state.totalAll) },
      updatedAt: { stringValue: new Date().toISOString() },
    });

    console.log(`Weekly report odeslán (HTTP ${status}), postup: ${state.pct}%`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, pct: state.pct }) };
  } catch (e) {
    console.error('Weekly report chyba:', e.message);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
