import { cpSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { computeInputsFingerprint } from "./fingerprint.js";
import { normalizeOrigin, rewriteOriginsInDir } from "./origin.js";
import { ensureExists, resetDir } from "./utils/fs.js";
import { writeJson } from "./utils/json.js";
import { ensurePublicRegistryReady, type EnsurePublicRegistryReadyOptions } from "./shadcn-build.js";
import type { ArtifactManifest } from "./manifest.js";

export interface CopyDirEntry {
  from: string;
  to: string;
}

export interface RequiredPathEntry {
  path: string;
  label?: string;
}

export interface AfterCopyContext {
  rootDir: string;
  artifactRoot: string;
  origin: string;
}

export interface BuildRegistryArtifactsOptions {
  rootDir: string;
  artifactRoot?: string;
  inputs?: string[];
  manifest: ArtifactManifest;
  manifestFile?: string;
  fingerprintFile?: string;
  ensurePublicRegistry?: Omit<EnsurePublicRegistryReadyOptions, "rootDir">;
  requiredPaths?: Array<string | RequiredPathEntry>;
  copyDirs?: CopyDirEntry[];
  rewriteDirs?: string[];
  originRaw?: string;
  defaultOrigin: string;
  fromOrigin?: string;
  beforeBuild?: () => void;
  afterCopy?: (context: AfterCopyContext) => void;
}

export interface BuildRegistryArtifactsResult {
  origin: string;
  fingerprint: string;
  artifactRoot: string;
  manifestPath: string;
  fingerprintPath: string;
}

export function buildRegistryArtifacts(options: BuildRegistryArtifactsOptions): BuildRegistryArtifactsResult {
  const {
    rootDir,
    artifactRoot = "dist/artifacts",
    inputs = [],
    manifest,
    manifestFile = "artifact-manifest.json",
    fingerprintFile = "fingerprint.sha256",
    ensurePublicRegistry: ensurePublicRegistryOptions,
    requiredPaths = [],
    copyDirs = [],
    rewriteDirs = [],
    originRaw = process.env.REGISTRY_ORIGIN,
    defaultOrigin,
    fromOrigin = defaultOrigin,
    beforeBuild,
    afterCopy,
  } = options;

  if (typeof beforeBuild === "function") {
    beforeBuild();
  }

  if (ensurePublicRegistryOptions) {
    ensurePublicRegistryReady({
      rootDir,
      ...ensurePublicRegistryOptions,
    });
  }

  for (const required of requiredPaths) {
    if (typeof required === "string") {
      ensureExists(resolve(rootDir, required), required);
    } else {
      ensureExists(resolve(rootDir, required.path), required.label ?? required.path);
    }
  }

  const origin = normalizeOrigin(originRaw, { defaultOrigin });
  const artifactRootPath = resolve(rootDir, artifactRoot);
  resetDir(artifactRootPath);

  for (const copyEntry of copyDirs) {
    const from = resolve(rootDir, copyEntry.from);
    const to = resolve(artifactRootPath, copyEntry.to);
    cpSync(from, to, { recursive: true, force: true });
  }

  for (const relativeDir of rewriteDirs) {
    rewriteOriginsInDir(resolve(artifactRootPath, relativeDir), {
      fromOrigin,
      toOrigin: origin,
    });
  }

  if (typeof afterCopy === "function") {
    afterCopy({ rootDir, artifactRoot: artifactRootPath, origin });
  }

  const fingerprint = computeInputsFingerprint(rootDir, inputs);
  const manifestPath = resolve(artifactRootPath, manifestFile);
  const fingerprintPath = resolve(artifactRootPath, fingerprintFile);

  writeJson(manifestPath, manifest);
  writeFileSync(fingerprintPath, `${fingerprint}\n`);

  return {
    origin,
    fingerprint,
    artifactRoot: artifactRootPath,
    manifestPath,
    fingerprintPath,
  };
}
