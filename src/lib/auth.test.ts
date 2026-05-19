import { describe, expect, it } from "vitest";
import {
  authKeys,
  getUserDisplayName,
  getUserInitials,
  isValidSiret,
  type Professional,
} from "./auth";

function mkPro(overrides: Partial<Professional> = {}): Professional {
  return {
    id: "uid-1",
    company_name: "Hôtel Test",
    contact_name: "Jean Dupont",
    email: "jean@example.com",
    phone: "+33 1 23 45 67 89",
    siret: "12345678901234",
    delivery_zip: "75001",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("isValidSiret", () => {
  it("accepts a 14-digit SIRET", () => {
    expect(isValidSiret("12345678901234")).toBe(true);
  });

  it("accepts a SIRET with spaces (cleaned)", () => {
    expect(isValidSiret("123 456 789 01234")).toBe(true);
  });

  it("accepts a SIRET with multiple consecutive spaces", () => {
    expect(isValidSiret("12345   67890  1234")).toBe(true);
  });

  it("accepts a SIRET with tabs and spaces mixed", () => {
    expect(isValidSiret("12345\t6789 01234")).toBe(true);
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

  it("rejects a SIRET with dashes", () => {
    expect(isValidSiret("123-456-789-01234")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSiret("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValidSiret("    ")).toBe(false);
  });
});

describe("getUserDisplayName", () => {
  it("prefers professional contact_name when available", () => {
    expect(
      getUserDisplayName(
        { email: "jean@example.com" } as never,
        mkPro({ contact_name: "Marie Curie" }),
      ),
    ).toBe("Marie Curie");
  });

  it("falls back to user email when no professional", () => {
    expect(getUserDisplayName({ email: "jean@example.com" } as never, null)).toBe(
      "jean@example.com",
    );
  });

  it("falls back to 'Mon compte' when nothing available", () => {
    expect(getUserDisplayName(null, null)).toBe("Mon compte");
    expect(getUserDisplayName(undefined, undefined)).toBe("Mon compte");
  });

  it("falls back to user email when professional has no contact name", () => {
    expect(
      getUserDisplayName({ email: "jean@example.com" } as never, mkPro({ contact_name: "" })),
    ).toBe("jean@example.com");
  });
});

describe("getUserInitials", () => {
  it("returns first letter of each word from contact_name", () => {
    expect(getUserInitials(null, mkPro({ contact_name: "Jean Dupont" }))).toBe("JD");
  });

  it("returns up to 2 letters max", () => {
    expect(getUserInitials(null, mkPro({ contact_name: "Jean Marie Dupont" }))).toBe("JM");
  });

  it("falls back to company_name when contact missing", () => {
    expect(getUserInitials(null, mkPro({ contact_name: "", company_name: "Hôtel Riviera" }))).toBe(
      "HR",
    );
  });

  it("falls back to email when no professional", () => {
    expect(getUserInitials({ email: "jean.dupont@example.com" } as never, null)).toBe("JD");
  });

  it("returns '?' when nothing available", () => {
    expect(getUserInitials(null, null)).toBe("?");
    expect(getUserInitials(undefined, undefined)).toBe("?");
  });

  it("handles single-word names", () => {
    expect(getUserInitials(null, mkPro({ contact_name: "Madonna" }))).toBe("M");
  });

  it("uppercases letters", () => {
    expect(getUserInitials(null, mkPro({ contact_name: "alice bob" }))).toBe("AB");
  });
});

describe("authKeys", () => {
  it("produces stable session key", () => {
    expect(authKeys.session).toEqual(["auth", "session"]);
  });

  it("includes userId in the professional key", () => {
    expect(authKeys.professional("u1")).toEqual(["auth", "professional", "u1"]);
  });

  it("includes undefined userId (anonymous case)", () => {
    expect(authKeys.professional(undefined)).toEqual(["auth", "professional", undefined]);
  });
});
