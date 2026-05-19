import { describe, expect, it } from "vitest";
import { isValidSiret } from "./auth";

describe("isValidSiret", () => {
  it("accepts a 14-digit SIRET", () => {
    expect(isValidSiret("12345678901234")).toBe(true);
  });

  it("accepts a SIRET with spaces (cleaned)", () => {
    expect(isValidSiret("123 456 789 01234")).toBe(true);
  });

  it("rejects a SIRET shorter than 14 digits", () => {
    expect(isValidSiret("1234567890")).toBe(false);
  });

  it("rejects a SIRET longer than 14 digits", () => {
    expect(isValidSiret("123456789012345")).toBe(false);
  });

  it("rejects non-digit characters", () => {
    expect(isValidSiret("1234567890ABCD")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSiret("")).toBe(false);
  });
});
