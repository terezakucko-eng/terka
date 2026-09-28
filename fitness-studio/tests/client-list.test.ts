import { describe, expect, it } from "vitest";
import { sortClients, splitName } from "@/lib/client-list";

describe("client list", () => {
  it("splits the surname off and sorts the Czech way", () => {
    expect(splitName("Anna Marie Nováková")).toEqual({ first: "Anna Marie", last: "Nováková" });
    expect(splitName("Madonna")).toEqual({ first: "Madonna", last: "" });
    const d = new Date();
    const list = ["Eva Čechová", "Jana Cibulková", "Iva Chalupová", "Olga Hrubá", "Ema Šimková", "Petra Sýkorová"].map((name, i) => ({ name, createdAt: d, creditBalance: [0, 500, 0, 760, 0, 20][i] }));
    expect(sortClients(list, "prijmeni").map((c) => splitName(c.name).last)).toEqual(["Cibulková", "Čechová", "Hrubá", "Chalupová", "Sýkorová", "Šimková"]);
    expect(sortClients(list, "kredit").slice(0, 3).map((c) => c.creditBalance)).toEqual([760, 500, 20]);
    expect(sortClients(list, "jmeno").map((c) => splitName(c.name).first)).toEqual(["Ema", "Eva", "Iva", "Jana", "Olga", "Petra"]);
  });
});
