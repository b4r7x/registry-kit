# registry-kit

Reusable engine for building shadcn-compatible registries, publishing artifacts, and syncing multi-library documentation. Published as `@b4r7x/registry-kit`.

## What This Package Provides

### Producer Side (Library Build Scripts)
Functions used by libraries (keyscope, diff-ui) to build their artifacts:
- `buildRegistryArtifacts(options)` — orchestrate full artifact build: copy dirs, rewrite origins, compute fingerprint, write manifest
- `buildShadcnRegistryWithOrigin(options)` — build shadcn-compatible registry with origin URL configuration
- `runShadcnRegistryBuild(options)` — execute shadcn CLI for registry generation
- `ensurePublicRegistryReady()` / `validatePublicRegistryFresh()` — registry validation

### Consumer Side (Docs Host)
Functions used by the docs app to consume library artifacts:
- `syncDocsFromArtifacts(options)` — full sync orchestration: load libraries, cache via fingerprinting, copy docs/registry/styles
- `loadArtifactsFromPackage(packageName)` — load artifacts from npm-installed packages using Node module resolution

### Shared Utilities
- `computeInputsFingerprint()` — SHA-256 hashing of source files for change detection
- `validateManifest()` / `ArtifactManifestSchema` — Zod-based manifest validation (schema v1)
- `normalizeOrigin()` / `rewriteOriginValue()` / `rewriteOriginsInDir()` — registry origin URL rewriting
- `buildHookCopyBundle()` — generate hook copy bundles with integrity hashing
- File system helpers: `ensureExists`, `resetDir`, `collectAllFiles`, `collectJsonFiles`
- JSON helpers: `readJson`, `writeJson`

## Structure

```
src/
├── index.ts              # barrel exports
├── artifacts.ts          # producer API: build artifacts
├── artifact-loader.ts    # consumer API: load from npm packages
├── manifest.ts           # Zod validation for artifact manifests
├── origin.ts             # origin URL rewriting
├── fingerprint.ts        # SHA-256 input fingerprinting
├── copy-bundle.ts        # hook copy bundle generation
├── types.ts              # shared type exports
├── shadcn/
│   ├── index.ts          # re-exports from runner, validate, build
│   ├── runner.ts         # shadcn CLI invocation
│   ├── validate.ts       # public registry freshness validation
│   └── build.ts          # build orchestration with origin rewriting
├── docs/
│   ├── index.ts          # sync orchestrator
│   ├── types.ts          # configuration types
│   ├── loader.ts         # load artifacts from workspace/npm
│   ├── sync-operations.ts # copy/sync logic
│   ├── cache.ts          # fingerprint-based caching
│   └── paths.ts          # output path resolution
├── utils/
│   ├── fs.ts             # filesystem helpers
│   └── json.ts           # JSON I/O helpers
└── __tests__/
    └── fingerprint.test.ts
```

## Data Flow

```
Library (keyscope/diff-ui)              Docs Host (diffgazer/apps/docs)
┌─────────────────────────┐            ┌──────────────────────────────┐
│ buildRegistryArtifacts() │            │ syncDocsFromArtifacts()      │
│   ↓                     │            │   ↓                          │
│ artifact-manifest.json  │ ────────── │ loadArtifactsFromPackage()   │
│ fingerprint.sha256      │            │   ↓                          │
│ docs/ registry/ styles/ │            │ sync docs, registry, styles  │
└─────────────────────────┘            │   ↓                          │
                                       │ content/docs/{lib}/          │
                                       │ registry/ public/r/          │
                                       └──────────────────────────────┘
```

## Artifact Manifest Schema (v1)

```json
{
  "schemaVersion": 1,
  "library": "diff-ui",
  "package": "diffui",
  "version": "0.1.0",
  "artifactRoot": "dist/artifacts",
  "docs": { "contentDir": "docs/content", "metaFile": "docs/content/meta.json" },
  "registry": { "namespace": "@diffui", "basePath": "/r/diff-ui", "publicDir": "public/r" },
  "integrity": { "algorithm": "sha256", "fingerprintFile": "fingerprint.sha256" }
}
```

## Commands

```bash
pnpm build          # tsc → dist/
pnpm type-check     # tsc --noEmit
pnpm test           # vitest
```

## Conventions

- Only production dependency: Zod (for manifest validation)
- Independent of cli-core (no dependency)
- All sync operations use fingerprint-based caching (skip unchanged)
- Artifacts always include manifest + fingerprint for integrity verification
- Mode auto-detection: `DIFFGAZER_DEV=1` → workspace, `CI=1` → package

### Implicit dependencies

- `shadcn` CLI binary — Required by `runShadcnRegistryBuild()` / `ensurePublicRegistryReady()`. Must be installed in the consuming project's `node_modules/.bin/`. Resolved via `resolveLocalShadcnBin()` (checks 3 levels up).

## Known Limitations

- Output paths in `docs/paths.ts` are currently hardcoded (`content/docs`, `src/generated`, etc.) — making configurable is planned
- `buildHookCopyBundle` only supports `registry:hook` type — generalization planned
- Internal `resolveSyncOutputPaths()` not exported — planned export for advanced use
