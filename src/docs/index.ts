import { loadLibraryArtifacts } from "./loader.js";
import { runDocsSyncPass } from "./sync-operations.js";
import {
  computeSyncFingerprint,
  readSyncState,
  writeSyncState,
  shouldSkipSync,
} from "./cache.js";
import { resolveSyncOutputPaths } from "./paths.js";
import type { SyncDocsOptions, SyncDocsResult } from "./types.js";

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
    sourceOrigin,
    mode,
    syncSchemaVersion = 2,
    afterSync,
    outputPaths: outputPathOverrides,
  } = options;

  const paths = resolveSyncOutputPaths(docsRoot, outputPathOverrides);

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
  runDocsSyncPass({ artifacts, primaryArtifact, paths, origin, sourceOrigin, afterSync });

  writeSyncState(paths.stateFilePath, {
    fingerprint: syncFingerprint,
    origin,
    syncedAt: new Date().toISOString(),
  });

  console.log("[docs-sync] Done.");
  return { synced: true, fingerprint: syncFingerprint, artifacts };
}

// Re-export all public types
export type {
  SyncDocsOptions,
  SyncDocsResult,
  SyncLibraryConfig,
  LoadedLibraryArtifacts,
  AfterSyncContext,
  SyncOutputPaths,
  SyncState,
} from "./types.js";
