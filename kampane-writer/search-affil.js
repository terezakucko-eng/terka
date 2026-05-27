import { listCampaigns } from "./firestore-rest.js";

const all = await listCampaigns();
console.log(`Procházím ${all.length} kampaní...\n`);

const KEYWORDS = ["affil", "afil", "partner", "změn", "zmen", "podmín", "podmin"];

function matches(text) {
  if (typeof text !== "string" || !text.trim()) return false;
  const lower = text.toLowerCase();
  return KEYWORDS.some((k) => lower.includes(k));
}

let foundAny = false;

for (const c of all) {
  const hits = [];
  for (const [key, val] of Object.entries(c.data || {})) {
    if (typeof val !== "string") continue;
    if (matches(val) && matches(key) === false) {
      // value matches — include
      hits.push({ field: key, value: val });
    } else if (matches(val)) {
      hits.push({ field: key, value: val });
    }
  }
  // also channelSpecs
  for (const [ch, spec] of Object.entries(c.channelSpecs || {})) {
    if (matches(spec) || ch.toLowerCase().includes("affil")) {
      hits.push({ field: `channelSpec[${ch}]`, value: spec });
    }
  }
  if (hits.length > 0) {
    foundAny = true;
    console.log(`\n📁 ${c.name}  (${c.id})`);
    console.log(`   ${c.startDate || "?"} → ${c.endDate || "?"}`);
    for (const h of hits) {
      const v = h.value.length > 300 ? h.value.slice(0, 300) + "…" : h.value;
      console.log(`   • ${h.field}:\n     ${v.replace(/\n/g, "\n     ")}`);
    }
  }
}

if (!foundAny) console.log("Nic relevantního nenalezeno.");
