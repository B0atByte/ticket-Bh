import { describe, expect, it } from "vitest";
import { normTicketStatus, toDate, toDateTime, toPhone, toPostal, toStr } from "../src/lib/coerce";

describe("toStr", () => {
  it("trims and nulls empties", () => {
    expect(toStr("  hi ")).toBe("hi");
    expect(toStr("")).toBeNull();
    expect(toStr(null)).toBeNull();
    expect(toStr(42)).toBe("42");
  });
});

describe("toDate", () => {
  it("converts Excel serials", () => {
    expect(toDate(46060)).toBe("2026-02-07"); // observed in the real sheet
  });
  it("slices ISO strings", () => {
    expect(toDate("2025-01-10T15:03:10+07:00")).toBe("2025-01-10");
  });
  it("nulls invalid", () => {
    expect(toDate(null)).toBeNull();
    expect(toDate("not a date")).toBeNull();
  });
});

describe("toDateTime", () => {
  it("keeps wall-clock from ISO with tz", () => {
    expect(toDateTime("2026-04-12T15:03:10+07:00")).toBe("2026-04-12 15:03:10");
  });
  it("strips milliseconds", () => {
    expect(toDateTime("2026-04-16T10:46:45.561+07:00")).toBe("2026-04-16 10:46:45");
  });
});

describe("toPhone", () => {
  it("restores the lost leading zero", () => {
    expect(toPhone(992294153)).toBe("0992294153");
    expect(toPhone("992294153")).toBe("0992294153");
  });
  it("leaves already-correct numbers", () => {
    expect(toPhone("0812345678")).toBe("0812345678");
    expect(toPhone(null)).toBeNull();
  });
});

describe("toPostal", () => {
  it("pads to 5 digits", () => {
    expect(toPostal(1130)).toBe("01130");
    expect(toPostal("11130")).toBe("11130");
  });
});

describe("normTicketStatus", () => {
  it("maps human labels to enum keys", () => {
    expect(normTicketStatus("Closed")).toBe("closed");
    expect(normTicketStatus("Repair done")).toBe("repair_done");
    expect(normTicketStatus("Customer approved")).toBe("approved");
  });
  it("defaults empty to new and underscores unknowns", () => {
    expect(normTicketStatus(null)).toBe("new");
    expect(normTicketStatus("Guide Customer")).toBe("guide_customer");
  });
});
