# Roadmap

The active public milestone is
[0.2 hardening and public-source cutover](https://github.com/global-torque/markdown-it-wikilinks/milestone/1).

Promotion order:

1. Merge reviewed source and governance on protected `main`.
2. Pass Node 24 CI with the frozen lockfile, standard package lint/pack checks, and the repository test, build, API, and coverage checks; confirm a zero-vulnerability audit for release validation.
3. Complete named real-consumer validation for the maintained VitePress sites and Advayta.
4. Publish the reviewed package through the normal npm release process.

The custom candidate, manifest, attestation, clean-room, and npm-provenance pipeline is retired and is not a release prerequisite.
