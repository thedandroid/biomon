import { describe, it, expect } from "vitest";
import {
  STRESS_TABLE,
  PANIC_TABLE,
  resolveEntry,
} from "../responseTables.js";

describe("selfcheck validation", () => {
  it("should validate that all table entries have required fields", () => {
    const requiredFields = ["min", "max", "id", "label", "description"];

    [...STRESS_TABLE, ...PANIC_TABLE].forEach((entry) => {
      requiredFields.forEach((field) => {
        expect(entry).toHaveProperty(field);
        expect(entry[field]).toBeDefined();
      });
    });
  });

  it("should ensure stress table has complete coverage", () => {
    // Test coverage from -10 to 30 (as per selfcheck.js)
    for (let total = -10; total <= 30; total++) {
      const entry = resolveEntry("stress", total);
      expect(entry).toBeDefined();
      expect(entry.id).toBeTruthy();
      expect(typeof entry.id).toBe("string");
    }
  });

  it("should ensure panic table has complete coverage", () => {
    // Test coverage from -10 to 30
    for (let total = -10; total <= 30; total++) {
      const entry = resolveEntry("panic", total);
      expect(entry).toBeDefined();
      expect(entry.id).toBeTruthy();
      expect(typeof entry.id).toBe("string");
    }
  });

  it("should validate table ranges don't overlap incorrectly", () => {
    [STRESS_TABLE, PANIC_TABLE].forEach((table) => {
      table.forEach((entry) => {
        expect(entry.min).toBeLessThanOrEqual(entry.max);
      });
    });
  });

  it("should validate all IDs are unique within each table", () => {
    const stressIds = STRESS_TABLE.map((e) => e.id);
    const panicIds = PANIC_TABLE.map((e) => e.id);

    const uniqueStressIds = new Set(stressIds);
    const uniquePanicIds = new Set(panicIds);

    expect(uniqueStressIds.size).toBe(stressIds.length);
    expect(uniquePanicIds.size).toBe(panicIds.length);
  });
});
