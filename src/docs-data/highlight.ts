import {
  createHighlighterCore,
  type ThemedToken,
  type LanguageInput,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { CodeBlockLine } from "./types.js";

export type HighlightLanguage =
  | "tsx"
  | "typescript"
  | "css"
  | "bash"
  | "json"
  | "html";

export interface CreateHighlighterOptions {
  theme: Record<string, unknown>;
  themeName: string;
  langs?: LanguageInput[];
}

export type DocsHighlighter = Awaited<ReturnType<typeof createHighlighterCore>>;

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]!);
}

function tokensToCodeBlockLines(lines: ThemedToken[][]): CodeBlockLine[] {
  return lines.map((lineTokens, i) => ({
    number: i + 1,
    content: lineTokens
      .map(
        (t) => `<span style="color:${t.color}">${escapeHtml(t.content)}</span>`
      )
      .join(""),
  }));
}

const DEFAULT_LANGS = [
  import("shiki/langs/tsx.mjs"),
  import("shiki/langs/typescript.mjs"),
  import("shiki/langs/css.mjs"),
  import("shiki/langs/bash.mjs"),
  import("shiki/langs/json.mjs"),
  import("shiki/langs/html.mjs"),
];

export async function createDocsHighlighter(
  options: CreateHighlighterOptions
): Promise<DocsHighlighter> {
  return createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [options.theme],
    langs: options.langs ?? DEFAULT_LANGS,
  });
}

export function highlightCode(
  highlighter: DocsHighlighter,
  code: string,
  lang: HighlightLanguage = "tsx",
  themeName: string
): CodeBlockLine[] {
  const result = highlighter.codeToTokensBase(code, {
    lang,
    theme: themeName,
  });
  return tokensToCodeBlockLines(result);
}
