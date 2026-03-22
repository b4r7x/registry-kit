import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { resolve } from "node:path"
import {
  createDocsHighlighter,
  type DocsHighlighter,
} from "./highlight.js"
import { docsCodeTheme, DOCS_CODE_THEME_NAME } from "./code-theme.js"
import { generateHooksSource, generateEnrichedHookData } from "./hooks-source.js"
import type { HookRegistryItem } from "./hooks-source.js"
import { generateDemoIndex, findExamples } from "./examples.js"
import { toYamlString } from "./utils.js"
import type { RegistryItem, Registry } from "../registry-types.js"
import type { EnrichedHookData } from "./types.js"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HooksConfig {
  /** Directory for MDX content pages */
  contentDir: string
  /** Extra hook items not in registry.json (e.g. keyscope provider hooks) */
  extraItems?: HookRegistryItem[]
  /** Filter which registry items are hooks (default: type === "registry:hook" && !hidden) */
  filter?: (item: RegistryItem) => boolean
  /** Transform a registry item into a HookRegistryItem (e.g. to normalize names) */
  mapItem?: (item: RegistryItem) => HookRegistryItem
  /** Load hook doc metadata from file */
  loadHookDoc: (hookName: string) => Promise<import("./types.js").HookDoc | null>
  /** If set, writes backward-compat hooks source JSON to this filename */
  backwardCompatFile?: string
  /** Items for backward-compat format (defaults to filtered registry hooks) */
  backwardCompatItems?: HookRegistryItem[]
}

export interface DemoIndexConfig {
  /** Import path prefix for lazy imports (e.g. "../../../registry/examples/keyscope") */
  importPathPrefix: string
  /** Override items to scan for demos (defaults to all processed items) */
  items?: Array<{ name: string }>
}

export interface ComponentsConfig {
  /** Directory for MDX content pages */
  contentDir: string
  /** Filter which registry items are components */
  filter: (item: RegistryItem) => boolean
  /** Process a single component, returning data to write as JSON */
  processComponent: (
    item: RegistryItem,
    highlighter: DocsHighlighter,
    registry: Registry,
  ) => Promise<Record<string, unknown> | null>
}

export interface LibsConfig {
  /** Filter which registry items are libs */
  filter: (item: RegistryItem) => boolean
  /** Output filename (e.g. "diffui-libs.json") */
  outputFile: string
}

export interface BuildDocsDataConfig {
  libraryId: string
  rootDir: string
  registryPath: string
  examplesDir: string
  outputDir: string

  hooks: HooksConfig
  demoIndex: DemoIndexConfig
  components?: ComponentsConfig
  libs?: LibsConfig
  /**
   * When true, skip generating thin MDX wrapper files for components and hooks.
   * Use this when libraries have hand-authored rich MDX in their docs/content/ directories.
   * JSON data, demo index, and meta.json are still generated.
   */
  skipMdxGeneration?: boolean
}

export interface BuildDocsDataResult {
  hooksCount: number
  componentsCount: number
  libsCount: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanDir(dir: string, ext: string): void {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    if (f.endsWith(ext)) rmSync(resolve(dir, f))
  }
}

