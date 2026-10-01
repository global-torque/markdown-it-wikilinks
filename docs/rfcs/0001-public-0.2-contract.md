# RFC 0001: Public 0.2 contract

- Status: Proposed
- Target: `0.2.0-beta.4`
- Last updated: 2026-07-13

## External problem

Markdown-it consumers need escaped Obsidian-style wikilinks with deterministic URL hooks and an optional contained Node frontmatter tooltip index.

## Public surface

The supported imports are `.`, `./url`, and `./node`. Exports are ESM-only ES2022 with
declarations and Node.js 22 or newer. Undeclared deep imports are private.

## Non-goals

Vue tooltip markup, VitePress config, app routes, asynchronous renderer callbacks, and Obsidian block references remain outside this package.

## Compatibility and release evidence

Two maintained VitePress sites and Advayta must pass named real-consumer validation; Advayta's local plugin copy is removed only after tooltip and destination parity passes.

Node 24 CI installs the frozen lockfile and runs the standard package lint, pack, test, build, API, and coverage checks; release validation also requires a zero-vulnerability audit. The custom candidate, manifest, attestation, clean-room, and npm-provenance pipeline is retired and is not part of this contract.

## Decision

Accept this contract only after the source pull request, API report, standard package checks, and named-consumer evidence have no unresolved actionable findings.
