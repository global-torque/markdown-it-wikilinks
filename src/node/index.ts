/**
 * Contained Node filesystem adapter for wikilink frontmatter tooltips.
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { WikilinkRenderContext } from "../index.js";

export type { WikilinkRenderContext } from "../index.js";

const EXTERNAL_SCHEME_PATTERN = /^[A-Za-z][A-Za-z\d+.-]*:/;

/**
 * Options for {@link createFrontmatterTooltipResolver}.
 *
 * @public
 */
export interface FrontmatterTooltipResolverOptions {
  /** Markdown content root. */
  readonly root: string;
  /** Ordered frontmatter fields used as tooltip sources. */
  readonly fields?: readonly string[];
  /** Follow symlinks only when their real paths remain inside `root`. */
  readonly allowSymlinks?: boolean;
  /** Directory names ignored while building the markdown index. */
  readonly excludeDirectories?: readonly string[];
}

/**
 * Instance-scoped synchronous tooltip resolver.
 *
 * @public
 */
export interface FrontmatterTooltipResolver {
  /** Resolve tooltip text for a core wikilink render context. */
  readonly resolveTooltip: (
    context: WikilinkRenderContext,
  ) => string | undefined;
  /** Atomically rebuild the markdown-file index. */
  readonly refresh: () => void;
  /** Clear the index and permanently disable the instance. */
  readonly dispose: () => void;
}

/**
 * Thrown when a requested tooltip path escapes the declared content root.
 *
 * @public
 */
export class TooltipContainmentError extends Error {
  /** Rejected target. */
  readonly target: string;

  constructor(target: string) {
    super(`Tooltip target escapes the configured root: ${target}`);
    this.name = "TooltipContainmentError";
    this.target = target;
  }
}

/**
 * Thrown when a basename or case-insensitive path maps to multiple files.
 *
 * @public
 */
export class AmbiguousTooltipTargetError extends Error {
  /** Requested wikilink target. */
  readonly target: string;
  /** Sorted root-relative matches. */
  readonly matches: readonly string[];

  constructor(target: string, matches: readonly string[]) {
    const sortedMatches = Object.freeze([...matches].sort(compareCodePoints));
    super(
      `Tooltip target is ambiguous: ${target} (${sortedMatches.join(", ")})`,
    );
    this.name = "AmbiguousTooltipTargetError";
    this.target = target;
    this.matches = sortedMatches;
  }
}

/**
 * Thrown after a resolver has been disposed.
 *
 * @public
 */
export class DisposedTooltipResolverError extends Error {
  constructor() {
    super("The frontmatter tooltip resolver has been disposed.");
    this.name = "DisposedTooltipResolverError";
  }
}

interface TooltipIndexEntry {
  readonly relativePath: string;
  readonly tooltip: string | undefined;
}

interface FileIndex {
  readonly byPath: ReadonlyMap<string, readonly TooltipIndexEntry[]>;
  readonly byBasename: ReadonlyMap<string, readonly TooltipIndexEntry[]>;
}

/**
 * Creates a contained, refreshable frontmatter tooltip resolver.
 *
 * Symlinks are rejected by default. When enabled, every followed real path
 * must remain inside the real content root. Missing targets return `undefined`;
 * ambiguous targets and malformed frontmatter throw.
 *
 * @public
 */
export function createFrontmatterTooltipResolver(
  options: FrontmatterTooltipResolverOptions,
): FrontmatterTooltipResolver {
  const configuredRoot = path.resolve(options.root);
  const rootStat = fs.lstatSync(configuredRoot);
  if (rootStat.isSymbolicLink() && options.allowSymlinks !== true) {
    throw new Error(`Tooltip root must not be a symlink: ${configuredRoot}`);
  }
  const realRoot = fs.realpathSync(configuredRoot);
  if (!fs.statSync(realRoot).isDirectory()) {
    throw new Error(`Tooltip root must be a directory: ${configuredRoot}`);
  }

  const fields = Object.freeze(
    (options.fields ?? ["summary"])
      .map((field) => field.trim())
      .filter((field) => field !== ""),
  );
  const excluded = new Set(
    options.excludeDirectories ?? [".git", "node_modules"],
  );
  let disposed = false;
  let index: FileIndex = Object.freeze({
    byPath: new Map(),
    byBasename: new Map(),
  });

  const assertActive = () => {
    if (disposed) {
      throw new DisposedTooltipResolverError();
    }
  };

  const refresh = () => {
    assertActive();
    const refreshed = buildIndex(
      realRoot,
      options.allowSymlinks === true,
      excluded,
      fields,
    );
    index = refreshed;
  };

  const resolveTooltip = (
    context: WikilinkRenderContext,
  ): string | undefined => {
    assertActive();
    const targetPath = normalizeTarget(context.target);
    if (targetPath === undefined) {
      return undefined;
    }

    const candidateKeys = buildCandidateKeys(targetPath, context.env, realRoot);
    for (const candidateKey of candidateKeys) {
      const matches = index.byPath.get(candidateKey.toLowerCase()) ?? [];
      if (matches.length > 1) {
        throw new AmbiguousTooltipTargetError(
          context.target,
          toRelativeMatches(matches),
        );
      }
      if (matches[0] !== undefined) {
        return matches[0].tooltip;
      }
    }

    const basename = path.posix.basename(targetPath).toLowerCase();
    const basenameMatches = index.byBasename.get(basename) ?? [];
    if (basenameMatches.length > 1) {
      throw new AmbiguousTooltipTargetError(
        context.target,
        toRelativeMatches(basenameMatches),
      );
    }
    return basenameMatches[0] === undefined
      ? undefined
      : basenameMatches[0].tooltip;
  };

  const dispose = () => {
    index = Object.freeze({ byPath: new Map(), byBasename: new Map() });
    disposed = true;
  };

  refresh();
  return Object.freeze({ resolveTooltip, refresh, dispose });
}

