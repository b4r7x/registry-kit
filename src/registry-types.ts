export interface RegistryFile {
  path: string
  type?: string
  content?: string
}

export interface RegistryItem {
  name: string
  type: string
  title?: string
  description?: string
  files: RegistryFile[]
  dependencies?: string[]
  registryDependencies?: string[]
  meta?: Record<string, unknown>
}

export interface Registry {
  name?: string
  items: RegistryItem[]
}
