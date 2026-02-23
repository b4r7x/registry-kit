import { describe, it, expect } from "vitest";
import { validateManifest, ArtifactManifestSchema } from "../manifest.js";
import type { ArtifactManifest } from "../manifest.js";

const validManifest: ArtifactManifest = {
  schemaVersion: 1,
  library: "diff-ui",
  package: "@b4r7x/diff-ui",
  version: "0.5.0",
  artifactRoot: "dist/artifacts",
  inputs: ["docs/content", "registry", "public/r", "styles"],
  docs: {
    contentDir: "docs/content",
    metaFile: "docs/meta.json",
  },
  registry: {
    namespace: "@diffui",
    basePath: "/r/diff-ui",
    publicDir: "public/r",
    index: "public/r/registry.json",
  },
  integrity: {
    algorithm: "sha256",
    fingerprintFile: "fingerprint.sha256",
  },
};

describe("ArtifactManifestSchema", () => {
  it("should validate a valid manifest", () => {
    const result = ArtifactManifestSchema.safeParse(validManifest);
    expect(result.success).toBe(true);
  });

  it("should reject missing required fields", () => {
    const { library, ...noLibrary } = validManifest;
    const result = ArtifactManifestSchema.safeParse(noLibrary);
    expect(result.success).toBe(false);
  });

  it("should reject invalid schemaVersion", () => {
    const result = ArtifactManifestSchema.safeParse({ ...validManifest, schemaVersion: 2 });
    expect(result.success).toBe(false);
  });

  it("should reject invalid namespace format", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      registry: { ...validManifest.registry, namespace: "no-at-sign" },
    });
    expect(result.success).toBe(false);
  });

  it("should accept optional source field", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      source: { registryDir: "registry", stylesDir: "styles" },
    });
    expect(result.success).toBe(true);
  });

  it("should accept optional generated field", () => {
    const result = ArtifactManifestSchema.safeParse({
      ...validManifest,
      generated: { "components.json": "dist/artifacts/generated/components.json" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty inputs array", () => {
    const result = ArtifactManifestSchema.safeParse({ ...validManifest, inputs: [] });
    expect(result.success).toBe(false);
  });
});

describe("validateManifest", () => {
  it("should return success with parsed data for valid input", () => {
    const result = validateManifest(validManifest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.library).toBe("diff-ui");
    }
  });

  it("should return errors array for invalid input", () => {
    const result = validateManifest({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});
