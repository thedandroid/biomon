import { describe, it, expect } from "vitest";
import { clamp, clampInt, hasLiveEffect } from "../utils.js";

describe("Server utility functions", () => {
  describe("clamp", () => {
    it("should clamp value within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(15, 0, 10)).toBe(10);
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it("should handle boundary values", () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it("should handle NaN by returning lower bound", () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
      expect(clamp("invalid", 0, 10)).toBe(0);
      expect(clamp(undefined, 0, 10)).toBe(0);
    });

    it("should convert strings to numbers", () => {
      expect(clamp("5", 0, 10)).toBe(5);
      expect(clamp("15", 0, 10)).toBe(10);
    });

    it("should handle negative ranges", () => {
      expect(clamp(0, -10, 10)).toBe(0);
      expect(clamp(-15, -10, 10)).toBe(-10);
      expect(clamp(-5, -10, 10)).toBe(-5);
    });
  });

  describe("clampInt", () => {
    it("should truncate decimals and clamp", () => {
      expect(clampInt(5.7, 0, 10)).toBe(5);
      expect(clampInt(5.2, 0, 10)).toBe(5);
      expect(clampInt(10.9, 0, 10)).toBe(10);
    });

    it("should handle negative decimals", () => {
      expect(clampInt(-5.7, -10, 10)).toBe(-5);
      expect(clampInt(-5.2, -10, 10)).toBe(-5);
    });

    it("should clamp after truncating", () => {
      expect(clampInt(15.5, 0, 10)).toBe(10);
      expect(clampInt(-5.5, 0, 10)).toBe(0);
    });

    it("should handle NaN", () => {
      expect(clampInt(NaN, 0, 10)).toBe(0);
      expect(clampInt("invalid", 0, 10)).toBe(0);
    });
  });

  describe("hasLiveEffect", () => {
    it("should return true when player has live effect", () => {
      const player = {
        activeEffects: [
          { id: "e1", type: "panic_paranoid", clearedAt: null },
        ],
      };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(true);
    });

    it("should return false when effect is cleared", () => {
      const player = {
        activeEffects: [
          { id: "e1", type: "panic_paranoid", clearedAt: Date.now() },
        ],
      };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(false);
    });

    it("should return false when player has no effects", () => {
      const player = { activeEffects: [] };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(false);
    });

    it("should return false when player has different effect", () => {
      const player = {
        activeEffects: [
          { id: "e1", type: "stress_jumpy", clearedAt: null },
        ],
      };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(false);
    });

    it("should return false when activeEffects is not an array", () => {
      const player = { activeEffects: null };
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(false);
    });

    it("should return false when player is null", () => {
      expect(hasLiveEffect(null, "panic_paranoid")).toBe(false);
    });

    it("should return false when effectType is empty", () => {
      const player = {
        activeEffects: [
          { id: "e1", type: "panic_paranoid", clearedAt: null },
        ],
      };
      expect(hasLiveEffect(player, "")).toBe(false);
      expect(hasLiveEffect(player, null)).toBe(false);
      expect(hasLiveEffect(player, undefined)).toBe(false);
    });

    it("should handle multiple effects correctly", () => {
      const player = {
        activeEffects: [
          { id: "e1", type: "stress_jumpy", clearedAt: null },
          { id: "e2", type: "panic_paranoid", clearedAt: Date.now() },
          { id: "e3", type: "stress_frantic", clearedAt: null },
        ],
      };
      expect(hasLiveEffect(player, "stress_jumpy")).toBe(true);
      expect(hasLiveEffect(player, "panic_paranoid")).toBe(false);
      expect(hasLiveEffect(player, "stress_frantic")).toBe(true);
      expect(hasLiveEffect(player, "panic_freeze")).toBe(false);
    });
  });
});
