import { describe, expect, it } from "vitest";
import { availabilityText } from "@/components/session-card";

describe("availabilityText", () => {
  it("group classes show the last spots", () => {
    expect(availabilityText(10, 15)).toBe("Volno");
    expect(availabilityText(2, 15)).toBe("Poslední 2 místa");
    expect(availabilityText(1, 15)).toBe("Poslední 1 místo");
    expect(availabilityText(0, 15)).toBe("Obsazeno (náhradníci)");
  });
  it("individual sessions are just free or taken", () => {
    expect(availabilityText(1, 1)).toBe("Volno");
    expect(availabilityText(0, 1)).toBe("Obsazeno");
    expect(availabilityText(1, 2)).toBe("Volno");
  });
});
