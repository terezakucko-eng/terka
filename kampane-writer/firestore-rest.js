const PROJECT = "rs---kampane---rodny-list";
const API_KEY = "AIzaSyBy6Lvu8ieKKiw5OyCDgsb2KZa5ZiR6u3w";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) {
    return { arrayValue: { values: v.map(toFirestoreValue) } };
  }
  if (typeof v === "object") {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFirestoreValue(val);
    return { mapValue: { fields } };
  }
  throw new Error(`Unsupported value type: ${typeof v}`);
}

function fromFirestoreValue(v) {
  if (!v) return null;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v)
    return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in v) {
    const out = {};
    for (const [k, val] of Object.entries(v.mapValue.fields || {}))
      out[k] = fromFirestoreValue(val);
    return out;
  }
  return null;
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return fields;
}

export async function addCampaign(campaign) {
  const body = JSON.stringify({ fields: toFirestoreFields(campaign) });
  const res = await fetch(`${BASE}/kampane?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Firestore error: ${JSON.stringify(json)}`);
  const id = json.name.split("/").pop();
  return { id, ...json };
}

export async function updateCampaign(id, campaign) {
  const body = JSON.stringify({ fields: toFirestoreFields(campaign) });
  const res = await fetch(`${BASE}/kampane/${id}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Firestore error: ${JSON.stringify(json)}`);
  return json;
}

export async function getCampaign(id) {
  const res = await fetch(`${BASE}/kampane/${id}?key=${API_KEY}`);
  const json = await res.json();
  if (!res.ok) throw new Error(`Firestore error: ${JSON.stringify(json)}`);
  const data = {};
  for (const [k, v] of Object.entries(json.fields || {}))
    data[k] = fromFirestoreValue(v);
  return { id, ...data };
}

export async function listCampaigns() {
  const all = [];
  let pageToken;
  do {
    const url = new URL(`${BASE}/kampane`);
    url.searchParams.set("key", API_KEY);
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok) throw new Error(`Firestore error: ${JSON.stringify(json)}`);
    for (const d of json.documents || []) {
      const id = d.name.split("/").pop();
      const data = {};
      for (const [k, v] of Object.entries(d.fields || {}))
        data[k] = fromFirestoreValue(v);
      all.push({ id, ...data });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);
  return all;
}

export async function deleteCampaign(id) {
  const res = await fetch(`${BASE}/kampane/${id}?key=${API_KEY}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(`Firestore error: ${JSON.stringify(json)}`);
  }
  return true;
}
