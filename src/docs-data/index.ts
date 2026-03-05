export type {
  DocNote,
  ExampleRef,
  UsageSection,
  HookParameter,
  HookReturn,
  HookDoc,
  CodeBlockToken,
  CodeBlockLine,
  HookSourceData,
  EnrichedHookData,
} from "./types.js"

export {
  createDocsHighlighter,
  highlightCode,
} from "./highlight.js"
export type {
  HighlightLanguage,
  DocsHighlighter,
  CreateHighlighterOptions,
} from "./highlight.js"

export {
  generateHooksSource,
  generateEnrichedHookData,
} from "./hooks-source.js"
export type {
  HookRegistryItem,
  GenerateHooksSourceOptions,
  GenerateEnrichedHookDataOptions,
} from "./hooks-source.js"
