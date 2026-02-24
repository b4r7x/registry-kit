import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildCopyBundle } from "../copy-bundle.js";

describe("buildCopyBundle (legacy hook bundle behavior)", () => {
  it("builds a copy bundle from registry metadata", () => {
    const root = mkdtempSync(join(tmpdir(), "rk-copy-bundle-"));
    mkdirSync(join(root, "registry"), { recursive: true });
    mkdirSync(join(root, "src/hooks"), { recursive: true });

    writeFileSync(
      join(root, "src/hooks/use-navigation.ts"),
      "export const useNavigation = () => null\n",
    );
    writeFileSync(
      join(root, "src/hooks/use-hidden.ts"),
      "export const useHidden = () => null\n",
    );
    writeFileSync(
      join(root, "registry/registry.json"),
      JSON.stringify({
        items: [
          {
            name: "navigation",
            type: "registry:hook",
            title: "Navigation",
            description: "Navigation hook",
            files: [{ path: "src/hooks/use-navigation.ts" }],
          },
          {
            name: "hidden-hook",
            type: "registry:hook",
            title: "Hidden",
            description: "Hidden hook",
            meta: { hidden: true },
            files: [{ path: "src/hooks/use-hidden.ts" }],
          },
          {
            name: "ui-item",
            type: "registry:ui",
            title: "UI",
            description: "Not a hook",
            files: [{ path: "src/hooks/use-navigation.ts" }],
          },
        ],
      }),
    );

    const outputPath = join(root, "copy-bundle.json");
    const result = buildCopyBundle({
      sourceRoot: root,
      outputPath,
      itemType: "registry:hook",
      pathMapping: { from: "src/hooks/", to: "hooks/" },
    });

    const output = JSON.parse(readFileSync(outputPath, "utf-8")) as {
      items: Array<{ name: string; files: Array<{ path: string; content: string }> }>;
      integrity: string;
    };

    expect(result.itemCount).toBe(1);
    expect(output.items).toHaveLength(1);
    expect(output.items[0]?.name).toBe("navigation");
    expect(output.items[0]?.files[0]?.path).toBe("hooks/use-navigation.ts");
    expect(output.items[0]?.files[0]?.content).toContain("useNavigation");
    expect(output.integrity.startsWith("sha256-")).toBe(true);
  });
});
