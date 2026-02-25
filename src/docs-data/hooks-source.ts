import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
import { highlightCode, type DocsHighlighter, type HighlightLanguage } from "./highlight.js";
import type {
  CodeBlockLine,
  HookSourceData,
  EnrichedHookData,
  HookDoc,
} from "./types.js";

/** Minimal registry item shape used by hook source generation. */
export interface HookRegistryItem {
  name: string;
  title?: string;
  description?: string;
  files: Array<{ path: string }>;
}

/** Options for generating basic hook source data. */
export interface GenerateHooksSourceOptions {
  items: HookRegistryItem[];
  rootDir: string;
  highlighter: DocsHighlighter;
  themeName: string;
  lang?: HighlightLanguage;
}

/** Options for generating enriched hook data. */
export interface GenerateEnrichedHookDataOptions extends GenerateHooksSourceOptions {
  /** Function to load HookDoc for a given hook name. Returns null if no doc exists. */
  loadHookDoc: (hookName: string) => Promise<HookDoc | null>;
  /** Root directory containing example subdirectories per hook. */
  examplesDir?: string;
}

/**
 * Reads hook source files and returns highlighted source data keyed by hook name.
 * This is the basic version — backward-compatible with existing keyscope-hooks.json format.
 */
export function generateHooksSource(
  options: GenerateHooksSourceOptions
): Record<string, HookSourceData> {
  const { items, rootDir, highlighter, themeName, lang = "typescript" } = options;
  const data: Record<string, HookSourceData> = {};

  for (const item of items) {
    for (const file of item.files) {
      const hookPath = resolve(rootDir, file.path);
      if (!existsSync(hookPath)) {
        console.warn(`  Hook file not found: ${file.path}`);
        continue;
      }

      const raw = readFileSync(hookPath, "utf-8");
      data[item.name] = {
        name: item.name,
        title: item.title ?? item.name,
        description: item.description ?? "",
        source: {
          raw,
          highlighted: highlightCode(highlighter, raw, lang, themeName),
        },
      };
    }
  }

  return data;
}

/**
 * Generates enriched hook data by merging registry items with HookDoc metadata,
 * usage snippets, and example source code.
 */
export async function generateEnrichedHookData(
  options: GenerateEnrichedHookDataOptions
): Promise<Record<string, EnrichedHookData>> {
  const {
    items,
    rootDir,
    highlighter,
    themeName,
    lang = "typescript",
    loadHookDoc,
    examplesDir,
  } = options;

  const data: Record<string, EnrichedHookData> = {};

  for (const item of items) {
    const file = item.files[0];
    if (!file?.path) continue;
    const hookPath = resolve(rootDir, file.path);
    if (!existsSync(hookPath)) {
      console.warn(`  Hook file not found: ${file.path}`);
      continue;
    }

    const raw = readFileSync(hookPath, "utf-8");
    const highlighted = highlightCode(highlighter, raw, lang, themeName);

    const docs = await loadHookDoc(item.name);

    let usageSnippet: string | undefined;
    let usageSnippetHighlighted: CodeBlockLine[] | undefined;
    if (docs?.usage?.code) {
      usageSnippet = docs.usage.code;
      const usageLang = docs.usage.lang ?? "tsx";
      usageSnippetHighlighted = highlightCode(highlighter, docs.usage.code, usageLang, themeName);
    } else if (docs?.usage?.example && examplesDir) {
      const exampleFile = findExampleFile(examplesDir, item.name, docs.usage.example);
      if (exampleFile) {
        usageSnippet = readFileSync(exampleFile, "utf-8");
        usageSnippetHighlighted = highlightCode(highlighter, usageSnippet, "tsx", themeName);
      }
    }

    const examples: string[] = [];
    const exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }> = {};

    if (examplesDir) {
      const hookExamplesDir = resolve(examplesDir, item.name);
      if (existsSync(hookExamplesDir)) {
        const exampleFiles = readdirSync(hookExamplesDir)
          .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
          .sort();

        for (const ef of exampleFiles) {
          const exampleName = basename(ef, ef.endsWith(".tsx") ? ".tsx" : ".ts");
          const examplePath = resolve(hookExamplesDir, ef);
          const exampleRaw = readFileSync(examplePath, "utf-8");

          examples.push(exampleName);
          exampleSource[exampleName] = {
            raw: exampleRaw,
            highlighted: highlightCode(highlighter, exampleRaw, "tsx", themeName),
          };
        }
      }
    }

    data[item.name] = {
      name: item.name,
      title: item.title ?? item.name,
      description: docs?.description ?? item.description ?? "",
      source: { raw, highlighted },
      docs,
      usageSnippet,
      usageSnippetHighlighted,
      examples,
      exampleSource,
      parameters: docs?.parameters,
      returns: docs?.returns,
    };
  }

  return data;
}

function findExampleFile(
  examplesDir: string,
  hookName: string,
  exampleName: string
): string | null {
  const hookDir = resolve(examplesDir, hookName);
  if (!existsSync(hookDir)) return null;

  for (const ext of [".tsx", ".ts"]) {
    const filePath = resolve(hookDir, `${exampleName}${ext}`);
    if (existsSync(filePath)) return filePath;
  }
  return null;
}
