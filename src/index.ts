// Producer side (library build scripts)
export { buildRegistryArtifacts } from "./artifacts.js";
export {
  buildShadcnRegistryWithOrigin,
  runShadcnRegistryBuild,
  ensurePublicRegistryReady,
  validatePublicRegistryFresh,
  resolveLocalShadcnBin,
} from "./shadcn-build.js";

// Consumer side (docs host / artifact loading)
export { loadArtifactsFromPackage } from "./artifact-loader.js";
export type { LoadedArtifacts, LoadFromPackageOptions } from "./artifact-loader.js";

// Consumer side (docs host / artifact sync)
export { syncDocsFromArtifacts } from "./docs-sync.js";
export type {
  SyncDocsOptions,
  SyncDocsResult,
  SyncLibraryConfig,
  LoadedLibraryArtifacts,
  AfterSyncContext,
} from "./docs-sync.js";

// Manifest validation
export { validateManifest, ArtifactManifestSchema } from "./manifest.js";

// Shared utilities
export { computeInputsFingerprint } from "./fingerprint.js";
export { buildHookCopyBundle } from "./copy-bundle.js";
export type { HookCopyBundle, BuildHookCopyBundleOptions, BuildHookCopyBundleResult } from "./copy-bundle.js";
export {
  normalizeOrigin,
  rewriteOriginValue,
  rewriteOriginsInDir,
  rewriteOriginsInContent,
  DEFAULT_REGISTRY_ORIGIN,
} from "./origin.js";
export { ensureExists, resetDir, collectAllFiles, collectJsonFiles } from "./utils/fs.js";
export { readJson, writeJson } from "./utils/json.js";
export { relativePath } from "./utils/paths.js";

// Re-export all types
export type * from "./types.js";
