import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureExists } from "../utils/fs.js";
import { readJson } from "../utils/json.js";

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
