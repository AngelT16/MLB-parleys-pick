import { describe, expect, it } from "vitest";
import {
  americanOddsToImpliedProbability,
  americanToDecimal,
  calculateEdge,
  decimalToAmerican,
  getConfidenceLabel,
} from "./odds.js";

describe("americanOddsToImpliedProbability", () => {
  it("converts negative odds", () => {
    expect(americanOddsToImpliedProbability(-150)).toBeCloseTo(0.6, 5);
    expect(americanOddsToImpliedProbability(-110)).toBeCloseTo(0.5238, 3);
  });

  it("converts positive odds", () => {
    expect(americanOddsToImpliedProbability(150)).toBeCloseTo(0.4, 5);
    expect(americanOddsToImpliedProbability(100)).toBeCloseTo(0.5, 5);
  });

  it("rejects zero", () => {
    expect(() => americanOddsToImpliedProbability(0)).toThrow();
  });
});

describe("decimal conversions", () => {
  it("round-trips american -> decimal -> american", () => {
    for (const odds of [-250, -150, -110, 100, 120, 250]) {
      expect(decimalToAmerican(americanToDecimal(odds))).toBe(odds);
    }
  });
});

describe("calculateEdge", () => {
  it("is model minus implied", () => {
    expect(calculateEdge(0.65, 0.6)).toBeCloseTo(0.05, 10);
    expect(calculateEdge(0.5, 0.55)).toBeCloseTo(-0.05, 10);
  });
});

describe("getConfidenceLabel", () => {
  it("maps score bands to labels", () => {
    expect(getConfidenceLabel(85)).toBe("Elite");
    expect(getConfidenceLabel(80)).toBe("Elite");
    expect(getConfidenceLabel(70)).toBe("Strong");
    expect(getConfidenceLabel(60)).toBe("Playable");
    expect(getConfidenceLabel(40)).toBe("Avoid");
  });
});
