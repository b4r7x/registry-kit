import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { loadArtifactsFromPackage } from "./artifact-loader.js";
import { computeInputsFingerprint } from "./fingerprint.js";
import { validateManifest } from "./manifest.js";
import { collectJsonFiles, ensureExists, resetDir } from "./utils/fs.js";
import { readJson, writeJson } from "./utils/json.js";
import { DEFAULT_REGISTRY_ORIGIN } from "./origin.js";
import type { ArtifactManifest } from "./types.js";

// ── Types ────────────────────────────────────────────────────────────

export interface SyncLibraryConfig {
  id: string;
  /** npm package name for artifacts (e.g., `@b4r7x/diff-ui-artifacts`). */
  packageName: string;
  /** Workspace-relative directory name (used in workspace mode). */
  workspaceDir: string;
}

export interface SyncDocsOptions {
  /** Absolute path to the docs app root. */
  docsRoot: string;
  /** Absolute path to the workspace root (parent of library dirs). */
  workspaceRoot: string;
  /** Libraries to sync. */
  libraries: SyncLibraryConfig[];
  /** Which library is primary (owns registry source, styles). */
  primaryLibraryId: string;
  /** Registry origin URL (normalized, no trailing slash). */
  origin: string;
  /** Loading mode: workspace (dev) or package (production/CI). */
  mode: "workspace" | "package";
  /** Sync schema version for fingerprint invalidation. */
  syncSchemaVersion?: number;
  /** Optional post-processing for generated files per library. */
  afterSync?: (ctx: AfterSyncContext) => void;
}

export interface AfterSyncContext {
  libraryId: string;
  generatedDir: string;
}

export interface SyncDocsResult {
  synced: boolean;
  fingerprint: string;
  artifacts: LoadedLibraryArtifacts[];
}

export interface LoadedLibraryArtifacts {
  id: string;
  manifest: ArtifactManifest;
  manifestPath: string;
  artifactRoot: string;
  fingerprintPath: string;
  fingerprint: string;
  generatedFiles: string[];
}

// ── Artifact Loading ──────────────────────────────────────────────────

function getManifestGeneratedFiles(manifest: ArtifactManifest): string[] {
  if (!manifest.generated) return [];
  return Object.values(manifest.generated).filter(
    (value): value is string => typeof value === "string",
  );
}

function assertUniqueGeneratedOutputNames(
  libraryId: string,
  generatedFiles: string[],
): void {
  const seen = new Map<string, string>();

  for (const generatedFile of generatedFiles) {
    const outputName = basename(generatedFile);
    const firstSource = seen.get(outputName);
    if (firstSource) {
      throw new Error(
        [
          `${libraryId} manifest.generated contains duplicate output name "${outputName}".`,
          `First source:  ${firstSource}`,
          `Second source: ${generatedFile}`,
          "Generated files are copied by basename during docs sync.",
        ].join("\n"),
      );
    }
    seen.set(outputName, generatedFile);
  }
}

function toLoadedLibraryArtifacts(params: {
  id: string;
  manifest: ArtifactManifest;
  manifestPath: string;
  artifactRoot: string;
  fingerprintPath: string;
  fingerprint: string;
}): LoadedLibraryArtifacts {
  const {
    id,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint,
  } = params;
  const generatedFiles = getManifestGeneratedFiles(manifest);
  assertUniqueGeneratedOutputNames(id, generatedFiles);

  return {
    id,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint,
    generatedFiles,
  };
}

function loadFromPackage(
  config: SyncLibraryConfig,
  docsRoot: string,
): LoadedLibraryArtifacts {
  const loaded = loadArtifactsFromPackage({
    packageName: config.packageName,
    from: docsRoot,
  });

  return toLoadedLibraryArtifacts({
    id: config.id,
    manifest: loaded.manifest,
    manifestPath: loaded.manifestPath,
    artifactRoot: loaded.artifactRoot,
    fingerprintPath: resolve(
      loaded.artifactRoot,
      loaded.manifest.integrity.fingerprintFile,
    ),
    fingerprint: loaded.fingerprint,
  });
}

