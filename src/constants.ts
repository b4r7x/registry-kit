/** Filename of the artifact manifest within an artifact directory. */
export const ARTIFACT_MANIFEST_FILENAME = "artifact-manifest.json";

/** Filename of the fingerprint file within an artifact directory. */
export const ARTIFACT_FINGERPRINT_FILENAME = "fingerprint.sha256";

/** Default artifact output directory relative to package root. */
export const DEFAULT_ARTIFACT_ROOT = "dist/artifacts";

/** Default relative path from a package root to the artifact manifest. */
export const ARTIFACT_MANIFEST_REL_PATH = `${DEFAULT_ARTIFACT_ROOT}/${ARTIFACT_MANIFEST_FILENAME}`;
