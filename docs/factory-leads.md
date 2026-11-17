# Factory leads (v3)

- PR-only, rebase-merge only (never squash). Merge only when `make merge-guard` is clear: PR CI is green for that
  exact head, and a branch behind `origin/master` shares no changed file with master's new commits while master is
  green; otherwise rebase, push and wait for PR CI (`MERGE_GUARD_ARGS=--wait make merge-guard` polls the head's CI
  first, 45 min by default, `--wait-minutes <n>`). Local `make check` does not replace PR CI.
- `packages/basalt-ui/**` and non-package changes are separate commits in one PR; `make sync-self` is its own
  non-package commit. Never edit `CHANGELOG.md`.
- `make check` builds first; `bun run pre` is the inner loop (its unit step runs in a slot). A fresh worktree needs `bun install` and a package build.
- The wave process is retired: work comes from Issues and `docs/plan.yaml` only. Leads rest on
  `docs/v3/ARCHITECTURE.md` and `docs/v3/DIRECTION.md`; superseded specs live in git history and on `v2`.
- Paths in a facts file's `shared_append_only` are shared aggregators: edit only your own lines; on a rebase
  conflict keep both sides or re-run the named generator (`export-surface --update`, `gen-ui`, `bun install`);
  an Issue without the path never edits it.
- v3 is rewritten in place on master and verified with `apps/playground` and `examples/*`, never against pinned
  consumers.
- A plan row whose facts are only `brief: <path>` (and an optional `note`): that file on master is your complete
  brief. Read it first, ship by stating each of its `acceptance` lines met or not met, and where it conflicts with
  `docs/v3/ARCHITECTURE.md`, the architecture wins and the PR says so.
