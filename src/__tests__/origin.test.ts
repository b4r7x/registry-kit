import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeOrigin,
  rewriteOriginValue,
  rewriteOriginsInDir,
  rewriteOriginsInContent,
  DEFAULT_REGISTRY_ORIGIN,
} from "../origin.js";

describe("normalizeOrigin", () => {
  it("should use default when raw is undefined", () => {
    expect(normalizeOrigin(undefined)).toBe(DEFAULT_REGISTRY_ORIGIN);
  });

  it("should strip trailing slashes", () => {
    expect(normalizeOrigin("https://example.com///")).toBe("https://example.com");
  });

  it("should throw for non-http(s) origins", () => {
    expect(() => normalizeOrigin("ftp://nope.com")).toThrow();
  });

  it("should accept custom default", () => {
    expect(normalizeOrigin(undefined, { defaultOrigin: "https://custom.dev" })).toBe("https://custom.dev");
  });
});

describe("rewriteOriginValue", () => {
  it("should replace origin in strings", () => {
    const result = rewriteOriginValue(
      `${DEFAULT_REGISTRY_ORIGIN}/r/diff-ui/button.json`,
      { fromOrigin: DEFAULT_REGISTRY_ORIGIN, toOrigin: "https://localhost:3000" },
    );
    expect(result).toBe("https://localhost:3000/r/diff-ui/button.json");
  });

  it("should handle nested objects recursively", () => {
    const input = {
      url: `${DEFAULT_REGISTRY_ORIGIN}/test`,
      nested: { deep: `${DEFAULT_REGISTRY_ORIGIN}/deep` },
    };
    const result = rewriteOriginValue(input, {
      fromOrigin: DEFAULT_REGISTRY_ORIGIN,
      toOrigin: "https://new.com",
    });
    expect(result).toEqual({
      url: "https://new.com/test",
      nested: { deep: "https://new.com/deep" },
    });
  });

  it("should handle arrays", () => {
    const result = rewriteOriginValue(
      [`${DEFAULT_REGISTRY_ORIGIN}/a`, `${DEFAULT_REGISTRY_ORIGIN}/b`],
      { fromOrigin: DEFAULT_REGISTRY_ORIGIN, toOrigin: "https://x.com" },
    );
    expect(result).toEqual(["https://x.com/a", "https://x.com/b"]);
  });

  it("should pass through non-string/non-object values", () => {
    expect(rewriteOriginValue(42)).toBe(42);
    expect(rewriteOriginValue(null)).toBe(null);
    expect(rewriteOriginValue(true)).toBe(true);
  });
});

describe("rewriteOriginsInDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "rk-origin-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should rewrite origins in JSON files", () => {
    const data = { url: `${DEFAULT_REGISTRY_ORIGIN}/r/test` };
    writeFileSync(join(tempDir, "test.json"), JSON.stringify(data, null, 2) + "\n");

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: DEFAULT_REGISTRY_ORIGIN,
      toOrigin: "https://local.dev",
    });

    expect(result.changed).toBe(1);
    const content = JSON.parse(readFileSync(join(tempDir, "test.json"), "utf-8"));
    expect(content.url).toBe("https://local.dev/r/test");
  });

  it("should not modify files without matching origin", () => {
    const data = { url: "https://other.com/api" };
    writeFileSync(join(tempDir, "other.json"), JSON.stringify(data, null, 2) + "\n");

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: DEFAULT_REGISTRY_ORIGIN,
      toOrigin: "https://local.dev",
    });

    expect(result.changed).toBe(0);
  });

  it("should handle nested directories", () => {
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(
      join(tempDir, "sub", "nested.json"),
      JSON.stringify({ x: `${DEFAULT_REGISTRY_ORIGIN}/x` }, null, 2) + "\n",
    );

    const result = rewriteOriginsInDir(tempDir, {
      fromOrigin: DEFAULT_REGISTRY_ORIGIN,
      toOrigin: "https://new.dev",
    });

    expect(result.changed).toBe(1);
  });
});

describe("rewriteOriginsInContent", () => {
  it("should replace origins in plain text", () => {
    const result = rewriteOriginsInContent(
      `Visit ${DEFAULT_REGISTRY_ORIGIN}/docs for more`,
      { fromOrigin: DEFAULT_REGISTRY_ORIGIN, toOrigin: "https://staging.dev" },
    );
    expect(result).toBe("Visit https://staging.dev/docs for more");
  });
});
