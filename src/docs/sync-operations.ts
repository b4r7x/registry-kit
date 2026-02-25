import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { basename, resolve } from "node:path";
import { ensureExists, resetDir, collectJsonFiles } from "../utils/fs.js";
import { writeJson } from "../utils/json.js";
import { defaultLogger, type Logger } from "../logger.js";
import type { LoadedLibraryArtifacts, AfterSyncContext, SyncOutputPaths } from "./types.js";

/** Asserts that no references to `sourceOrigin` remain in registry output after rewriting. */
function assertNoUnrewrittenOrigin(dir: string, targetOrigin: string, sourceOrigin: string): void {
  if (targetOrigin === sourceOrigin) return;

  const offenders: string[] = [];
  for (const jsonFile of collectJsonFiles(dir)) {
    const raw = readFileSync(jsonFile, "utf-8");
    if (raw.includes(sourceOrigin)) {
      offenders.push(jsonFile);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      [
        `Found unreplaced origin "${sourceOrigin}" in registry output:`,
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
      recursive: true,
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
  title = "Documentation",
): void {
  const pages = artifacts.map((artifact) => `...${artifact.id}`);
  writeJson(resolve(contentDir, "meta.json"), {
    title,
    root: true,
    pages,
  });
}

function syncRegistries(
  artifacts: LoadedLibraryArtifacts[],
  publicRegistryDir: string,
  origin: string,
  sourceOrigin: string,
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

  assertNoUnrewrittenOrigin(publicRegistryDir, origin, sourceOrigin);
}

export function runDocsSyncPass(params: {
  artifacts: LoadedLibraryArtifacts[];
  primaryArtifact: LoadedLibraryArtifacts;
  paths: SyncOutputPaths;
  origin: string;
  sourceOrigin: string;
  afterSync?: (ctx: AfterSyncContext) => void;
  rootTitle?: string;
  logger?: Logger;
}): void {
  const {
    artifacts,
    primaryArtifact,
    paths,
    origin,
    sourceOrigin,
    afterSync,
    rootTitle,
    logger = defaultLogger,
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

  writeRootMeta(artifacts, paths.contentDir, rootTitle);

  logger.info(
    `[docs-sync] Syncing registries (origin asserted: ${origin})...`,
  );
  syncRegistries(artifacts, paths.publicRegistryDir, origin, sourceOrigin);
}
