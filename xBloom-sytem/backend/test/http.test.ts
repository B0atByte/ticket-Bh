import { describe, expect, it } from "vitest";
import { addYears, toCsv } from "../src/lib/http";

describe("addYears", () => {
  it("computes the warranty expiry (purchase + N years)", () => {
    expect(addYears("2025-01-10", 1)).toBe("2026-01-10");
    expect(addYears("2025-06-01", 2)).toBe("2027-06-01");
  });
  it("handles leap-day rollover", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-03-01");
  });
  it("xBloom warranty term is 2 years", () => {
    // guards the register expiry calc (purchaseDate + 2 years)
    expect(addYears("2026-02-07", 2)).toBe("2028-02-07");
  });
});

describe("toCsv", () => {
  it("returns empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
  it("emits a header row + data", () => {
    const csv = toCsv([{ a: 1, b: "x" }]);
    expect(csv).toBe("a,b\r\n1,x");
  });
  it("quotes values containing commas, quotes and newlines", () => {
    const csv = toCsv([{ note: 'a,"b"\nc' }]);
    expect(csv).toBe('note\r\n"a,""b""\nc"');
  });
});
