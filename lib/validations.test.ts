import { describe, expect, it } from "vitest";
import {
  normalizePhone,
  validateAddress,
  validatePhone,
  validatePincode,
} from "@/lib/validations";

describe("phone normalisation", () => {
  it("strips +91 and 0 prefixes", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("9876543210");
    expect(normalizePhone("09876543210")).toBe("9876543210");
    expect(normalizePhone("98765-43210")).toBe("9876543210");
  });
});

describe("validatePhone / validatePincode", () => {
  it("accepts valid 10-digit Indian mobiles", () => {
    expect(validatePhone("9876543210")).toBe(true);
    expect(validatePhone("+91 9876543210")).toBe(true);
  });
  it("rejects short/leading-1 mobiles", () => {
    expect(validatePhone("1234567890")).toBe(false);
    expect(validatePhone("98765")).toBe(false);
  });
  it("validates 6-digit pincodes", () => {
    expect(validatePincode("700001")).toBe(true);
    expect(validatePincode("70000")).toBe(false);
    expect(validatePincode("70000a")).toBe(false);
  });
});

describe("validateAddress", () => {
  const valid = {
    fullName: "Riya Sharma",
    phone: "9876543210",
    pincode: "700001",
    line1: "123, MG Road",
    city: "Kolkata",
    state: "West Bengal",
  };

  it("passes and returns sanitised (trimmed) values", () => {
    const res = validateAddress({ ...valid, line1: "  123, MG Road  " });
    expect(res.ok).toBe(true);
    expect(res.address?.line1).toBe("123, MG Road");
  });

  it("flags missing fields individually", () => {
    const res = validateAddress({});
    expect(res.ok).toBe(false);
    for (const key of ["fullName", "phone", "pincode", "line1", "city", "state"]) {
      expect(res.errors[key as keyof typeof res.errors]).toBeTruthy();
    }
  });
});
