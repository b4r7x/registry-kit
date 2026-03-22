import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Discovers example files for a registry item by scanning {examplesDir}/{itemName}/ for .tsx files.
 * Returns sorted array of bare filenames (no extension).
 */
export function findExamples(examplesDir: string, itemName: string): string[] {
  const itemDir = resolve(examplesDir, itemName);
  if (!existsSync(itemDir)) return [];

  return readdirSync(itemDir)
    .filter((fileName) => fileName.endsWith(".tsx"))
    .map((fileName) => fileName.replace(".tsx", ""))
    .sort();
}

/**
 * Generates the content string for a demo-index.ts file.
 * The file exports a `demos` Record mapping example names to React.lazy() imports.
 */
export function generateDemoIndex(config: {
  items: Array<{ name: string }>;
  examplesDir: string;
  importPathPrefix: string;
  findExamplesFn?: (examplesDir: string, itemName: string) => string[];
}): string {
  const { items, examplesDir, importPathPrefix, findExamplesFn = findExamples } = config;

  const demoImports: string[] = [];
  for (const item of items) {
    const examples = findExamplesFn(examplesDir, item.name);
    for (const exampleName of examples) {
      demoImports.push(
        `  "${exampleName}": lazy(() => import("${importPathPrefix}/${item.name}/${exampleName}")),`
      );
    }
  }

  return `import { lazy } from "react"
import type { ComponentType, LazyExoticComponent } from "react"

export const demos: Record<string, LazyExoticComponent<ComponentType>> = {
${demoImports.join("\n")}
}
`;
}
