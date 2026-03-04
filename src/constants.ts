/** Filename of the artifact manifest within an artifact directory. */
export const ARTIFACT_MANIFEST_FILENAME = "artifact-manifest.json";

/** Filename of the fingerprint file within an artifact directory. */
export const ARTIFACT_FINGERPRINT_FILENAME = "fingerprint.sha256";

/** Default relative path from a package root to the artifact manifest. */
export const ARTIFACT_MANIFEST_REL_PATH = `dist/artifacts/${ARTIFACT_MANIFEST_FILENAME}`;