function loadFromWorkspace(
  config: SyncLibraryConfig,
  workspaceRoot: string,
): LoadedLibraryArtifacts {
  const libraryRoot = resolve(workspaceRoot, config.workspaceDir);
  const manifestPath = resolve(
    libraryRoot,
    "dist/artifacts/artifact-manifest.json",
  );
  ensureExists(manifestPath, `${config.id} artifact manifest`);

  const raw = readJson<Record<string, unknown>>(manifestPath);
  const validation = validateManifest(raw);
  if (!validation.success) {
    throw new Error(
      `${config.id} manifest validation failed:\n${validation.errors.join("\n")}`,
    );
  }

  const manifest = validation.data;
  const artifactRoot = resolve(libraryRoot, manifest.artifactRoot);
  const fingerprintPath = resolve(
    artifactRoot,
    manifest.integrity.fingerprintFile,
  );
  ensureExists(fingerprintPath, `${config.id} artifact fingerprint`);

  const expectedFingerprint = readFileSync(fingerprintPath, "utf-8").trim();
  const currentFingerprint = computeInputsFingerprint(
    libraryRoot,
    manifest.inputs,
  );

  if (expectedFingerprint !== currentFingerprint) {
    throw new Error(
      [
        `${config.id} artifacts are stale.`,
        `Expected fingerprint: ${expectedFingerprint}`,
        `Current fingerprint:  ${currentFingerprint}`,
        `Run: pnpm --dir ${config.workspaceDir} build:artifacts`,
      ].join("\n"),
    );
  }

  return toLoadedLibraryArtifacts({
    id: config.id,
    manifest,
    manifestPath,
    artifactRoot,
    fingerprintPath,
    fingerprint: expectedFingerprint,
  });
}

function loadLibraryArtifacts(
  config: SyncLibraryConfig,
  mode: "workspace" | "package",
  docsRoot: string,
  workspaceRoot: string,
): LoadedLibraryArtifacts {
  if (mode === "workspace") {
    return loadFromWorkspace(config, workspaceRoot);
  }
  return loadFromPackage(config, docsRoot);
}

// ── Sync Operations ──────────────────────────────────────────────────

function assertNoDefaultOrigin(dir: string, origin: string): void {
  if (origin === DEFAULT_REGISTRY_ORIGIN) return;

  const offenders: string[] = [];
  for (const jsonFile of collectJsonFiles(dir)) {
    const raw = readFileSync(jsonFile, "utf-8");
    if (raw.includes(DEFAULT_REGISTRY_ORIGIN)) {
      offenders.push(jsonFile);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        `Found unreplaced origin "${DEFAULT_REGISTRY_ORIGIN}" in registry output:`,
        ...offenders,
        "",
        "Rebuild library artifacts with correct REGISTRY_ORIGIN.",
      ].join("\n"),
    );
  }
}

function syncPrimaryArtifacts(
  primaryArtifact: LoadedLibraryArtifacts,
  generatedDir: string,
  registryDir: string,
  stylesDir: string,
): void {
  const generatedSourceDirRel = primaryArtifact.manifest.docs.generatedDir;
  const registrySourceDirRel = primaryArtifact.manifest.source?.registryDir;
  const stylesSourceDirRel = primaryArtifact.manifest.source?.stylesDir;
  const missingFields: string[] = [];

  if (!generatedSourceDirRel) missingFields.push("docs.generatedDir");
  if (!registrySourceDirRel) missingFields.push("source.registryDir");
  if (!stylesSourceDirRel) missingFields.push("source.stylesDir");

  if (missingFields.length > 0) {
    throw new Error(
      `${primaryArtifact.id} manifest missing required primary sync fields: ${missingFields.join(", ")}`,
    );
  }

  const artGeneratedDir = resolve(
    primaryArtifact.artifactRoot,
    generatedSourceDirRel!,
  );
  const artRegistryDir = resolve(
    primaryArtifact.artifactRoot,
    registrySourceDirRel!,
  );
  const artStylesDir = resolve(
    primaryArtifact.artifactRoot,
    stylesSourceDirRel!,
  );

  ensureExists(artGeneratedDir, `${primaryArtifact.id} artifact generated data`);
  ensureExists(artRegistryDir, `${primaryArtifact.id} artifact source registry`);
  ensureExists(artStylesDir, `${primaryArtifact.id} artifact source styles`);

  resetDir(generatedDir);
  resetDir(registryDir);
  resetDir(stylesDir);

  const namespacedGenDir = resolve(generatedDir, primaryArtifact.id);
  mkdirSync(namespacedGenDir, { recursive: true });
  cpSync(artGeneratedDir, namespacedGenDir, { recursive: true });
  cpSync(artRegistryDir, registryDir, { recursive: true });
  cpSync(artStylesDir, stylesDir, { recursive: true });
}

