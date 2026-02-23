import { resolve } from "node:path";
import type { SyncOutputPaths } from "./types.js";

export function resolveSyncOutputPaths(docsRoot: string): SyncOutputPaths {
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
