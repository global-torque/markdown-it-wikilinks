# OpenSSF baseline review

Review date: 2026-07-11

This prerelease source applies the OSPS baseline proportionately to a small
ESM-only TypeScript library.

Implemented controls:

- protected `main` with pull-request, CODEOWNERS, conversation-resolution,
  linear-history, no-force-push, and no-deletion rules;
- protected immutable `v*` tags;
- least-privilege, SHA-pinned GitHub Actions;
- Node 24 required CI with standard package lint/pack checks and a
  zero-vulnerability audit required for release validation;
- DCO sign-off, Dependabot, Scorecard, secret scanning, push
  protection, and private vulnerability reporting;
- explicit package contents, API reports, coverage thresholds, and source maps.

Release-blocking controls are the package's named real-consumer validation and the standard Node 24 CI gates. The custom candidate, manifest, attestation, clean-room, npm-provenance, and CodeQL workflows are retired. Registry publication follows the normal npm process after the organization owner configures npm access.
