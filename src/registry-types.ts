import { z } from "zod";

export const RegistryFileSchema = z.object({
  path: z.string(),
  type: z.string().optional(),
  content: z.string().optional(),
});

// NOTE: Near-identical schema exists in cli-core/src/registry.ts (adds targetPath + path traversal refine).
// Intentionally duplicated: cli-core and registry-kit have no dependency relationship.
export const RegistryItemSchema = z.object({
  name: z.string(),
  type: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  files: z.array(RegistryFileSchema),
  dependencies: z.array(z.string()).default([]),
  registryDependencies: z.array(z.string()).default([]),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const RegistrySchema = z.object({
  name: z.string().optional(),
  items: z.array(RegistryItemSchema),
});

export type RegistryFile = z.infer<typeof RegistryFileSchema>;
export type RegistryItem = z.infer<typeof RegistryItemSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
