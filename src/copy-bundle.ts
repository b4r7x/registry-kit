import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// ── Generic Copy Bundle ──────────────────────────────────────────────

const RegistrySchema = z.object({
  items: z.array(z.object({
    name: z.string(),
    type: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
    files: z.array(z.object({
      path: z.string(),
    })),
    meta: z.record(z.string(), z.unknown()).optional(),
  })),
});

const CopyBundleItemSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
});

export type CopyBundleItem = z.infer<typeof CopyBundleItemSchema>;

export interface CopyBundle {
  items: CopyBundleItem[];
  integrity: string;
}

export interface BuildCopyBundleOptions {
  sourceRoot: string;
  outputPath: string;
  registryPath?: string;
  /** Filter items by type (e.g., "registry:hook", "registry:ui"). */
  itemType: string;
  /** Path prefix mapping: source prefix → output prefix. */
  pathMapping?: { from: string; to: string };
}

export interface BuildCopyBundleResult {
  outputPath: string;
  itemCount: number;
  integrity: string;
}

function normalizeFilePath(
  path: string,
  mapping?: { from: string; to: string },
): string {
  if (!mapping) return path;
  if (path.startsWith(mapping.to)) return path;
  if (path.startsWith(mapping.from)) {
    return path.replace(mapping.from, mapping.to);
  }
  throw new Error(
    `Unsupported file path "${path}". Expected "${mapping.from}*" or "${mapping.to}*".`,
  );
}

export function buildCopyBundle(
  options: BuildCopyBundleOptions,
): BuildCopyBundleResult {
  const {
    sourceRoot,
    outputPath,
    registryPath = "registry/registry.json",
    itemType,
    pathMapping,
  } = options;

  const sourceRegistryPath = resolve(sourceRoot, registryPath);
  if (!existsSync(sourceRegistryPath)) {
    throw new Error(`Registry file not found: ${sourceRegistryPath}`);
  }

  const rawRegistry = JSON.parse(readFileSync(sourceRegistryPath, "utf-8")) as unknown;
  const registry = RegistrySchema.parse(rawRegistry);

  const items = registry.items
    .filter((item) => item.type === itemType && item.meta?.hidden !== true)
    .map((item) => ({
      name: item.name,
      title: item.title ?? item.name,
      description: item.description ?? "",
      files: item.files.map((file) => {
        const filePath = resolve(sourceRoot, file.path);
        if (!existsSync(filePath)) {
          throw new Error(`Source file not found: ${filePath}`);
        }
        return {
          path: normalizeFilePath(file.path, pathMapping),
          content: readFileSync(filePath, "utf-8"),
        };
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const contentForIntegrity = JSON.stringify({ items });
  const integrity = `sha256-${createHash("sha256").update(contentForIntegrity).digest("hex")}`;

  const bundle: CopyBundle = { items, integrity };
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);

  return {
    outputPath,
    itemCount: items.length,
    integrity,
  };
}
