import { existsSync } from "node:fs"
import { resolve } from "node:path"
import type { HookDoc } from "./types.js"

export function kebabToCamelCase(str: string): string {
  return str
    .split("-")
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("")
}

export function toDocExportName(name: string): string {
  return kebabToCamelCase(name) + "Doc"
}

export function toYamlString(value: string): string {
  return JSON.stringify(value)
}

/**
 * Creates a function that loads hook documentation from `.ts` files in a directory.
 * Each file should have a named export matching the camelCase form of the filename + "Doc".
 */
export function createHookDocLoader(
  docsDir: string,
  fileNameTransform?: (hookName: string) => string,
): (hookName: string) => Promise<HookDoc | null> {
  return async (hookName: string): Promise<HookDoc | null> => {
    const fileName = fileNameTransform ? fileNameTransform(hookName) : hookName
    const docPath = resolve(docsDir, `${fileName}.ts`)
    if (!existsSync(docPath)) return null
    try {
      const mod = await import(docPath) as Record<string, unknown>
      const exportName = toDocExportName(fileName)
      return (mod[exportName] as HookDoc) ?? null
    } catch {
      return null
    }
  }
}
