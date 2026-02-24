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
export { syncDocsFromArtifacts } from "./docs/index.js";
export { resolveSyncOutputPaths } from "./docs/paths.js";
export type {
  SyncDocsOptions,
  SyncDocsResult,
  SyncLibraryConfig,
  SyncOutputPathsConfig,
  LoadedLibraryArtifacts,
  AfterSyncContext,
} from "./docs/types.js";
export { DEFAULT_OUTPUT_PATHS } from "./docs/types.js";

// Manifest validation
export { validateManifest, ArtifactManifestSchema } from "./manifest.js";

// Shared utilities
export { computeInputsFingerprint } from "./fingerprint.js";
export { buildCopyBundle, buildHookCopyBundle } from "./copy-bundle.js";
export type {
  CopyBundle,
  CopyBundleItem,
  BuildCopyBundleOptions,
  BuildCopyBundleResult,
  HookCopyBundle,
  BuildHookCopyBundleOptions,
  BuildHookCopyBundleResult,
} from "./copy-bundle.js";
export {
  normalizeOrigin,
  rewriteOriginValue,
  rewriteOriginsInDir,
  rewriteOriginsInContent,
} from "./origin.js";
export { ensureExists, resetDir, collectAllFiles, collectJsonFiles, relativePath } from "./utils/fs.js";
export { readJson, writeJson } from "./utils/json.js";

// Registry item extraction
export { loadRegistry, extractRegistryItems } from "./registry-utils.js";
export type { RegistryItem, LoadRegistryOptions, ExtractRegistryItemsOptions } from "./registry-utils.js";

// Re-export all types
export type * from "./types.js";
