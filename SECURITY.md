# Security Policy

## Supported Versions

| Version                        | Security fixes                |
| ------------------------------ | ----------------------------- |
| Latest `0.2.x`                 | Supported                     |
| Older versions and prereleases | Upgrade to the latest release |

## Reporting

Use GitHub private vulnerability reporting:

https://github.com/global-torque/markdown-it-wikilinks/security/advisories/new

Do not disclose an unpatched vulnerability in a public issue. Do not submit
real secrets, private content, customer data, or credentials; use synthetic
reproductions.

Maintainers will acknowledge a complete report within five business days,
triage severity and affected versions, coordinate a candidate fix privately,
and publish an advisory after a reviewed release is available. Timelines may be
extended when the report is incomplete or depends on an upstream package.

The security boundary covers core HTML escaping, unsafe URL schemes,
frontmatter parsing, path containment, symlink traversal, ambiguity handling,
and malformed/unreadable content. Host `resolveHref` and `renderTooltip`
callbacks are trusted application code and must preserve equivalent escaping.
