---
# Read by `agw review route` (the tier of a range) and by the reviewer. Globs are repo-relative.
none: [docs/**, bun.lock, packages/basalt-ui/CHANGELOG.md]
sensitive:
  [
    scripts/release.sh,
    scripts/release.test.ts,
    .github/**,
    .releaserc.json,
    commitlint.config.ts,
    packages/basalt-ui/src/lint/**,
  ]
---

# REVIEW.md — basalt-ui

Release tooling, CI workflows and the shipped lint rules are the sensitive paths: a mistake there publishes
a wrong version or silently weakens every consumer's guards.

Skip: formatting, naming taste, lint-level remarks.