function buildIndex(
  root: string,
  allowSymlinks: boolean,
  excluded: ReadonlySet<string>,
  fields: readonly string[],
): FileIndex {
  const byPath = new Map<string, TooltipIndexEntry[]>();
  const byBasename = new Map<string, TooltipIndexEntry[]>();

  const visit = (
    lexicalDirectory: string,
    physicalDirectory: string,
    ancestors: ReadonlySet<string>,
  ) => {
    const realDirectory = fs.realpathSync(physicalDirectory);
    assertContained(realDirectory, root, lexicalDirectory);
    if (ancestors.has(realDirectory)) {
      return;
    }
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(realDirectory);

    const entries = fs
      .readdirSync(realDirectory, { withFileTypes: true })
      .sort((left, right) => compareCodePoints(left.name, right.name));
    for (const entry of entries) {
      if (excluded.has(entry.name) && entry.isDirectory()) {
        continue;
      }
      const lexicalEntry = path.join(lexicalDirectory, entry.name);
      const physicalEntry = path.join(realDirectory, entry.name);
      const entryStat = fs.lstatSync(physicalEntry);
      if (entryStat.isSymbolicLink()) {
        if (!allowSymlinks) {
          throw new Error(
            `Tooltip content must not contain symlinks: ${lexicalEntry}`,
          );
        }
        const realEntry = fs.realpathSync(physicalEntry);
        assertContained(realEntry, root, lexicalEntry);
        const realStat = fs.statSync(realEntry);
        if (realStat.isDirectory()) {
          if (excluded.has(entry.name)) {
            continue;
          }
          visit(lexicalEntry, realEntry, nextAncestors);
        } else if (
          realStat.isFile() &&
          entry.name.toLowerCase().endsWith(".md")
        ) {
          addFile(
            lexicalEntry,
            realEntry,
            root,
            allowSymlinks,
            fields,
            byPath,
            byBasename,
          );
        }
      } else if (entryStat.isDirectory()) {
        visit(lexicalEntry, physicalEntry, nextAncestors);
      } else if (
        entryStat.isFile() &&
        entry.name.toLowerCase().endsWith(".md")
      ) {
        addFile(
          lexicalEntry,
          physicalEntry,
          root,
          allowSymlinks,
          fields,
          byPath,
          byBasename,
        );
      }
    }
  };

  visit(root, root, new Set());
  return Object.freeze({
    byPath: freezeIndex(byPath),
    byBasename: freezeIndex(byBasename),
  });
}

function addFile(
  lexicalFilePath: string,
  physicalFilePath: string,
  root: string,
  allowSymlinks: boolean,
  fields: readonly string[],
  byPath: Map<string, TooltipIndexEntry[]>,
  byBasename: Map<string, TooltipIndexEntry[]>,
) {
  const realFile = fs.realpathSync(physicalFilePath);
  assertContained(realFile, root, lexicalFilePath);
  const relativeWithExtension = toPosix(path.relative(root, lexicalFilePath));
  const relative = relativeWithExtension.replace(/\.md$/i, "");
  const entry = Object.freeze({
    relativePath: relativeWithExtension,
    tooltip: readTooltipSafely(
      lexicalFilePath,
      realFile,
      root,
      allowSymlinks,
      fields,
    ),
  });
  addIndexValue(byPath, relative.toLowerCase(), entry);
  addIndexValue(byBasename, path.posix.basename(relative).toLowerCase(), entry);
}

function addIndexValue(
  index: Map<string, TooltipIndexEntry[]>,
  key: string,
  value: TooltipIndexEntry,
) {
  const values = index.get(key) ?? [];
  if (!values.some(({ relativePath }) => relativePath === value.relativePath)) {
    values.push(value);
    values.sort((left, right) =>
      compareCodePoints(left.relativePath, right.relativePath),
    );
    index.set(key, values);
  }
}

function freezeIndex(
  index: Map<string, TooltipIndexEntry[]>,
): ReadonlyMap<string, readonly TooltipIndexEntry[]> {
  return new Map(
    [...index].map(([key, values]) => [key, Object.freeze([...values])]),
  );
}

