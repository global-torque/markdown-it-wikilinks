const SAFE_EXTERNAL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);
const SCHEME_PATTERN = /^([A-Za-z][A-Za-z\d+.-]*):/;

/**
 * Options for {@link createWikilinkHref}.
 *
 * @public
 */
export interface CreateWikilinkHrefOptions {
  /** Base used for absolute local links. */
  readonly baseURL?: string;
  /** Base used for relative local links. */
  readonly relativeBaseURL?: string;
  /** Force local links to use `baseURL`. */
  readonly makeAllLinksAbsolute?: boolean;
  /** Suffix appended to non-empty local page paths. */
  readonly uriSuffix?: string;
  /** Host-owned page-path transformation. */
  readonly postProcessPagePath?: (path: string) => string;
  /** Host-owned heading transformation. */
  readonly postProcessPageHash?: (hash: string) => string;
}

interface ReferenceParts {
  readonly path: string;
  readonly query: string;
  readonly hash: string | undefined;
}

/**
 * Builds a wikilink destination without decoding existing percent escapes.
 *
 * `http`, `https`, `mailto`, and `tel` destinations pass through unchanged.
 * Other schemes are rejected with a harmless fragment destination.
 *
 * @public
 */
export function createWikilinkHref(
  target: string,
  options: CreateWikilinkHrefOptions = {},
): string {
  const cleanedTarget = removeControls(target).trim();
  const scheme = SCHEME_PATTERN.exec(cleanedTarget)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    return SAFE_EXTERNAL_SCHEMES.has(`${scheme}:`) ? cleanedTarget : "#";
  }

  const parts = splitReference(cleanedTarget);
  const transformPath =
    options.postProcessPagePath ?? defaultPostProcessPagePath;
  const transformHash =
    options.postProcessPageHash ?? defaultPostProcessPageHash;
  const transformedPath = parts.path === "" ? "" : transformPath(parts.path);
  const withSuffix = appendSuffix(
    transformedPath,
    options.uriSuffix ?? ".html",
  );
  const isAbsolute =
    options.makeAllLinksAbsolute === true ||
    parts.path.startsWith("/") ||
    transformedPath.startsWith("/");
  const hrefPath =
    withSuffix === ""
      ? ""
      : joinBase(
          isAbsolute
            ? (options.baseURL ?? "/")
            : (options.relativeBaseURL ?? "./"),
          withSuffix,
        );
  const query = parts.query;
  const hash =
    parts.hash === undefined
      ? ""
      : `#${encodeFragmentPreservingEscapes(transformHash(parts.hash))}`;

  return `${hrefPath}${query}${hash}` || "#";
}

function splitReference(target: string): ReferenceParts {
  const hashIndex = target.indexOf("#");
  const withoutHash = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const hash = hashIndex === -1 ? undefined : target.slice(hashIndex + 1);
  const queryIndex = withoutHash.indexOf("?");

  return {
    path: queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex),
    query: queryIndex === -1 ? "" : withoutHash.slice(queryIndex),
    hash,
  };
}

function appendSuffix(pagePath: string, suffix: string): string {
  if (
    pagePath === "" ||
    suffix === "" ||
    pagePath.endsWith("/") ||
    pagePath.endsWith(suffix)
  ) {
    return pagePath;
  }
  return `${pagePath}${suffix}`;
}

function joinBase(base: string, pagePath: string): string {
  const normalizedBase = removeControls(base);
  const pathWithoutRoot = pagePath.replace(/^\/+/, "");

  if (/^https?:\/\//i.test(normalizedBase)) {
    const baseWithSlash = normalizedBase.endsWith("/")
      ? normalizedBase
      : `${normalizedBase}/`;
    return new URL(pathWithoutRoot, baseWithSlash).toString();
  }

  if (
    (normalizedBase === "" || normalizedBase === "./") &&
    /^\.\.?(?:\/|$)/.test(pagePath)
  ) {
    return pagePath;
  }

  const baseWithSlash =
    normalizedBase === ""
      ? ""
      : normalizedBase.endsWith("/")
        ? normalizedBase
        : `${normalizedBase}/`;
  const joined = `${baseWithSlash}${pathWithoutRoot}`;
  return joined.replace(/\/\.\//g, "/").replace(/^\.\/\.\//, "./");
}

function defaultPostProcessPagePath(pagePath: string): string {
  return pagePath
    .trim()
    .split("/")
    .map((segment) => {
      if (segment === "." || segment === "..") {
        return segment;
      }
      return segment.replace(/[\\<>:*|"]/g, "").replace(/\s+/g, "_");
    })
    .join("/");
}

function defaultPostProcessPageHash(pageHash: string): string {
  return pageHash.trim().replace(/\s+/g, "_");
}

function encodeFragmentPreservingEscapes(fragment: string): string {
  let result = "";
  for (let index = 0; index < fragment.length; index += 1) {
    const character = fragment[index];
    if (
      character === "%" &&
      index + 2 < fragment.length &&
      /^[\dA-Fa-f]{2}$/.test(fragment.slice(index + 1, index + 3))
    ) {
      result += fragment.slice(index, index + 3);
      index += 2;
      continue;
    }
    result +=
      character === undefined || !/[\s"<>`]/u.test(character)
        ? (character ?? "")
        : encodeURIComponent(character);
  }
  return result;
}

function removeControls(value: string): string {
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (!(codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))) {
      result += character;
    }
  }
  return result;
}