function syncLibraryDocs(
  artifact: LoadedLibraryArtifacts,
  contentDir: string,
  generatedDir: string,
  libraryAssetsDir: string,
): void {
  const docsDir = resolve(
    artifact.artifactRoot,
    artifact.manifest.docs.contentDir,
  );
  ensureExists(docsDir, `${artifact.id} artifact docs`);
  ensureExists(resolve(docsDir, "meta.json"), `${artifact.id} docs meta`);

  const outputDir = resolve(contentDir, artifact.id);
  resetDir(outputDir);
  cpSync(docsDir, outputDir, { recursive: true, force: true });

  for (const generatedFile of artifact.generatedFiles) {
    const sourcePath = resolve(artifact.artifactRoot, generatedFile);
    ensureExists(
      sourcePath,
      `${artifact.id} generated artifact ${generatedFile}`,
    );
    const targetDir = resolve(generatedDir, artifact.id);
    mkdirSync(targetDir, { recursive: true });
    cpSync(sourcePath, resolve(targetDir, basename(generatedFile)), {
      force: true,
    });
  }

  if (!artifact.manifest.docs.assetsDir) return;
  const assetsDir = resolve(
    artifact.artifactRoot,
    artifact.manifest.docs.assetsDir,
  );
  if (!existsSync(assetsDir)) return;
  const targetAssetsDir = resolve(libraryAssetsDir, artifact.id);
  resetDir(targetAssetsDir);
  cpSync(assetsDir, targetAssetsDir, { recursive: true, force: true });
}

function writeRootMeta(
  artifacts: LoadedLibraryArtifacts[],
  contentDir: string,
): void {
  const pages = artifacts.map((artifact) => `...${artifact.id}`);
  writeJson(resolve(contentDir, "meta.json"), {
    title: "Documentation",
    root: true,
    pages,
  });
}

function syncRegistries(
  artifacts: LoadedLibraryArtifacts[],
  publicRegistryDir: string,
  origin: string,
): void {
  resetDir(publicRegistryDir);

  for (const artifact of artifacts) {
    const sourceDir = resolve(
      artifact.artifactRoot,
      artifact.manifest.registry.publicDir,
    );
    ensureExists(sourceDir, `${artifact.id} artifact public registry`);

    const outputDir = resolve(publicRegistryDir, artifact.id);
    resetDir(outputDir);
    cpSync(sourceDir, outputDir, { recursive: true, force: true });
  }

  assertNoDefaultOrigin(publicRegistryDir, origin);
}

// ── Fingerprint & Cache ──────────────────────────────────────────────

function computeSyncFingerprint(
  origin: string,
  syncSchemaVersion: number,
  artifacts: LoadedLibraryArtifacts[],
): string {
  const hash = createHash("sha256");
  hash.update(`origin:${origin}\n`);
  hash.update(`sync-schema:${syncSchemaVersion}\n`);

  for (const artifact of artifacts) {
    hash.update(`${artifact.id}:manifest:${artifact.manifestPath}\n`);
    hash.update(readFileSync(artifact.manifestPath, "utf-8"));
    hash.update("\n");
    hash.update(`${artifact.id}:fingerprint:${artifact.fingerprintPath}\n`);
    hash.update(artifact.fingerprint);
    hash.update("\n");
  }

  return hash.digest("hex");
}

interface SyncState {
  fingerprint: string;
  origin: string;
  syncedAt: string;
}

