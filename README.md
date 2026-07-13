# @global-torque/markdown-it-wikilinks

> **Public 0.2 beta candidate:** the source is under review. Do not install a
> mutable branch or reuse the earlier dirty-tree beta.2 artifact. Promotion
> requires the protected-tag beta.3 asset and named-consumer evidence.

An ESM-only markdown-it plugin for escaped Obsidian-style `[[wikilinks]]`. The
root package produces ordinary `<a>` HTML and has no Node filesystem, Vue, or
VitePress dependency. Filesystem-backed frontmatter lookup is isolated in the
explicit `./node` adapter.

## Install

```sh
pnpm add @global-torque/markdown-it-wikilinks markdown-it
```

Node 22 or newer and markdown-it 14 are supported.

## Core Usage
> [!CAUTION]
> This default-branch source is a quarantined pre-0.2 bridge, not an approved
> release candidate. Do not install it from GitHub, a branch, or npm. Use only
> a future immutable prerelease asset after its checksum, consumer evidence,
> and public release review are complete.

Framework-free ESM markdown-it plugin for Obsidian-style wikilinks.

## Installation Status

There is no supported installation command for this source revision. Mutable
GitHub dependencies and default-branch installs are prohibited. Wait for an
approved immutable prerelease asset and its published integrity evidence.

## Usage

```ts
import MarkdownIt from "markdown-it";
import wikilinks from "@global-torque/markdown-it-wikilinks";

const markdown = new MarkdownIt().use(
  wikilinks({
    uriSuffix: "",
    postProcessPagePath: (pagePath) => pagePath.toLowerCase(),
  }),
);

markdown.renderInline("[[guides/Getting Started|Read the guide]]");
// <a href="./guides/getting started" title="Read the guide">Read the guide</a>
```

The renderer supports labels, headings, queries, current-page anchors,
Unicode, and existing percent escapes. `http:`, `https:`, `mailto:`, and `tel:`
destinations pass through. Other schemes are neutralized. Relative paths stay
relative; absolute paths and `makeAllLinksAbsolute` use `baseURL`; synthetic
`/./` segments are never emitted.

This example is extracted from the packed README and executed in clean npm and
pnpm consumers:

```js clean-room
import assert from "node:assert/strict";
import { createWikilinkHref } from "@global-torque/markdown-it-wikilinks/url";

assert.equal(
  createWikilinkHref("guides/Getting Started?mode=full#Read Me", {
    uriSuffix: "",
  }),
  "./guides/Getting_Started?mode=full#Read_Me",
);
assert.equal(createWikilinkHref("javascript:alert(1)"), "#");
```

Available core options are:

- `baseURL`, `relativeBaseURL`, `makeAllLinksAbsolute`, and `uriSuffix`;
- immutable, safe-listed `htmlAttributes` (standard inert anchor attributes
  plus `aria-*` and `data-*`);
- `generatePagePathFromLabel`, `postProcessPagePath`,
  `postProcessPageHash`, and `postProcessLabel`;
- synchronous `resolveHref`, `resolveTooltip`, and `renderTooltip` callbacks.

Without `renderTooltip`, resolved tooltip text becomes a standard escaped
`title` attribute. Framework markup is explicitly host-owned:

```ts
const options = {
  resolveTooltip: ({ target }) => tooltipByTarget.get(target),
  renderTooltip: ({ anchorHtml, escapedTooltip }) =>
    `<AppTooltip>${anchorHtml}<span>${escapedTooltip}</span></AppTooltip>`,
};
```

`renderTooltip` is a trusted integration boundary. Insert `escapedTooltip`,
not raw `tooltip`, unless the host performs its own equivalent escaping.
## Options

## Contained Node Resolver

```ts
import { createFrontmatterTooltipResolver } from "@global-torque/markdown-it-wikilinks/node";

const resolver = createFrontmatterTooltipResolver({
  root: new URL("./docs", import.meta.url).pathname,
  fields: ["summary", "description"],
  excludeDirectories: ["public"],
});

const markdown = new MarkdownIt().use(
  wikilinks({ resolveTooltip: resolver.resolveTooltip }),
);

resolver.refresh();
resolver.dispose();
```

The resolver uses `gray-matter`, atomically parses and caches tooltip values
during construction/`refresh()`, resolves explicit and same-folder paths before
unique basenames, returns `undefined` for missing content, and throws on
ambiguous or malformed content. It never reads a path during link rendering.
Symlinks are rejected by default. Opted-in symlinks are indexed under their
lexical alias only when their real paths remain inside the declared real root.

## Exports

- `@global-torque/markdown-it-wikilinks`: core plugin and callback contracts;
- `@global-torque/markdown-it-wikilinks/url`: pure href builder;
- `@global-torque/markdown-it-wikilinks/node`: contained frontmatter resolver.

Generated API references are in [`docs/api`](docs/api/index.md) and
[`docs/api-node`](docs/api-node/index.md). Committed API reports are in `etc/`.

## Migration From 0.1

- Replace `generatePageNameFromLabel` with `generatePagePathFromLabel`.
- Replace `postProcessPageName` with `postProcessPagePath`.
- Remove imports of the mutable `Url` class; use `createWikilinkHref` when a
  standalone href builder is required.
- Replace root `docsRoot` and `tooltipFrontmatterField` options with a
  `createFrontmatterTooltipResolver()` instance passed through
  `resolveTooltip`.
- Move Vue or other framework wrappers into `renderTooltip` in the consuming
  application.
- Review URL snapshots: nested relative destinations change from invalid
  `/./path` output to `./path`.

Rollback by pinning the last reviewed artifact digest, reverting the consumer
callback migration, and recording the rejected beta. Never replace an existing
beta tarball or tag with different bytes.

## Security And Release State

The core escapes hrefs, labels, titles, and static attributes, ignores
attributes outside its inert anchor safe list, and revalidates both default and
host-resolved href schemes. Caller-supplied `href`, event handlers, `style`, and
other active attributes are ignored. The Node adapter treats content paths and
symlinks as untrusted. Application tooltip render callbacks remain trusted
code.

See [SECURITY.md](SECURITY.md) for private vulnerability reporting. This beta
is not supported as a production npm release.