function normalizeTarget(target: string): string | undefined {
  const withoutFragment = target.split("#", 1)[0] ?? "";
  const withoutQuery = withoutFragment.split("?", 1)[0] ?? "";
  if (
    withoutQuery.trim() === "" ||
    EXTERNAL_SCHEME_PATTERN.test(withoutQuery.trim())
  ) {
    return undefined;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery.trim());
  } catch {
    decoded = withoutQuery.trim();
  }
  const normalized = toPosix(decoded).replace(/\.md$/i, "");
  return normalized;
}

function buildCandidateKeys(
  target: string,
  env: unknown,
  root: string,
): readonly string[] {
  const candidates: string[] = [];
  let rejectedCandidate = false;
  const currentFile = readCurrentFile(env);
  if (currentFile !== undefined && !target.startsWith("/")) {
    const lexicalCurrent = path.isAbsolute(currentFile)
      ? path.resolve(currentFile)
      : path.resolve(root, currentFile);
    const resolvedCurrent = fs.existsSync(lexicalCurrent)
      ? fs.realpathSync(lexicalCurrent)
      : lexicalCurrent;
    assertContained(resolvedCurrent, root, currentFile);
    rejectedCandidate =
      !addCandidate(
        candidates,
        path.resolve(path.dirname(resolvedCurrent), target),
        root,
      ) || rejectedCandidate;
  }
  rejectedCandidate =
    !addCandidate(
      candidates,
      path.resolve(root, target.replace(/^\/+/, "")),
      root,
    ) || rejectedCandidate;
  if (candidates.length === 0 && rejectedCandidate) {
    throw new TooltipContainmentError(target);
  }
  return Object.freeze(candidates);
}

function addCandidate(
  candidates: string[],
  absolutePath: string,
  root: string,
): boolean {
  if (!isContained(absolutePath, root)) {
    return false;
  }
  const relative = toPosix(path.relative(root, absolutePath)).replace(
    /\.md$/i,
    "",
  );
  if (!candidates.includes(relative)) {
    candidates.push(relative);
  }
  return true;
}

function readCurrentFile(env: unknown): string | undefined {
  if (env === null || typeof env !== "object") {
    return undefined;
  }
  for (const key of ["filePath", "relativePath", "path"] as const) {
    try {
      const value = Reflect.get(env, key) as unknown;
      if (typeof value === "string" && value !== "") {
        return value;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function readTooltipSafely(
  lexicalFilePath: string,
  expectedRealFile: string,
  root: string,
  allowSymlinks: boolean,
  fields: readonly string[],
): string | undefined {
  const lexicalStat = fs.lstatSync(lexicalFilePath);
  if (lexicalStat.isSymbolicLink() && !allowSymlinks) {
    throw new Error(
      `Tooltip content must not contain symlinks: ${lexicalFilePath}`,
    );
  }
  const beforeRealFile = fs.realpathSync(lexicalFilePath);
  assertContained(beforeRealFile, root, lexicalFilePath);
  if (beforeRealFile !== expectedRealFile) {
    throw new Error(
      `Tooltip content changed during refresh: ${lexicalFilePath}`,
    );
  }

  const noFollow = fs.constants.O_NOFOLLOW;
  const descriptor = fs.openSync(
    beforeRealFile,
    fs.constants.O_RDONLY | noFollow,
  );
  let source: string;
  try {
    const afterRealFile = fs.realpathSync(lexicalFilePath);
    assertContained(afterRealFile, root, lexicalFilePath);
    if (afterRealFile !== beforeRealFile) {
      throw new Error(
        `Tooltip content changed during refresh: ${lexicalFilePath}`,
      );
    }
    const descriptorStat = fs.fstatSync(descriptor);
    const pathStat = fs.statSync(afterRealFile);
    if (
      !descriptorStat.isFile() ||
      descriptorStat.dev !== pathStat.dev ||
      descriptorStat.ino !== pathStat.ino
    ) {
      throw new Error(
        `Tooltip content changed during refresh: ${lexicalFilePath}`,
      );
    }
    source = fs.readFileSync(descriptor, "utf8");
  } finally {
    fs.closeSync(descriptor);
  }

  const parsed = matter(source);
  const data = (parsed as unknown as { readonly data: unknown }).data;
  if (data === null || typeof data !== "object") {
    return undefined;
  }
  for (const field of fields) {
    const value: unknown = Reflect.get(data, field);
    if (typeof value === "string" && value.trim() !== "") {
      return value.trim();
    }
  }
  return undefined;
}

function assertContained(candidate: string, root: string, target: string) {
  if (!isContained(candidate, root)) {
    throw new TooltipContainmentError(target);
  }
}

function isContained(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function toRelativeMatches(
  matches: readonly TooltipIndexEntry[],
): readonly string[] {
  return matches
    .map(({ relativePath }) => relativePath)
    .sort(compareCodePoints);
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function compareCodePoints(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
