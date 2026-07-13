import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WikilinkRenderContext } from "../index.js";
import {
  AmbiguousTooltipTargetError,
  DisposedTooltipResolverError,
  TooltipContainmentError,
  createFrontmatterTooltipResolver,
} from "./index.js";

const createRoot = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), "wikilink-resolver-"));
const context = (target: string, env: unknown = {}): WikilinkRenderContext => ({
  target,
  label: target,
  defaultHref: target,
  env,
});
const writeMarkdown = (root: string, relative: string, frontmatter: string) => {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${frontmatter}\n---\n\n# Page\n`);
  return filePath;
};

describe("createFrontmatterTooltipResolver", () => {
  it("resolves explicit, same-folder, alternate-field, and unique-basename targets", () => {
    const root = createRoot();
    const source = writeMarkdown(root, "guide/source.md", "summary: Source");
    writeMarkdown(root, "guide/target.md", "description: Same folder");
    writeMarkdown(root, "other/unique.md", "description: Unique file");
    const resolver = createFrontmatterTooltipResolver({
      root,
      fields: ["", "description"],
    });

    expect(resolver.resolveTooltip(context("guide/target"))).toBe(
      "Same folder",
    );
    expect(
      resolver.resolveTooltip(context("target", { filePath: source })),
    ).toBe("Same folder");
    expect(resolver.resolveTooltip(context("unique?x=1#heading"))).toBe(
      "Unique file",
    );
    expect(resolver.resolveTooltip(context("missing"))).toBeUndefined();
    expect(resolver.resolveTooltip(context("#heading"))).toBeUndefined();
    expect(
      resolver.resolveTooltip(context("https://example.test")),
    ).toBeUndefined();
  });

  it("parses quoted and multiline YAML frontmatter with gray-matter", () => {
    const root = createRoot();
    writeMarkdown(root, "page.md", 'summary: "Quoted: value"');
    const resolver = createFrontmatterTooltipResolver({ root });
    expect(resolver.resolveTooltip(context("page"))).toBe("Quoted: value");
  });

  it("throws deterministic ambiguity errors", () => {
    const root = createRoot();
    writeMarkdown(root, "a/duplicate.md", "summary: A");
    writeMarkdown(root, "b/duplicate.md", "summary: B");
    const resolver = createFrontmatterTooltipResolver({ root });
    expect(() => resolver.resolveTooltip(context("duplicate"))).toThrow(
      AmbiguousTooltipTargetError,
    );
    try {
      resolver.resolveTooltip(context("duplicate"));
    } catch (error) {
      expect((error as AmbiguousTooltipTargetError).matches).toEqual([
        "a/duplicate.md",
        "b/duplicate.md",
      ]);
    }
  });

  it("rejects lexical traversal and hostile environment getters", () => {
    const root = createRoot();
    writeMarkdown(root, "page.md", "summary: Page");
    const resolver = createFrontmatterTooltipResolver({ root });
    expect(() => resolver.resolveTooltip(context("../../outside"))).toThrow(
      TooltipContainmentError,
    );
    const env = Object.defineProperty({}, "filePath", {
      get: () => {
        throw new Error("hostile getter");
      },
    });
    expect(resolver.resolveTooltip(context("page", env))).toBe("Page");
  });

  it("accepts a contained current-page relative candidate when the root fallback escapes", () => {
    const root = createRoot();
    const source = writeMarkdown(
      root,
      "resource/wiki/regulations/source.md",
      "summary: Source",
    );
    writeMarkdown(root, "products/target.md", "summary: Contained target");
    const resolver = createFrontmatterTooltipResolver({ root });
    expect(
      resolver.resolveTooltip(
        context("../../../products/target", { filePath: source }),
      ),
    ).toBe("Contained target");
  });

  it("rejects symlinks by default and permits only contained opt-in symlinks", () => {
    const root = createRoot();
    const target = writeMarkdown(root, "real.md", "summary: Real");
    fs.symlinkSync(target, path.join(root, "linked.md"));
    expect(() => createFrontmatterTooltipResolver({ root })).toThrow(
      /symlink/i,
    );
    const allowed = createFrontmatterTooltipResolver({
      root,
      allowSymlinks: true,
    });
    expect(allowed.resolveTooltip(context("real"))).toBe("Real");
    expect(allowed.resolveTooltip(context("linked"))).toBe("Real");

    const outside = createRoot();
    const outsideFile = writeMarkdown(
      outside,
      "outside.md",
      "summary: Outside",
    );
    fs.symlinkSync(outsideFile, path.join(root, "outside.md"));
    expect(() =>
      createFrontmatterTooltipResolver({ root, allowSymlinks: true }),
    ).toThrow(TooltipContainmentError);
  });

  it("indexes contained file and directory symlinks by their lexical aliases", () => {
    const root = createRoot();
    const realDirectory = path.join(root, "real-directory");
    writeMarkdown(root, "real-directory/page.md", "summary: Directory alias");
    const realFile = writeMarkdown(root, "real-file.md", "summary: File alias");
    fs.symlinkSync(realDirectory, path.join(root, "alias-directory"));
    fs.symlinkSync(realFile, path.join(root, "alias-file.md"));

    const resolver = createFrontmatterTooltipResolver({
      root,
      allowSymlinks: true,
    });
    expect(resolver.resolveTooltip(context("alias-directory/page"))).toBe(
      "Directory alias",
    );
    expect(resolver.resolveTooltip(context("alias-file"))).toBe("File alias");
  });

  it("never reads replacements made after an atomic refresh", () => {
    const root = createRoot();
    const safeFile = writeMarkdown(
      root,
      "target.md",
      "summary: Safe cached value",
    );
    const outside = createRoot();
    const outsideFile = writeMarkdown(
      outside,
      "secret.md",
      "summary: Outside secret",
    );
    const resolver = createFrontmatterTooltipResolver({ root });

    fs.unlinkSync(safeFile);
    fs.symlinkSync(outsideFile, safeFile);

    expect(resolver.resolveTooltip(context("target"))).toBe(
      "Safe cached value",
    );
    expect(() => resolver.refresh()).toThrow(/symlink/i);
    expect(resolver.resolveTooltip(context("target"))).toBe(
      "Safe cached value",
    );
  });

  it("never reads through a parent directory replaced after refresh", () => {
    const root = createRoot();
    writeMarkdown(root, "section/page.md", "summary: Safe parent value");
    const outside = createRoot();
    writeMarkdown(outside, "page.md", "summary: Outside parent secret");
    const resolver = createFrontmatterTooltipResolver({ root });

    fs.renameSync(path.join(root, "section"), path.join(root, "section-old"));
    fs.symlinkSync(outside, path.join(root, "section"));

    expect(resolver.resolveTooltip(context("section/page"))).toBe(
      "Safe parent value",
    );
    expect(() => resolver.refresh()).toThrow(/symlink/i);
    expect(resolver.resolveTooltip(context("section/page"))).toBe(
      "Safe parent value",
    );
  });

  it("refreshes atomically, ignores configured directories, and disposes permanently", () => {
    const root = createRoot();
    writeMarkdown(root, "excluded/hidden.md", "summary: Hidden");
    const resolver = createFrontmatterTooltipResolver({
      root,
      excludeDirectories: ["excluded"],
    });
    expect(resolver.resolveTooltip(context("hidden"))).toBeUndefined();
    writeMarkdown(root, "new.md", "summary: New");
    expect(resolver.resolveTooltip(context("new"))).toBeUndefined();
    resolver.refresh();
    expect(resolver.resolveTooltip(context("new"))).toBe("New");
    resolver.dispose();
    expect(() => resolver.resolveTooltip(context("new"))).toThrow(
      DisposedTooltipResolverError,
    );
    expect(() => resolver.refresh()).toThrow(DisposedTooltipResolverError);
    resolver.dispose();
  });

  it("rejects symlink roots and non-directory roots by default", () => {
    const root = createRoot();
    const file = writeMarkdown(root, "file.md", "summary: File");
    const link = path.join(createRoot(), "root-link");
    fs.symlinkSync(root, link);
    expect(() => createFrontmatterTooltipResolver({ root: link })).toThrow(
      /root.*symlink/i,
    );
    expect(() => createFrontmatterTooltipResolver({ root: file })).toThrow(
      /directory/i,
    );
  });

  it("surfaces malformed frontmatter and unreadable/missing roots", () => {
    const root = createRoot();
    fs.writeFileSync(
      path.join(root, "bad.md"),
      "---\nsummary: [unterminated\n---\n",
    );
    expect(() => createFrontmatterTooltipResolver({ root })).toThrow();
    expect(() =>
      createFrontmatterTooltipResolver({ root: path.join(root, "missing") }),
    ).toThrow();
  });
});
