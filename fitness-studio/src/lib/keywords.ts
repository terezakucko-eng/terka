/** "zumba Ostrava, taneční fitness" → ["zumba Ostrava", "taneční fitness"] */
export const splitKeywords = (k: string) =>
  k
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
