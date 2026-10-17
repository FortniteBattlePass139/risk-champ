import { describe, expect, it } from "vitest";
import { runVerificationSuite } from "../verification";
import { formatAmericanOdds, formatDecimalOdds, confidenceInterval95 } from "../monteCarlo";

describe("ParlayLife engine invariants", () => {
  const results = runVerificationSuite();
  for (const r of results) {
    it(`${r.id}. ${r.name}`, () => {
      expect(r.detail).toBe("pass");
      expect(r.passed).toBe(true);
    });
  }

  it("odds formulas", () => {
    expect(formatDecimalOdds(0.146, 10000)).toBe("6.85x");
    expect(formatAmericanOdds(0.146, 10000)).toBe("+585");
    expect(formatAmericanOdds(0.75, 10000)).toBe("-300");
    expect(formatDecimalOdds(0, 10000)).toBe("N/A (>10,000x)");
  });

  it("95% CI", () => {
    const [lo, hi] = confidenceInterval95(0.5, 10000);
    expect(lo).toBeCloseTo(0.4902, 4);
    expect(hi).toBeCloseTo(0.5098, 4);
  });
});
