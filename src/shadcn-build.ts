import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { normalizeOrigin, rewriteOriginsInDir } from "./origin.js";
import { ensureExists, resetDir } from "./utils/fs.js";
import { readJson } from "./utils/json.js";

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

export function resolveLocalShadcnBin(rootDir: string): string | undefined {
  const candidates = [
    resolve(rootDir, "node_modules/.bin/shadcn"),
    resolve(rootDir, "../node_modules/.bin/shadcn"),
    resolve(rootDir, "../../node_modules/.bin/shadcn"),
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

export interface RunShadcnRegistryBuildOptions {
  rootDir: string;
  registryPath?: string;
  outputDir?: string;
}

export function runShadcnRegistryBuild(options: RunShadcnRegistryBuildOptions): void {
  const {
    rootDir,
    registryPath = "registry/registry.json",
    outputDir = "public/r",
  } = options;

  const localBin = resolveLocalShadcnBin(rootDir);
  const args = ["build", registryPath, "--output", outputDir];
  if (!localBin) {
    throw new Error(
      [
        "Local shadcn CLI binary not found.",
        "Install dependencies so node_modules/.bin/shadcn exists.",
      ].join("\n"),
    );
  }

  resetDir(resolve(rootDir, outputDir));
  run(localBin, args, rootDir);

  // shadcn build does not emit a registry.json index file; copy source registry
  // into public/r/ so downstream validators and artifact consumers find it.
  const sourceRegistryPath = resolve(rootDir, registryPath);
  const publicRegistryIndexPath = resolve(rootDir, outputDir, "registry.json");
  copyFileSync(sourceRegistryPath, publicRegistryIndexPath);
}

interface EnsureSameStringArrayParams {
  label: string;
  a: string[] | undefined;
  b: string[] | undefined;
  itemName: string;
  fixCommand: string;
}

function ensureSameStringArray({ label, a, b, itemName, fixCommand }: EnsureSameStringArrayParams): void {
  const left = JSON.stringify(a ?? []);
  const right = JSON.stringify(b ?? []);
  if (left !== right) {
    throw new Error(
      [
        `Public registry is stale for "${itemName}" (${label} mismatch).`,
        `Run: ${fixCommand}`,
      ].join("\n"),
    );
  }
}

export interface ValidatePublicRegistryFreshOptions {
  rootDir: string;
  fixCommand: string;
  sourceRegistryPath?: string;
  publicRegistryDir?: string;
}

interface RegistryItem {
  name: string;
  dependencies?: string[];
  registryDependencies?: string[];
  files?: Array<{ path: string; content?: string }>;
}

interface RegistryIndex {
  items?: RegistryItem[];
}

export function validatePublicRegistryFresh(options: ValidatePublicRegistryFreshOptions): void {
  const {
    rootDir,
    fixCommand,
    sourceRegistryPath = "registry/registry.json",
    publicRegistryDir = "public/r",
  } = options;

  const sourceRegistry = readJson<RegistryIndex>(resolve(rootDir, sourceRegistryPath));
  const publicRegistry = readJson<RegistryIndex>(resolve(rootDir, publicRegistryDir, "registry.json"));
  const sourceItems = sourceRegistry.items ?? [];
  const publicItems = publicRegistry.items ?? [];
  const publicByName = new Map(publicItems.map((item) => [item.name, item]));

  if (sourceItems.length !== publicItems.length) {
    throw new Error(
      [
        "Public registry item count does not match source registry.",
        `Run: ${fixCommand}`,
      ].join("\n"),
    );
  }

  for (const sourceItem of sourceItems) {
    const publicItem = publicByName.get(sourceItem.name);
    if (!publicItem) {
      throw new Error(
        [
          `Public registry missing item "${sourceItem.name}".`,
          `Run: ${fixCommand}`,
        ].join("\n"),
      );
    }

    ensureSameStringArray({
      label: "dependencies",
      a: sourceItem.dependencies,
      b: publicItem.dependencies,
      itemName: sourceItem.name,
      fixCommand,
    });
    ensureSameStringArray({
      label: "registryDependencies",
      a: sourceItem.registryDependencies,
      b: publicItem.registryDependencies,
      itemName: sourceItem.name,
      fixCommand,
    });

    const publicItemPath = resolve(rootDir, publicRegistryDir, `${sourceItem.name}.json`);
    ensureExists(publicItemPath, `public registry item JSON (${sourceItem.name})`);

    const publicItemJson = readJson<{ files?: Array<{ path: string; content?: string }> }>(publicItemPath);
    const publicFilesByPath = new Map((publicItemJson.files ?? []).map((file) => [file.path, file]));

    for (const sourceFile of sourceItem.files ?? []) {
      const sourcePath = resolve(rootDir, sourceFile.path);
      ensureExists(sourcePath, `source registry file (${sourceItem.name})`);

      const sourceContent = readFileSync(sourcePath, "utf-8");
      const publicFile = publicFilesByPath.get(sourceFile.path);

      if (!publicFile || typeof publicFile.content !== "string") {
        throw new Error(
          [
            `Public registry file "${sourceFile.path}" missing for "${sourceItem.name}".`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }

      if (publicFile.content !== sourceContent) {
        throw new Error(
          [
            `Public registry file content is stale for "${sourceFile.path}" (${sourceItem.name}).`,
            `Run: ${fixCommand}`,
          ].join("\n"),
        );
      }
    }
  }
}

export interface EnsurePublicRegistryReadyOptions {
  rootDir: string;
  fixCommand: string;
  sourceRegistryPath?: string;
  publicRegistryDir?: string;
  registryPath?: string;
  outputDir?: string;
  label?: string;
}

export function ensurePublicRegistryReady(options: EnsurePublicRegistryReadyOptions): void {
  const {
    rootDir,
    fixCommand,
    sourceRegistryPath = "registry/registry.json",
    publicRegistryDir = "public/r",
    registryPath = sourceRegistryPath,
    outputDir = publicRegistryDir,
    label = "public registry index",
  } = options;

  const publicRegistryIndex = resolve(rootDir, publicRegistryDir, "registry.json");
  const hasLocalShadcn = Boolean(resolveLocalShadcnBin(rootDir));

  if (!existsSync(publicRegistryIndex)) {
    if (!hasLocalShadcn) {
      throw new Error(
        [
          `${label} is missing and local shadcn binary is unavailable.`,
          `Expected: ${publicRegistryIndex}`,
          `Run: ${fixCommand}`,
        ].join("\n"),
      );
    }

    runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
  }

  try {
    validatePublicRegistryFresh({ rootDir, fixCommand, sourceRegistryPath, publicRegistryDir });
  } catch (error) {
    if (!hasLocalShadcn) throw error;

    runShadcnRegistryBuild({ rootDir, registryPath, outputDir });
    validatePublicRegistryFresh({ rootDir, fixCommand, sourceRegistryPath, publicRegistryDir });
  }
}

export interface BuildShadcnRegistryWithOriginOptions {
  rootDir: string;
  registryPath?: string;
  outputDir?: string;
  originRaw?: string;
  defaultOrigin: string;
  fromOrigin?: string;
  beforeBuild?: () => void;
}

export interface BuildShadcnRegistryWithOriginResult {
  origin: string;
  outputDir: string;
}

export function buildShadcnRegistryWithOrigin(options: BuildShadcnRegistryWithOriginOptions): BuildShadcnRegistryWithOriginResult {
  const {
    rootDir,
    registryPath = "registry/registry.json",
    outputDir = "public/r",
    originRaw = process.env.REGISTRY_ORIGIN,
    defaultOrigin,
    fromOrigin = defaultOrigin,
    beforeBuild,
  } = options;

  if (typeof beforeBuild === "function") {
    beforeBuild();
  }

  runShadcnRegistryBuild({ rootDir, registryPath, outputDir });

  const origin = normalizeOrigin(originRaw, { defaultOrigin });
  rewriteOriginsInDir(resolve(rootDir, outputDir), {
    fromOrigin,
    toOrigin: origin,
  });

  return {
    origin,
    outputDir: resolve(rootDir, outputDir),
  };
}
