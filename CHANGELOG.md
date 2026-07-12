# Changelog

## 0.2.0-beta.3 - Unreleased

- Prepared the independently reviewed 0.2 source for protected public `main` with
  SHA-pinned CI, public API governance, clean-source artifact manifests, and
  provenance workflow.
- Revalidate host-resolved URL schemes and restrict static anchor attributes to
  an inert safe list so callbacks and configuration cannot reintroduce active
  markup.
- Supersedes the dirty-tree beta.2 implementation artifact; beta.2 remains
  historical local evidence and must not be uploaded or retagged.

## 0.2.0-beta.2 - Unreleased

- Shipped the Markdown-it declaration dependency required by strict external
  consumers with `skipLibCheck: false`.

## 0.2.0-beta.1 - Superseded local candidate

- Split the framework-free core, pure URL builder, and explicit Node resolver.
- Replaced filesystem/UI options with synchronous host callbacks.
- Removed the public `Url` class and legacy page-name option aliases.
- Defined safe scheme, Unicode, query, fragment, base-path, and relative-path
  behavior without `/./` output.
- Added real frontmatter parsing, realpath containment, deterministic ambiguity
  errors, symlink policy, refresh, and disposal.
- Made refresh atomically parse/cache tooltip values so post-index file or
  directory replacement cannot redirect rendering outside the content root.
- Preserved contained symlink aliases, made title detection case-insensitive,
  and kept unlabeled query/fragment boundaries outside host path callbacks.
- Added replacement-race and generated escaping/fuzz coverage; named consumers
  validate their app-owned tooltip renderers separately.
- Added strict lint/format/type/API gates, enforced coverage, embedded source
  maps, generated API documentation, and exact-artifact verification.
- Never publish this candidate. Strict npm clean-room compilation found that
  its public declarations referenced Markdown-it without shipping the required
  declaration dependency. Its local tarball SHA-512 was
  `5f338e4f8362d3baada049e6a5e5ddf7d5814cd5fa4c54bfb403ab14a3d9eb0beee04723ef027d693f4367c16a598323b32b43a076d298c67fb7018832e2d7dc`.

## 0.2.0-beta.0 - Superseded

- Publication was frozen after the 0.2 audit invalidated the earlier
  release-readiness assessment. This candidate must never be published.

## 0.0.1

- Prepared the original compatibility plugin and preserved upstream MIT
  attribution.
