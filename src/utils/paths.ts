export function relativePath(base: string, filePath: string): string {
  return filePath.startsWith(`${base}/`) ? filePath.slice(base.length + 1) : filePath;
}
