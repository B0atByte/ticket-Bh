import { describe, expect, it } from "vitest";
import { canTransition } from "../src/lib/workflow";

describe("canTransition", () => {
  it("allows advancing one step", () => {
    expect(canTransition("new", "diagnose")).toBe(true);
    expect(canTransition("quote", "approved")).toBe(true);
    expect(canTransition("returned", "closed")).toBe(true);
  });
  it("allows closing from any state", () => {
    expect(canTransition("new", "closed")).toBe(true);
    expect(canTransition("repairing", "closed")).toBe(true);
  });
  it("allows staying put", () => {
    expect(canTransition("diagnose", "diagnose")).toBe(true);
  });
  it("rejects skipping stages and going backwards", () => {
    expect(canTransition("new", "repairing")).toBe(false);
    expect(canTransition("repairing", "new")).toBe(false);
    expect(canTransition("closed", "repairing")).toBe(false);
  });
});
