# Release process

```bash
make release-dry   # preview only — prints last-tag → next-version and the bump type
make release       # dry run, show the bump, confirm, publish, wait for npm
```

One channel: `master` publishes to npm `latest`. The `v2` branch is a read-only reference with no
release config.

`scripts/release.sh` is the front door to two workflows, and replaces neither. **Make Release**
(`workflow_dispatch`) runs semantic-release — it computes the version from the commits, tags, and
creates the GitHub release, using a PAT that bypasses branch protection. **Publish to npm** fires on `release: published` and is the one holding
the OIDC identity that pushes to the registry **with provenance**.

The wrapper adds what a bare dispatch can't: a preflight (on `master`, clean tree, in sync, and
`release-migrating.ts --check`), a dry run **always** first with the computed version read back
before the real one is offered, one confirmation on the number itself, a follow-through to the
_publish_ run, and then a POLL of the registry until it actually serves that version — so a green
exit means "on npm", not "the release job finished". That last step is load-bearing and was added
after it wasn't: v1.30.1 printed `✔ … published — registry reports 1.30.0` and exited 0, because
the read was a single unretried `npm view` interpolated into the success message and never compared
to anything. It now retries (`--prefer-online`, so a cached metadata document can't answer) for up
to 3600 s, `die`s on an unexpected version, and exits 3 ("still propagating", not a failure) when the
registry still serves the previous version at the deadline: 2.24.0 took ~25 min to be served.

`YES=1 make release` skips only the prompt. The wrapper's version gate is described in
`packages/basalt-ui/MAINTAINING.md` § Major lines; its constants live in `scripts/release.sh`.

**Releasing is allowed — through `make release`, and only there.** No per-release permission is
needed; the wrapper is itself the gate. Never dispatch the workflow by hand. Releasing is a
decision, not a step that follows merging — `release.yml` is `workflow_dispatch`-only precisely so
merged never means published: don't queue a release unasked. Release when there is a reason to —
a consumer is blocked, a fix is wanted downstream — and say which version went out and why.

**Commit type discipline (affects npm versioning):**

- `feat:` / `fix:` — minor/patch release when published.
- `ci:` — CI/CD, lefthook, workflow changes; never triggers a release.
- `chore:` / `docs:` / `refactor:` — no release.

Which commit footers (`feat!:`, `BREAKING CHANGE:`) are allowed, and when a breaking change may
bump a major: `packages/basalt-ui/MAINTAINING.md` § Major lines; constants in `scripts/release.sh`.
