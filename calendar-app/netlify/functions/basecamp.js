/**
 * Netlify Function: Basecamp API proxy
 * Volání: /.netlify/functions/basecamp?path=/projects.json
 */
const https = require('https');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const token = process.env.BASECAMP_TOKEN;
  const account = process.env.BASECAMP_ACCOUNT || '3317373';

  if (!token) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'BASECAMP_TOKEN není nastavený v Netlify environment variables.' }),
    };
  }

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
        const responseHeaders = { ...headers };
        if (res.headers['link']) responseHeaders['Link'] = res.headers['link'];
        resolve({ statusCode: res.statusCode, headers: responseHeaders, body: data });
      });
    });

    req.on('error', (e) => resolve({
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: e.message }),
    }));

    if (event.body) req.write(event.body);
    req.end();
  });
};