function defaultHookFilter(item: RegistryItem): boolean {
  return item.type === "registry:hook" && !(item.meta?.hidden)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function buildDocsData(config: BuildDocsDataConfig): Promise<BuildDocsDataResult> {
  const {
    libraryId,
    rootDir,
    registryPath,
    examplesDir,
    outputDir,
    hooks: hooksConfig,
    demoIndex: demoIndexConfig,
    components: componentsConfig,
    libs: libsConfig,
    skipMdxGeneration,
  } = config

  const errors: string[] = []
  let hooksCount = 0
  let componentsCount = 0
  let libsCount = 0

  const registry: Registry = registryPath.endsWith(".json")
    ? JSON.parse(readFileSync(registryPath, "utf-8"))
    : (await import(registryPath).then((m) => m.default as Registry))

  const highlighter = await createDocsHighlighter({
    theme: docsCodeTheme,
    themeName: DOCS_CODE_THEME_NAME,
  })

  try {
    mkdirSync(outputDir, { recursive: true })

    // -------------------------------------------------------------------
    // Components (optional — diff-ui only)
    // -------------------------------------------------------------------
    if (componentsConfig) {
      const componentItems = registry.items.filter(componentsConfig.filter)
      const sortedItems = [...componentItems].sort((a, b) => a.name.localeCompare(b.name))

      const componentsDir = resolve(outputDir, "components")
      mkdirSync(componentsDir, { recursive: true })
      cleanDir(componentsDir, ".json")

      const componentDataMap: Record<string, Record<string, unknown>> = {}

      for (const item of componentItems) {
        console.log(`Processing: ${item.name}`)
        try {
          const data = await componentsConfig.processComponent(item, highlighter, registry)
          if (data) {
            componentDataMap[item.name] = data
          }
        } catch (err) {
          errors.push(String(err instanceof Error ? err.message : err))
        }
      }

      for (const [name, data] of Object.entries(componentDataMap)) {
        writeFileSync(resolve(componentsDir, `${name}.json`), JSON.stringify(data, null, 2))
      }
      componentsCount = Object.keys(componentDataMap).length
      console.log(`Wrote ${componentsCount} per-component JSON files`)

      // component-list.json
      const componentList = sortedItems
        .filter((item) => componentDataMap[item.name])
        .map((item) => ({
          name: item.name,
          title: item.title ?? item.name,
          description: (componentDataMap[item.name]?.description as string) ?? item.description ?? "",
        }))
      writeFileSync(resolve(outputDir, "component-list.json"), JSON.stringify(componentList, null, 2))
      console.log(`Wrote component-list.json (${componentList.length} entries)`)

      // Component MDX pages + meta.json
      mkdirSync(componentsConfig.contentDir, { recursive: true })

      const componentPages = sortedItems.filter((item) => componentDataMap[item.name]).map((item) => item.name)
      writeFileSync(
        resolve(componentsConfig.contentDir, "meta.json"),
        JSON.stringify({ title: "Components", pages: componentPages }, null, 2),
      )

      if (!skipMdxGeneration) {
        cleanDir(componentsConfig.contentDir, ".mdx")
        for (const item of sortedItems) {
          if (!componentDataMap[item.name]) continue
          const desc = (componentDataMap[item.name]?.description as string) ?? item.description ?? ""
          writeFileSync(
            resolve(componentsConfig.contentDir, `${item.name}.mdx`),
            `---\ntitle: ${toYamlString(item.title ?? item.name)}\ndescription: ${toYamlString(desc)}\ncomponent: ${toYamlString(item.name)}\n---\n\n<ComponentDocPage name="${item.name}" />\n`,
          )
        }
        console.log(`Wrote ${componentPages.length} component MDX pages`)
      } else {
        console.log(`Skipped component MDX generation (${componentPages.length} components, hand-authored MDX)`)
      }
    }

    // -------------------------------------------------------------------
    // Hooks
    // -------------------------------------------------------------------
    const hookFilter = hooksConfig.filter ?? defaultHookFilter
    const defaultMap = (item: RegistryItem): HookRegistryItem => ({
      name: item.name,
      title: item.title,
      description: item.description ?? "",
      files: item.files,
    })
    const mapItem = hooksConfig.mapItem ?? defaultMap
    const registryHooks: HookRegistryItem[] = registry.items
      .filter(hookFilter)
      .map(mapItem)

    const allHooks = [...registryHooks, ...(hooksConfig.extraItems ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    )

    if (allHooks.length > 0) {
      console.log(`Found ${allHooks.length} hooks (${registryHooks.length} registry + ${(hooksConfig.extraItems ?? []).length} extra)`)

      const enrichedData = await generateEnrichedHookData({
        items: allHooks,
        rootDir,
        highlighter,
        themeName: DOCS_CODE_THEME_NAME,
        loadHookDoc: hooksConfig.loadHookDoc,
        examplesDir,
      })

      const hooksDir = resolve(outputDir, "hooks")
      if (existsSync(hooksDir)) {
        rmSync(hooksDir, { recursive: true })
      }
      mkdirSync(hooksDir, { recursive: true })

      for (const [name, data] of Object.entries(enrichedData)) {
        writeFileSync(resolve(hooksDir, `${name}.json`), JSON.stringify(data, null, 2))
      }
      hooksCount = Object.keys(enrichedData).length
      console.log(`Wrote ${hooksCount} per-hook JSON files`)

      // hook-list.json
      const hookList = Object.values(enrichedData)
        .map((h) => ({ name: h.name, title: h.title }))
        .sort((a, b) => a.name.localeCompare(b.name))
      writeFileSync(resolve(outputDir, "hook-list.json"), JSON.stringify(hookList, null, 2))
      console.log(`Wrote hook-list.json (${hookList.length} entries)`)

      // Hook MDX pages + meta.json
      mkdirSync(hooksConfig.contentDir, { recursive: true })

      if (!skipMdxGeneration) {
        cleanDir(hooksConfig.contentDir, ".mdx")
        for (const hookData of Object.values(enrichedData)) {
          const description = hookData.docs?.description ?? hookData.description ?? ""
          writeFileSync(
            resolve(hooksConfig.contentDir, `${hookData.name}.mdx`),
            `---\ntitle: ${toYamlString(hookData.title)}\ndescription: ${toYamlString(description)}\nhook: ${toYamlString(hookData.name)}\n---\n\n<HookDocPage />\n`,
          )
        }
        console.log(`Wrote ${hooksCount} hook MDX pages`)
      } else {
        console.log(`Skipped hook MDX generation (${hooksCount} hooks, hand-authored MDX)`)
      }

      const metaPages = Object.values(enrichedData)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((h) => h.name)
      writeFileSync(
        resolve(hooksConfig.contentDir, "meta.json"),
        JSON.stringify({ title: "Hooks", pages: metaPages }, null, 2),
      )
      console.log(`Wrote ${hooksCount} hook MDX pages + meta.json`)

      // Backward-compat hooks source
      if (hooksConfig.backwardCompatFile) {
        const compatItems = hooksConfig.backwardCompatItems ?? registryHooks
        const basicData = generateHooksSource({
          items: compatItems,
          rootDir,
          highlighter,
          themeName: DOCS_CODE_THEME_NAME,
        })
        writeFileSync(
          resolve(outputDir, hooksConfig.backwardCompatFile),
          JSON.stringify(basicData, null, 2),
        )
        console.log(`Wrote ${hooksConfig.backwardCompatFile} (${Object.keys(basicData).length} hooks)`)
      }
    }

    // -------------------------------------------------------------------
    // Libs (optional — diff-ui only)
    // -------------------------------------------------------------------
    if (libsConfig) {
      const libItems = registry.items.filter(libsConfig.filter)
      if (libItems.length > 0) {
        const libsData = generateHooksSource({
          items: libItems,
          rootDir,
          highlighter,
          themeName: DOCS_CODE_THEME_NAME,
        })
        writeFileSync(resolve(outputDir, libsConfig.outputFile), JSON.stringify(libsData, null, 2))
        libsCount = Object.keys(libsData).length
        console.log(`Wrote ${libsConfig.outputFile} (${libsCount} libs)`)
      }
    }

    // -------------------------------------------------------------------
    // Demo index
    // -------------------------------------------------------------------
    const demoItems = demoIndexConfig.items ?? [
      ...(componentsConfig
        ? registry.items.filter(componentsConfig.filter).map((i) => ({ name: i.name }))
        : []),
      ...allHooks.map((h) => ({ name: h.name })),
    ]

    const demoIndexContent = generateDemoIndex({
      items: demoItems,
      examplesDir,
      importPathPrefix: demoIndexConfig.importPathPrefix,
      findExamplesFn: findExamples,
    })
    writeFileSync(resolve(outputDir, "demo-index.ts"), demoIndexContent)
    console.log("Wrote demo-index.ts")

    // -------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------
    if (errors.length > 0) {
      throw new Error(`Docs data build failed:\n${errors.map((e) => `- ${e}`).join("\n")}`)
    }

    console.log(`\n--- Build Summary (${libraryId}) ---`)
    if (componentsCount > 0) console.log(`Components: ${componentsCount}`)
    if (hooksCount > 0) console.log(`Hooks: ${hooksCount}`)
    if (libsCount > 0) console.log(`Libs: ${libsCount}`)
    console.log("Errors: 0")
    console.log("Build completed successfully.")
  } finally {
    highlighter.dispose()
  }

  return { hooksCount, componentsCount, libsCount, errors }
}
