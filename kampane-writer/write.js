// Usage: node write.js path/to/campaign.json
import { readFile } from "node:fs/promises";
import { addCampaign } from "./firestore-rest.js";
import { buildCampaign } from "./build-campaign.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node write.js <campaign.json>");
  process.exit(1);
}

const input = JSON.parse(await readFile(path, "utf8"));
const campaign = buildCampaign(input);

console.log(`Zapisuji kampaň: "${campaign.name}"...`);
const result = await addCampaign(campaign);
console.log(`OK. ID: ${result.id}`);
console.log(
  `Otevřít: https://rs-kampane-rodny-list.netlify.app/?campaignId=${result.id}`
);
