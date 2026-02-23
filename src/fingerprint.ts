import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { collectAllFiles } from "./utils/fs.js";
import { relativePath } from "./utils/paths.js";

export function computeInputsFingerprint(rootDir: string, inputs: string[]): string {
  const hash = createHash("sha256");

  for (const inputRel of inputs) {
    const inputAbs = resolve(rootDir, inputRel);
    if (!existsSync(inputAbs)) continue;
    const stats = statSync(inputAbs);

    if (stats.isDirectory()) {
      const files = collectAllFiles(inputAbs).sort((a, b) => a.localeCompare(b));
      for (const filePath of files) {
        hash.update(relativePath(rootDir, filePath));
        hash.update("\n");
        hash.update(readFileSync(filePath));
        hash.update("\n");
      }
      continue;
    }

    hash.update(inputRel);
    hash.update("\n");
    hash.update(readFileSync(inputAbs));
    hash.update("\n");
  }

  return hash.digest("hex");
}
