# W1 doctrine — the one sanctioned major, evidence

Owner decision 2026-10-13: master is the only line; 2.0.0 is published straight from master; no
`1.x`, no prerelease channel. Config under test: `.releaserc.json` = `["master"]`.

## semantic-release dry run (scratch clone, token from the secrets cache, never printed)

```text
### master at the PR head (no designated commit)
[semantic-release] › ⚠  Run automated release from branch master on repository https://github.com/jkrumm/basalt-ui.git in dry-run mode
[semantic-release] › ℹ  Found git tag v1.41.0 associated with version 1.41.0 on branch master
[semantic-release] [@semantic-release/commit-analyzer] › ℹ  Analysis of 18 commits complete: no release
[semantic-release] › ℹ  There are no relevant changes, so no new version is released.

### master + synthetic designated commit (local, not pushed)
[semantic-release] › ⚠  Run automated release from branch master on repository https://github.com/jkrumm/basalt-ui.git in dry-run mode
[semantic-release] › ℹ  Found git tag v1.41.0 associated with version 1.41.0 on branch master
[semantic-release] [@semantic-release/commit-analyzer] › ℹ  Analysis of 19 commits complete: major release
[semantic-release] › ℹ  The next release version is 2.0.0
[semantic-release] › ✔  Published release 2.0.0 on default channel
```

The gate checks the computed version only; the designated commit above is synthetic and local.

## `release.sh` major gate (`bun test scripts/release.test.ts`)

```text
 25 pass
 0 fail
Ran 25 tests across 1 file. [585.00ms]
```

`bash -n scripts/release.sh` exits 0.

## Remote refs removed (`git ls-remote origin 1.x latest 'refs/tags/v2.0.0*' refs/tags/v1.41.0`)

```text
dadab5c1c25b1c72015947658cf84b13a2b6994d	refs/tags/v1.41.0
```

Only `v1.41.0` remains: `1.x`, `latest` and `v2.0.0-placeholder.0` are gone.
