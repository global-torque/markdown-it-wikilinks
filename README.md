# @global-torque/markdown-it-wikilinks

Framework-free ESM markdown-it plugin for Obsidian-style wikilinks.

This package is released publicly as `@global-torque/markdown-it-wikilinks`.

## Install

```sh
pnpm add markdown-it @global-torque/markdown-it-wikilinks
```

Before npm publication, pinned GitHub bridge installs may use:

```json
{
  "dependencies": {
    "@global-torque/markdown-it-wikilinks": "github:global-torque/markdown-it-wikilinks#master"
  }
}
```

## Usage

```ts
import MarkdownIt from 'markdown-it';
import wikilinks from '@global-torque/markdown-it-wikilinks';

const md = new MarkdownIt().use(wikilinks({
  makeAllLinksAbsolute: false,
  uriSuffix: '',
}));

md.renderInline('[[docs/Main Page|Read more]]');
```

The plugin renders `[[Page]]` and `[[Page|Label]]` links. Tooltip text can be
loaded from markdown frontmatter without importing Vue components, app aliases,
or UI packages.

For content that stores tooltip text in `description`, configure:

```ts
md.use(wikilinks({
  tooltipFrontmatterField: 'description',
}));
```

## Options

- `baseURL`, `relativeBaseURL`, `makeAllLinksAbsolute`, `uriSuffix`
- `htmlAttributes`
- `generatePagePathFromLabel`, `postProcessPagePath`, `postProcessPageHash`,
  `postProcessLabel`
- legacy aliases: `generatePageNameFromLabel`, `postProcessPageName`
- `docsRoot`: markdown content root used for tooltip lookup, default `docs`
- `tooltipFrontmatterField`: frontmatter field or fields used for tooltips,
  default `summary`

## Exports

- `@global-torque/markdown-it-wikilinks`
- `@global-torque/markdown-it-wikilinks/url`

## Support And Compatibility

- Peer dependency: `markdown-it`.
- Runtime: framework-free Node/build-time plugin code, no Vue, Pinia, VitePress
  app config, browser globals, UI packages, investment packages, or app aliases.
- License: MIT. The original upstream MIT attribution is preserved in
  `LICENSE`; see `NOTICE.md`.
- Public source: https://github.com/global-torque/markdown-it-wikilinks.
- Security reports: see `SECURITY.md`.

## Versioning

The public release starts at `0.x`. Every public release must include a
changelog entry, package-content review, and `pnpm pack --dry-run` evidence.
