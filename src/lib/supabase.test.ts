import { afterEach, describe, expect, it, vi } from "vitest";
import { getEnv } from "./supabase";

describe("getEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  it("returns undefined for unknown variable", () => {
    expect(getEnv("DEFINITELY_NOT_SET_XYZ_123")).toBeUndefined();
  });

  it("reads from process.env when import.meta.env doesn't have it", () => {
    process.env.SOME_CUSTOM_VAR = "from-process-env";
    expect(getEnv("SOME_CUSTOM_VAR")).toBe("from-process-env");
  });

  it("reads from import.meta.env (Vite) when available", () => {
    vi.stubEnv("VITE_TEST_VAR_FOO", "from-vite");
    expect(getEnv("VITE_TEST_VAR_FOO")).toBe("from-vite");
  });

  it("vite env takes precedence over process.env", () => {
    process.env.SHARED_VAR = "from-process";
    vi.stubEnv("SHARED_VAR", "from-vite");
    expect(getEnv("SHARED_VAR")).toBe("from-vite");
  });
});
