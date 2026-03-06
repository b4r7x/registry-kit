// Producer side (library build scripts)
export { buildRegistryArtifacts, copyArtifactsToPackage } from "./artifacts.js";
export type { CopyArtifactsToPackageOptions } from "./artifacts.js";
export {
  buildShadcnRegistryWithOrigin,
  runShadcnRegistryBuild,
  ensurePublicRegistryReady,
  validatePublicRegistryFresh,
  resolveLocalShadcnBin,
} from "./shadcn/index.js";

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

// Manifest validation & factory
export { validateManifest, ArtifactManifestSchema, createArtifactManifest } from "./manifest.js";
export type { CreateArtifactManifestOptions } from "./manifest.js";

// Shared utilities
export { ARTIFACT_MANIFEST_FILENAME, ARTIFACT_FINGERPRINT_FILENAME, ARTIFACT_MANIFEST_REL_PATH, DEFAULT_ARTIFACT_ROOT } from "./constants.js";
export { computeInputsFingerprint } from "./fingerprint.js";
export { buildCopyBundle } from "./copy-bundle.js";
export type {
  CopyBundle,
  CopyBundleItem,
  BuildCopyBundleOptions,
  BuildCopyBundleResult,
} from "./copy-bundle.js";
export {
  normalizeOrigin,
  rewriteOriginValue,
  rewriteOriginsInDir,
  rewriteOriginsInContent,
} from "./origin.js";
export { ensureExists, resetDir, collectAllFiles, collectJsonFiles, relativePath } from "./utils/fs.js";
export { readJson, writeJson } from "./utils/json.js";

// Docs data types
export type {
  DocNote,
  ExampleRef,
  UsageSection,
  HookParameter,
  HookReturn,
  HookDoc,
  CodeBlockToken,
  CodeBlockLine,
  HookSourceData,
  EnrichedHookData,
} from "./docs-data/index.js";

// Docs data utilities
export {
  createDocsHighlighter,
  highlightCode,
  generateHooksSource,
  generateEnrichedHookData,
} from "./docs-data/index.js";
export type {
  HighlightLanguage,
  DocsHighlighter,
  CreateHighlighterOptions,
  HookRegistryItem,
  GenerateHooksSourceOptions,
  GenerateEnrichedHookDataOptions,
} from "./docs-data/index.js";

// Re-export all types
export type * from "./types.js";
export { defaultLogger } from "./logger.js";
export type { Logger } from "./logger.js";