interface SyncOutputPaths {
  contentDir: string;
  generatedDir: string;
  registryDir: string;
  stylesDir: string;
  publicRegistryDir: string;
  libraryAssetsDir: string;
  stateFilePath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSyncState(stateFilePath: string): SyncState | null {
  if (!existsSync(stateFilePath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(stateFilePath, "utf-8"));
    if (!isRecord(parsed)) return null;
    if (typeof parsed.fingerprint !== "string") return null;
    if (typeof parsed.origin !== "string") return null;
    if (typeof parsed.syncedAt !== "string") return null;
    return {
      fingerprint: parsed.fingerprint,
      origin: parsed.origin,
      syncedAt: parsed.syncedAt,
    };
  } catch {
    return null;
  }
}

function writeSyncState(stateFilePath: string, state: SyncState): void {
  mkdirSync(dirname(stateFilePath), { recursive: true });
  writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`);
}

function docsOutputsExist(
  artifacts: LoadedLibraryArtifacts[],
  contentDir: string,
  registryDir: string,
  stylesDir: string,
  generatedDir: string,
  publicRegistryDir: string,
  libraryAssetsDir: string,
): boolean {
  const required = [
    resolve(contentDir, "meta.json"),
    resolve(registryDir, "registry.json"),
    resolve(stylesDir, "styles.css"),
  ];

  for (const artifact of artifacts) {
    required.push(resolve(contentDir, artifact.id, "meta.json"));
    required.push(
      resolve(publicRegistryDir, artifact.id, "registry.json"),
    );
    for (const generatedFile of artifact.generatedFiles) {
      required.push(
        resolve(generatedDir, artifact.id, basename(generatedFile)),
      );
    }

    const sourceAssetsDirRel = artifact.manifest.docs.assetsDir;
    if (!sourceAssetsDirRel) continue;

    const sourceAssetsDir = resolve(artifact.artifactRoot, sourceAssetsDirRel);
    if (existsSync(sourceAssetsDir)) {
      required.push(resolve(libraryAssetsDir, artifact.id));
    }
  }

  return required.every((filePath) => existsSync(filePath));
}

function resolveSyncOutputPaths(docsRoot: string): SyncOutputPaths {
  const cacheDir = resolve(docsRoot, ".cache");
  return {
    contentDir: resolve(docsRoot, "content/docs"),
    generatedDir: resolve(docsRoot, "src/generated"),
    registryDir: resolve(docsRoot, "registry"),
    stylesDir: resolve(docsRoot, "styles"),
    publicRegistryDir: resolve(docsRoot, "public/r"),
    libraryAssetsDir: resolve(docsRoot, "public/library-assets"),
    stateFilePath: resolve(cacheDir, "sync-artifacts-state.json"),
  };
}

function shouldSkipSync(params: {
  syncState: SyncState | null;
  syncFingerprint: string;
  artifacts: LoadedLibraryArtifacts[];
  paths: SyncOutputPaths;
}): boolean {
  const { syncState, syncFingerprint, artifacts, paths } = params;
  if (syncState?.fingerprint !== syncFingerprint) return false;

  return docsOutputsExist(
    artifacts,
    paths.contentDir,
    paths.registryDir,
    paths.stylesDir,
    paths.generatedDir,
    paths.publicRegistryDir,
    paths.libraryAssetsDir,
  );
}

function runDocsSyncPass(params: {
  artifacts: LoadedLibraryArtifacts[];
  primaryArtifact: LoadedLibraryArtifacts;
  paths: SyncOutputPaths;
  origin: string;
  afterSync?: (ctx: AfterSyncContext) => void;
}): void {
  const {
    artifacts,
    primaryArtifact,
    paths,
    origin,
    afterSync,
  } = params;

  resetDir(paths.contentDir);
  resetDir(paths.libraryAssetsDir);
  syncPrimaryArtifacts(
    primaryArtifact,
    paths.generatedDir,
    paths.registryDir,
    paths.stylesDir,
  );

  for (const artifact of artifacts) {
    syncLibraryDocs(
      artifact,
      paths.contentDir,
      paths.generatedDir,
      paths.libraryAssetsDir,
    );
    afterSync?.({
      libraryId: artifact.id,
      generatedDir: resolve(paths.generatedDir, artifact.id),
    });
  }

  writeRootMeta(artifacts, paths.contentDir);

  console.log(
    `[docs-sync] Syncing registries (origin asserted: ${origin})...`,
  );
  syncRegistries(artifacts, paths.publicRegistryDir, origin);
}

// ── Main Entry Point ─────────────────────────────────────────────────

/**
 * Syncs artifacts from multiple libraries into a docs host.
 * Handles loading (workspace or npm), fingerprint caching,
 * primary/secondary library distinction, and origin assertion.
 */
export function syncDocsFromArtifacts(options: SyncDocsOptions): SyncDocsResult {
  const {
    docsRoot,
    workspaceRoot,
    libraries,
    primaryLibraryId,
    origin,
    mode,
    syncSchemaVersion = 2,
    afterSync,
  } = options;

  const paths = resolveSyncOutputPaths(docsRoot);

  console.log(`[docs-sync] Mode: ${mode}`);

  const artifacts = libraries.map((lib) =>
    loadLibraryArtifacts(lib, mode, docsRoot, workspaceRoot),
  );

  const primaryArtifact = artifacts.find((a) => a.id === primaryLibraryId);
  if (!primaryArtifact) {
    throw new Error(
      `Primary docs artifact "${primaryLibraryId}" is not configured.`,
    );
  }

  const syncFingerprint = computeSyncFingerprint(
    origin,
    syncSchemaVersion,
    artifacts,
  );
  const syncState = readSyncState(paths.stateFilePath);

  if (shouldSkipSync({ syncState, syncFingerprint, artifacts, paths })) {
    console.log("[docs-sync] Artifacts unchanged; skipping sync.");
    return { synced: false, fingerprint: syncFingerprint, artifacts };
  }

  console.log("[docs-sync] Syncing docs and generated artifacts...");
  runDocsSyncPass({ artifacts, primaryArtifact, paths, origin, afterSync });

  writeSyncState(paths.stateFilePath, {
    fingerprint: syncFingerprint,
    origin,
    syncedAt: new Date().toISOString(),
  });

  console.log("[docs-sync] Done.");
  return { synced: true, fingerprint: syncFingerprint, artifacts };
}
