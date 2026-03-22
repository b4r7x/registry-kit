export { buildRegistryArtifacts, copyArtifactsToPackage } from "./artifacts.js";
export type { CopyArtifactsToPackageOptions } from "./artifacts.js";
export {
  buildShadcnRegistryWithOrigin,
  runShadcnRegistryBuild,
  ensurePublicRegistryReady,
  validatePublicRegistryFresh,
  resolveLocalShadcnBin,
} from "./shadcn/index.js";

export { loadArtifactsFromPackage } from "./artifact-loader.js";
export type { LoadedArtifacts, LoadFromPackageOptions } from "./artifact-loader.js";

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

export { validateManifest, ArtifactManifestSchema, createArtifactManifest } from "./manifest.js";
export type { CreateArtifactManifestOptions } from "./manifest.js";

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
  rewriteOriginsInDir,
} from "./origin.js";
export { ensureExists, resetDir } from "./utils/fs.js";

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
  AnatomyNode,
  ComponentNote,
  KeyboardSection,
  ComponentDoc,
} from "./docs-data/index.js";

export {
  createDocsHighlighter,
  highlightCode,
  generateHooksSource,
  generateEnrichedHookData,
  docsCodeTheme,
  DOCS_CODE_THEME_NAME,
  kebabToCamelCase,
  toDocExportName,
  toYamlString,
  findExamples,
  generateDemoIndex,
  buildDocsData,
} from "./docs-data/index.js";
export type {
  HighlightLanguage,
  DocsHighlighter,
  CreateHighlighterOptions,
  HookRegistryItem,
  GenerateHooksSourceOptions,
  GenerateEnrichedHookDataOptions,
  BuildDocsDataConfig,
  BuildDocsDataResult,
  HooksConfig,
  DemoIndexConfig,
  ComponentsConfig,
  LibsConfig,
} from "./docs-data/index.js";

export type { RegistryFile, RegistryItem, Registry } from "./registry-types.js";

export type * from "./types.js";
export { defaultLogger } from "./logger.js";
export type { Logger } from "./logger.js";
