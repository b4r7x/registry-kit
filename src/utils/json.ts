import { readFileSync, writeFileSync } from "node:fs";

export function readJson<T = unknown>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

export function writeJson(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
