import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// ── Registry Schema ──────────────────────────────────────────────────

const RegistryItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  files: z.array(z.object({ path: z.string() })),
  dependencies: z.array(z.string()).optional(),
  registryDependencies: z.array(z.string()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

const RegistrySchema = z.object({
  items: z.array(RegistryItemSchema),
});

export type RegistryItem = z.infer<typeof RegistryItemSchema>;

// ── Extraction Utilities ─────────────────────────────────────────────

export interface LoadRegistryOptions {
  /** Absolute path to registry.json. */
  registryPath: string;
}

/**
 * Load and parse a registry.json file with schema validation.
 */
export function loadRegistry(options: LoadRegistryOptions): RegistryItem[] {
  const { registryPath } = options;
  if (!existsSync(registryPath)) {
    throw new Error(`Registry file not found: ${registryPath}`);
  }
  const raw = JSON.parse(readFileSync(registryPath, "utf-8")) as unknown;
  return RegistrySchema.parse(raw).items;
}

export interface ExtractRegistryItemsOptions {
  /** Absolute path to registry source root (directory containing registry/). */
  sourceRoot: string;
  /** Path to registry.json relative to sourceRoot. */
  registryPath?: string;
  /** Filter by item type (e.g., "registry:hook"). */
  itemType?: string;
  /** Exclude hidden items (meta.hidden === true). Default: true. */
  excludeHidden?: boolean;
}

/**
 * Extract items from a registry file with optional type filtering.
 * Returns parsed items sorted by name.
 */
export function extractRegistryItems(
  options: ExtractRegistryItemsOptions,
): RegistryItem[] {
  const {
    sourceRoot,
    registryPath = "registry/registry.json",
    itemType,
    excludeHidden = true,
  } = options;

  const items = loadRegistry({
    registryPath: resolve(sourceRoot, registryPath),
  });

  return items
    .filter((item) => {
      if (itemType && item.type !== itemType) return false;
      if (excludeHidden && item.meta?.hidden === true) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
