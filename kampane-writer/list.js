import { listCampaigns } from "./firestore-rest.js";

const all = await listCampaigns();
const sorted = all.sort((a, b) => {
  const ad = a.createdAt || "";
  const bd = b.createdAt || "";
  return bd.localeCompare(ad);
});

console.log(`Nalezeno ${sorted.length} kampaní:\n`);
for (const c of sorted) {
  console.log(`- ${c.id}  ${c.name}  [${c.startDate || "?"} → ${c.endDate || "?"}]`);
}
