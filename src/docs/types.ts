import type { ArtifactManifest } from "../manifest.js";

// ── Sync Configuration ───────────────────────────────────────────────

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
  /** The origin used at build time (to detect unrewritten references). */
  sourceOrigin: string;
  /** Loading mode: workspace (dev) or package (production/CI). */
  mode: "workspace" | "package";
  /** Sync schema version for fingerprint invalidation. */
  syncSchemaVersion?: number;
  /** Optional post-processing for generated files per library. */
  afterSync?: (ctx: AfterSyncContext) => void;
  /** Override default output paths. Paths are relative to docsRoot. */
  outputPaths?: Partial<SyncOutputPathsConfig>;
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

// ── Sync Output Paths ────────────────────────────────────────────────

/** Relative paths (to docsRoot) for configuring sync output locations. */
export interface SyncOutputPathsConfig {
  contentDir: string;
  generatedDir: string;
  registryDir: string;
  stylesDir: string;
  publicRegistryDir: string;
  libraryAssetsDir: string;
  stateFile: string;
}

/** Default relative paths used when no overrides are provided. */
export const DEFAULT_OUTPUT_PATHS: SyncOutputPathsConfig = {
  contentDir: "content/docs",
  generatedDir: "src/generated",
  registryDir: "registry",
  stylesDir: "styles",
  publicRegistryDir: "public/r",
  libraryAssetsDir: "public/library-assets",
  stateFile: ".cache/sync-artifacts-state.json",
};

/** Resolved absolute paths for sync output. */
export interface SyncOutputPaths {
  contentDir: string;
  generatedDir: string;
  registryDir: string;
  stylesDir: string;
  publicRegistryDir: string;
  libraryAssetsDir: string;
  stateFilePath: string;
}

export interface SyncState {
  fingerprint: string;
  origin: string;
  syncedAt: string;
}
