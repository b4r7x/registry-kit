// --- Shared types (used by both component docs and hook docs) ---

/** A note/callout about a hook or component behavior. */
export interface DocNote {
  title: string
  content: string
}

/** Reference to an example file. */
export interface ExampleRef {
  name: string
  title: string
}

/** Usage code section. */
export interface UsageSection {
  code?: string
  example?: string
  lang?: "tsx" | "typescript" | "css" | "bash" | "json" | "html"
}

// --- Hook-specific types ---

/** A documented parameter or property. */
export interface HookParameter {
  name: string
  type: string
  required: boolean
  description: string
  defaultValue?: string
}

/** What a hook returns. */
export interface HookReturn {
  type: string
  description: string
  properties?: HookParameter[]
}

/** Rich documentation metadata for a hook. */
export interface HookDoc {
  description?: string
  usage?: UsageSection
  parameters?: HookParameter[]
  returns?: HookReturn
  notes?: DocNote[]
  examples?: ExampleRef[]
  tags?: string[]
}

// --- Generated data types (output of build pipeline) ---

/** A single syntax-highlighted token within a code line. */
export interface CodeBlockToken {
  text: string
  color?: string
}

/** Syntax-highlighted code block line. */
export interface CodeBlockLine {
  number: number
  content: CodeBlockToken[]
  type?: "highlight" | "added" | "removed"
}

/** Basic hook source data (backward-compatible with existing format). */
export interface HookSourceData {
  name: string
  title: string
  description: string
  source: {
    raw: string
    highlighted: CodeBlockLine[]
  }
}

/** Enriched hook data — extends HookSourceData with doc metadata and examples. */
export interface EnrichedHookData extends HookSourceData {
  docs: HookDoc | null
  usageSnippet?: string
  usageSnippetHighlighted?: CodeBlockLine[]
  examples: string[]
  exampleSource: Record<string, { raw: string; highlighted: CodeBlockLine[] }>
  parameters?: HookParameter[]
  returns?: HookReturn
}
