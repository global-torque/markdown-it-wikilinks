# Contributing

Use an issue or RFC before making a public API change. Keep pull requests
focused, add tests for changed behavior, update user-facing documentation, and
record compatibility or security impact explicitly.

## Developer Certificate of Origin

Every commit must include a `Signed-off-by` trailer certifying the Developer
Certificate of Origin 1.1. Sign commits with:

```sh
git commit -s
```

By signing off, you certify that you wrote the contribution or otherwise have
the right to submit it under the repository license. The full certificate is
available at <https://developercertificate.org/>.

## Pull requests

1. Branch from the protected default branch.
2. Install the package manager version declared by `packageManager`.
3. Run the repository's `pnpm run ci` command.
4. Explain public API, compatibility, privacy, and supply-chain impact.
5. Do not commit generated package output unless the repository policy names
   it as source.

Security reports must use GitHub private vulnerability reporting, not a public
issue.

## Release validation

The custom candidate, manifest, attestation, clean-room, and npm-provenance pipeline is retired. The remaining release gate is the Node 24 CI workflow, which installs the frozen lockfile, runs the standard package lint and pack checks, and runs the repository tests, build, API, and coverage checks. Release validation also requires a zero-vulnerability audit.

Before publication, maintainers also complete named real-consumer validation for the maintained VitePress sites and Advayta. Publish the reviewed package through the normal npm release process; this repository does not create candidate manifests or provenance bundles.
