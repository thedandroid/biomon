import { describe, it, expect } from "vitest";
import {
  STRESS_TABLE,
  PANIC_TABLE,
  resolveEntry,
  getEntryById,
} from "../responseTables.js";

describe("responseTables", () => {
  describe("STRESS_TABLE", () => {
    it("should have valid table structure", () => {
      expect(Array.isArray(STRESS_TABLE)).toBe(true);
      expect(STRESS_TABLE.length).toBeGreaterThan(0);

      STRESS_TABLE.forEach((entry) => {
        expect(entry).toHaveProperty("min");
        expect(entry).toHaveProperty("max");
        expect(entry).toHaveProperty("id");
        expect(entry).toHaveProperty("label");
        expect(entry).toHaveProperty("description");
        expect(typeof entry.min).toBe("number");
        expect(typeof entry.max).toBe("number");
        expect(typeof entry.id).toBe("string");
        expect(typeof entry.label).toBe("string");
      });
    });

    it("should have no gaps in coverage", () => {
      // Test a wide range of totals
      for (let total = -10; total <= 30; total++) {
        const entry = resolveEntry("stress", total);
        expect(entry).toBeDefined();
        expect(entry.id).toBeTruthy();
      }
    });
  });

  describe("PANIC_TABLE", () => {
    it("should have valid table structure", () => {
      expect(Array.isArray(PANIC_TABLE)).toBe(true);
      expect(PANIC_TABLE.length).toBeGreaterThan(0);

      PANIC_TABLE.forEach((entry) => {
        expect(entry).toHaveProperty("min");
        expect(entry).toHaveProperty("max");
        expect(entry).toHaveProperty("id");
        expect(entry).toHaveProperty("label");
        expect(entry).toHaveProperty("description");
        expect(typeof entry.min).toBe("number");
        expect(typeof entry.max).toBe("number");
        expect(typeof entry.id).toBe("string");
        expect(typeof entry.label).toBe("string");
      });
    });

    it("should have no gaps in coverage", () => {
      for (let total = -10; total <= 30; total++) {
        const entry = resolveEntry("panic", total);
        expect(entry).toBeDefined();
        expect(entry.id).toBeTruthy();
      }
    });
  });

  describe("resolveEntry", () => {
    it("should return 'Keeping Cool' for stress total <= 0", () => {
      const entry = resolveEntry("stress", 0);
      expect(entry.id).toBe("stress_keeping_cool");
      expect(entry.label).toBe("Keeping Cool");
    });

    it("should return 'Keeping Cool' for panic total <= 0", () => {
      const entry = resolveEntry("panic", 0);
      expect(entry.id).toBe("panic_keeping_cool");
      expect(entry.label).toBe("Keeping Cool");
    });

    it("should return 'Jumpy' for stress total = 1", () => {
      const entry = resolveEntry("stress", 1);
      expect(entry.id).toBe("stress_jumpy");
      expect(entry.label).toBe("Jumpy");
      expect(entry.persistent).toBe(true);
    });

    it("should return 'Spooked' for panic total = 1", () => {
      const entry = resolveEntry("panic", 1);
      expect(entry.id).toBe("panic_spooked");
      expect(entry.label).toBe("Spooked");
      expect(entry.stressDelta).toBe(1);
    });

    it("should return 'Mess Up' for high stress totals", () => {
      const entry = resolveEntry("stress", 10);
      expect(entry.id).toBe("stress_mess_up");
      expect(entry.label).toBe("Mess Up");
    });

    it("should return 'Catatonic' for very high panic totals", () => {
      const entry = resolveEntry("panic", 15);
      expect(entry.id).toBe("panic_catatonic");
      expect(entry.label).toBe("Catatonic");
      expect(entry.persistent).toBe(true);
    });

    it("should handle negative totals", () => {
      const stressEntry = resolveEntry("stress", -5);
      const panicEntry = resolveEntry("panic", -5);
      expect(stressEntry.id).toBe("stress_keeping_cool");
      expect(panicEntry.id).toBe("panic_keeping_cool");
    });

    it("should default to stress table for unknown roll type", () => {
      const entry = resolveEntry("unknown", 1);
      expect(entry.id).toBe("stress_jumpy");
    });
  });

  describe("getEntryById", () => {
    it("should retrieve stress entry by id", () => {
      const entry = getEntryById("stress", "stress_jumpy");
      expect(entry).toBeDefined();
      expect(entry.id).toBe("stress_jumpy");
      expect(entry.label).toBe("Jumpy");
    });

    it("should retrieve panic entry by id", () => {
      const entry = getEntryById("panic", "panic_spooked");
      expect(entry).toBeDefined();
      expect(entry.id).toBe("panic_spooked");
      expect(entry.label).toBe("Spooked");
    });

    it("should return null for non-existent id", () => {
      const entry = getEntryById("stress", "non_existent_id");
      expect(entry).toBeNull();
    });

    it("should return null for undefined id", () => {
      const entry = getEntryById("stress", undefined);
      expect(entry).toBeNull();
    });

    it("should return null for null id", () => {
      const entry = getEntryById("stress", null);
      expect(entry).toBeNull();
    });

    it("should handle empty string id", () => {
      const entry = getEntryById("stress", "");
      expect(entry).toBeNull();
    });
  });

  describe("Stress table entries", () => {
    it("should have correct persistent flags", () => {
      expect(getEntryById("stress", "stress_keeping_cool").persistent).toBe(false);
      expect(getEntryById("stress", "stress_jumpy").persistent).toBe(true);
      expect(getEntryById("stress", "stress_tunnel_vision").persistent).toBe(true);
      expect(getEntryById("stress", "stress_mess_up").persistent).toBe(false);
    });

    it("should have correct stress deltas", () => {
      const messUp = getEntryById("stress", "stress_mess_up");
      expect(messUp.stressDelta).toBe(1);
    });
  });

  describe("Panic table entries", () => {
    it("should have correct persistent flags", () => {
      expect(getEntryById("panic", "panic_keeping_cool").persistent).toBe(false);
      expect(getEntryById("panic", "panic_spooked").persistent).toBe(false);
      expect(getEntryById("panic", "panic_paranoid").persistent).toBe(true);
      expect(getEntryById("panic", "panic_catatonic").persistent).toBe(true);
    });

    it("should have apply options for Seek Cover", () => {
      const seekCover = getEntryById("panic", "panic_seek_cover");
      expect(seekCover.applyOptions).toBeDefined();
      expect(Array.isArray(seekCover.applyOptions)).toBe(true);
      expect(seekCover.applyOptions.length).toBe(2);
      expect(seekCover.applyOptions[0].id).toBe("panic_seek_cover");
      expect(seekCover.applyOptions[1].id).toBe("panic_scream");
    });

    it("should have apply options for Flee", () => {
      const flee = getEntryById("panic", "panic_flee");
      expect(flee.applyOptions).toBeDefined();
      expect(Array.isArray(flee.applyOptions)).toBe(true);
      expect(flee.applyOptions.length).toBe(2);
      expect(flee.applyOptions[0].id).toBe("panic_flee");
      expect(flee.applyOptions[1].id).toBe("panic_catatonic");
    });

    it("should have correct stress deltas for panic entries", () => {
      expect(getEntryById("panic", "panic_spooked").stressDelta).toBe(1);
      expect(getEntryById("panic", "panic_seek_cover").stressDelta).toBe(-1);
      expect(getEntryById("panic", "panic_scream").stressDelta).toBe(-1);
      expect(getEntryById("panic", "panic_flee").stressDelta).toBe(-1);
    });
  });
});
