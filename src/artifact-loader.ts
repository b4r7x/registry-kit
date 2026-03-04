import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { ARTIFACT_MANIFEST_REL_PATH } from "./constants.js";
import { validateManifest } from "./manifest.js";
import { computeInputsFingerprint } from "./fingerprint.js";
import { ensureExists } from "./utils/fs.js";
import { readJson } from "./utils/json.js";
import type { ArtifactManifest } from "./types.js";

export interface LoadedArtifacts {
  manifest: ArtifactManifest;
  manifestPath: string;
  artifactRoot: string;
  packageRoot: string;
  fingerprint: string;
}

export interface LoadFromPackageOptions {
  packageName: string;
  /** Relative path within the package to the manifest. Defaults to `dist/artifacts/artifact-manifest.json`. */
  manifestRelPath?: string;
  /** Optional require context directory. Defaults to `process.cwd()`. */
  from?: string;
}

/**
 * Loads and validates artifacts from an npm-installed package.
 * Resolves the package via Node's module resolution.
 */
export function loadArtifactsFromPackage(
  options: LoadFromPackageOptions,
): LoadedArtifacts {
  const {
    packageName,
    manifestRelPath = ARTIFACT_MANIFEST_REL_PATH,
    from = process.cwd(),
  } = options;

  const require = createRequire(resolve(from, "package.json"));
  let packageDir: string;
  try {
    const pkgJsonPath = require.resolve(`${packageName}/package.json`);
    packageDir = dirname(pkgJsonPath);
  } catch {
    throw new Error(
      `Cannot resolve package "${packageName}" from "${from}". Is it installed?`,
    );
  }

  const manifestPath = resolve(packageDir, manifestRelPath);
  ensureExists(manifestPath, `${packageName} artifact manifest`);

  const raw = readJson<Record<string, unknown>>(manifestPath);
  const validation = validateManifest(raw);
  if (!validation.success) {
    throw new Error(
      `${packageName} manifest validation failed:\n${validation.errors.join("\n")}`,
    );
  }

  const manifest = validation.data;
  const artifactRoot = resolve(packageDir, manifest.artifactRoot);
  const fingerprintPath = resolve(
    artifactRoot,
    manifest.integrity.fingerprintFile,
  );
  ensureExists(fingerprintPath, `${packageName} artifact fingerprint`);

  const fingerprint = readFileSync(fingerprintPath, "utf-8").trim();

  return {
    manifest,
    manifestPath,
    artifactRoot,
    packageRoot: packageDir,
    fingerprint,
  };
}
