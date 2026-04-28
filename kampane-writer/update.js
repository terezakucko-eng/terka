// Usage: node update.js <campaignId> <campaign.json>
import { readFile } from "node:fs/promises";
import { updateCampaign, getCampaign } from "./firestore-rest.js";
import { buildCampaign } from "./build-campaign.js";

const id = process.argv[2];
const path = process.argv[3];
if (!id || !path) {
  console.error("Usage: node update.js <campaignId> <campaign.json>");
  process.exit(1);
}

const existing = await getCampaign(id);
console.log(`Načtena existující kampaň: "${existing.name}"`);

const input = JSON.parse(await readFile(path, "utf8"));
const campaign = buildCampaign(input);

console.log(`Aktualizuji "${campaign.name}" (${id})...`);
await updateCampaign(id, campaign);
console.log(`OK.`);
console.log(
  `Otevřít: https://rs-kampane-rodny-list.netlify.app/?campaignId=${id}`
);
