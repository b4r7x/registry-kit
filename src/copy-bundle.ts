import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const HookRegistrySchema = z.object({
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

const HookCopyBundleSchema = z.object({
  hooks: z.array(
    z.object({
      name: z.string(),
      title: z.string(),
      description: z.string(),
      files: z.array(
        z.object({
          path: z.string(),
          content: z.string(),
        }),
      ),
    }),
  ),
  integrity: z.string(),
});

export type HookCopyBundle = z.infer<typeof HookCopyBundleSchema>;

export interface BuildHookCopyBundleOptions {
  sourceRoot: string;
  outputPath: string;
  registryPath?: string;
}

export interface BuildHookCopyBundleResult {
  outputPath: string;
  hookCount: number;
  integrity: string;
}

function normalizeHookFilePath(path: string): string {
  if (path.startsWith("registry/hooks/")) return path;
  if (path.startsWith("src/hooks/")) {
    return path.replace(/^src\/hooks\//, "registry/hooks/");
  }
  throw new Error(
    `Unsupported hook file path "${path}". Expected "src/hooks/*" or "registry/hooks/*".`,
  );
}

export function buildHookCopyBundle(
  options: BuildHookCopyBundleOptions,
): BuildHookCopyBundleResult {
  const {
    sourceRoot,
    outputPath,
    registryPath = "registry/registry.json",
  } = options;

  const sourceRegistryPath = resolve(sourceRoot, registryPath);
  if (!existsSync(sourceRegistryPath)) {
    throw new Error(`Registry file not found: ${sourceRegistryPath}`);
  }

  const rawRegistry = JSON.parse(readFileSync(sourceRegistryPath, "utf-8")) as unknown;
  const registry = HookRegistrySchema.parse(rawRegistry);

  const hooks = registry.items
    .filter((item) => item.type === "registry:hook" && item.meta?.hidden !== true)
    .map((item) => ({
      name: item.name,
      title: item.title ?? item.name,
      description: item.description ?? "",
      files: item.files.map((file) => {
        const filePath = resolve(sourceRoot, file.path);
        if (!existsSync(filePath)) {
          throw new Error(`Hook source file not found: ${filePath}`);
        }
        return {
          path: normalizeHookFilePath(file.path),
          content: readFileSync(filePath, "utf-8"),
        };
      }),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const contentForIntegrity = JSON.stringify({ hooks });
  const integrity = `sha256-${createHash("sha256").update(contentForIntegrity).digest("hex")}`;

  const bundle: HookCopyBundle = HookCopyBundleSchema.parse({
    hooks,
    integrity,
  });
  writeFileSync(outputPath, `${JSON.stringify(bundle, null, 2)}\n`);

  return {
    outputPath,
    hookCount: hooks.length,
    integrity,
  };
}
