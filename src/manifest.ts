import { z } from "zod/v4";

export const ArtifactManifestDocsSchema = z.object({
  contentDir: z.string().min(1),
  metaFile: z.string().min(1),
  generatedDir: z.string().min(1).optional(),
  assetsDir: z.string().min(1).optional(),
});

export const ArtifactManifestRegistrySchema = z.object({
  namespace: z.string().regex(/^@[a-z0-9][a-z0-9-]*$/),
  basePath: z.string().min(1),
  publicDir: z.string().min(1),
  index: z.string().min(1),
});

export const ArtifactManifestSourceSchema = z.object({
  registryDir: z.string().min(1).optional(),
  stylesDir: z.string().min(1).optional(),
});

export const ArtifactManifestIntegritySchema = z.object({
  algorithm: z.literal("sha256"),
  fingerprintFile: z.string().min(1),
});

export const ArtifactManifestSchema = z.object({
  schemaVersion: z.literal(1),
  library: z.string().min(1),
  package: z.string().min(1),
  version: z.string().min(1),
  artifactRoot: z.string().min(1),
  inputs: z.array(z.string().min(1)).min(1),
  docs: ArtifactManifestDocsSchema,
  registry: ArtifactManifestRegistrySchema,
  source: ArtifactManifestSourceSchema.optional(),
  generated: z.record(z.string(), z.string()).optional(),
  integrity: ArtifactManifestIntegritySchema,
});

export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;
export type ArtifactManifestDocs = z.infer<typeof ArtifactManifestDocsSchema>;
export type ArtifactManifestRegistry = z.infer<typeof ArtifactManifestRegistrySchema>;
export type ArtifactManifestIntegrity = z.infer<typeof ArtifactManifestIntegritySchema>;

export interface ValidateManifestResult {
  success: true;
  data: ArtifactManifest;
}

export interface ValidateManifestError {
  success: false;
  errors: string[];
}

export function validateManifest(data: unknown): ValidateManifestResult | ValidateManifestError {
  const result = ArtifactManifestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}
