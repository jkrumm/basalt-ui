#!/usr/bin/env bash
#
# Release wrapper — dry run, show the verdict, confirm, then publish.
#
# Two workflows do the work and neither is replaced here. `Make Release` (workflow_dispatch) runs
# semantic-release: it computes the version, tags, and creates the GitHub release, using a PAT that
# bypasses branch protection. `Publish to npm` fires on `release: published` and is the one holding
# the OIDC identity that pushes to the registry with provenance. This script is a local FRONT DOOR
# to that pair, not a third path. What it adds:
#
#   • a preflight (right branch, clean tree, in sync) before anything is dispatched — including
#     `release-migrating.ts --check`, because `prepareCmd`'s MIGRATING generation runs in the
#     `prepare` step, which a dry run SKIPS, so nothing else in the pipeline can catch a bad
#     migration row or an unmapped removal;
#   • a CI-green preflight (`ci_green`: the newest non-release commit's CI run must be completed/success);
#   • a dry run first, ALWAYS, with the computed version read back before the real one is offered,
#     and a refusal when no commit since the last tag touches the package (`package_commit_present`);
#   • the version gate (`version_gate`, tested in scripts/release.test.ts): before GA only the
#     owner-flagged first 3.0.0 is releasable (`GA=1`), after it only non-major 3.x —
#     packages/basalt-ui/MAINTAINING.md § Major lines;
#   • the C16 grace gate against the COMPUTED version (`packages/basalt-ui/scripts/check-grace.ts`),
#     which is the only place it can fire before the release instead of one minor after it — grace
#     entries and deprecation `removeIn` dates alike, behind a build + export-surface check so its
#     "still ships" reads a snapshot proven against dist;
#   • one confirmation, on the number itself rather than on the intent;
#   • follow-through to the registry, so a green exit means "on npm" rather than "the job finished".
#
# Usage:  scripts/release.sh dry     — dry run only, print the verdict, change nothing
#         scripts/release.sh         — dry run, confirm, publish
#         YES=1 scripts/release.sh   — same without the prompt (non-interactive callers)
#         GA=1 scripts/release.sh    — the owner's go for the first 3.0.0; no other release needs it

# ── Library half: the version rule ─────────────────────────────────
# Sourcing this file (scripts/release.test.ts) defines the functions below and returns before
# `set -euo pipefail`, so it never changes the caller's shell options or releases anything.

# The one statement of the doctrine. A new major is one edit here plus packages/basalt-ui/MAINTAINING.md
# § Major lines.
readonly CURRENT_MAJOR=3

# ga_tag_exists
# Prints 1 when origin carries the v<CURRENT_MAJOR>.0.0 tag (the major is GA), else 0. A remote that
# cannot be read prints nothing and returns 1: the gate must not guess which side of GA it is on.
ga_tag_exists() {
  local refs
  if ! refs=$(git ls-remote --tags origin "v${CURRENT_MAJOR}.0.0" 2>/dev/null); then
    echo "version gate: cannot read the tags on origin — cannot tell whether v${CURRENT_MAJOR}.0.0 shipped." >&2
    return 1
  fi
  if [ -n "$refs" ]; then echo 1; else echo 0; fi
}

# version_gate <bump> <version> <ga_tag_exists 0|1> <ga_flag 0|1>
# ga_flag is 1 only when the owner set GA=1. Master-only: no line, no branch.
#   no v3.0.0 tag: accepts only <CURRENT_MAJOR>.0.0 with bump major and ga_flag=1 (the owner's go);
#                  refuses every other version — any 2.x, any prerelease, 3.0.0 without the flag.
#   v3.0.0 tag:    accepts ^3.N.N$ that is not a major and not 3.0.0; refuses any major until
#                  CURRENT_MAJOR changes.
# Fails closed on an unparsed bump, an empty version or a ga argument that is not 0|1. It judges the
# computed VERSION and bump, not the commit, and reads nothing from the registry.
version_gate() {
  local bump="${1:-}" version="${2:-}" ga_tag="${3:-}" ga_flag="${4:-}"
  local stable_line="^${CURRENT_MAJOR}\.[0-9]+\.[0-9]+\$" first="${CURRENT_MAJOR}.0.0"

  case "$bump" in
    major | minor | patch) ;;
    *)
      echo "version gate: unparsed bump '$bump' — cannot judge v$version." >&2
      return 1
      ;;
  esac
  if [ -z "$version" ]; then
    echo "version gate: no computed version." >&2
    return 1
  fi
  if { [ "$ga_tag" != 0 ] && [ "$ga_tag" != 1 ]; } || { [ "$ga_flag" != 0 ] && [ "$ga_flag" != 1 ]; }; then
    echo "version gate: ga_tag_exists '$ga_tag' and ga_flag '$ga_flag' must each be 0 or 1 — cannot judge v$version." >&2
    return 1
  fi

  if [ "$ga_tag" = 0 ]; then
    if [ "$version" = "$first" ] && [ "$bump" = major ]; then
      [ "$ga_flag" = 1 ] && return 0
      echo "v$first is the first publish of the major and needs the owner's go: re-run with GA=1." >&2
      return 1
    fi
    echo "before GA only v$first (major, GA=1) is releasable: computed v$version ($bump) is refused. The first publish is the owner's go." >&2
    return 1
  fi

  if [ "$bump" = major ]; then
    echo "no majors: computed v$version is a major bump and v${CURRENT_MAJOR}.0.0 has shipped. Ship a break as a plain feat: with a migration row; a new major is packages/basalt-ui/MAINTAINING.md § Major lines." >&2
    return 1
  fi
  if [ "$version" = "$first" ]; then
    echo "v$first has shipped; a recomputed $first means the release tags are out of sync with the registry." >&2
    return 1
  fi
  if [[ "$version" =~ $stable_line ]]; then
    return 0
  fi
  echo "only stable ${CURRENT_MAJOR}.x is releasable: computed v$version ($bump) is another line, a prerelease or build-metadata version." >&2
  return 1
}

# ci_green <branch>
# Releases need a green CI on the exact head. `chore: release …` commits carry [skip ci] and never
# get a run, so the head that counts is the newest NON-release commit on the first-parent line of
# origin/<branch>. Its push run of `CI` must be completed/success: a missing, running or red run
# returns 1 with the reason on stderr (2.8.0 shipped on a red master).
ci_green() {
  local branch="${1:-}" sha ci
  [ -n "$branch" ] || {
    echo "CI preflight: no branch given." >&2
    return 1
  }
  sha=$(git rev-list --first-parent -n1 --invert-grep --grep='^chore: release ' "origin/$branch" 2>/dev/null) || sha=''
  if [ -z "$sha" ]; then
    echo "CI preflight: no non-release commit found on origin/$branch." >&2
    return 1
  fi
  ci=$(gh run list --workflow CI --branch "$branch" --event push --commit "$sha" \
    --json status,conclusion --jq 'if length == 0 then "" else .[0] | "\(.status)/\(.conclusion)" end' 2>/dev/null) || ci=''
  if [ "$ci" != "completed/success" ]; then
    echo "CI on ${sha:0:8} is '${ci:-no run}' — releases need a green CI on the exact head." >&2
    return 1
  fi
}

# package_commit_present <last_tag> <branch> <package_path>
# A release needs at least one commit touching the package since the last tag: semantic-release no
# longer path-filters, so a root-only `feat:` would otherwise cut a version with no package change.
# It does not judge whether that commit is bump-eligible (a package `docs:` commit plus a root-only
# `feat:` still passes); the dry run's computed version stays the human's check.
# Returns 1 with the reason on stderr when `git log <last_tag>..origin/<branch> -- <package_path>`
# is empty (or cannot be read).
package_commit_present() {
  local last_tag="${1:-}" branch="${2:-}" package_path="${3:-}" log
  if ! log=$(git log --format=%h "${last_tag:+$last_tag..}origin/$branch" -- "$package_path" 2>/dev/null); then
    echo "no-package-commit check: cannot read the history of $package_path since ${last_tag:-the beginning}." >&2
    return 1
  fi
  if [ -z "$log" ]; then
    echo "no commit touches $package_path since ${last_tag:-the beginning}: a release needs a package commit." >&2
    return 1
  fi
}

# Sourced (not run): stop here, before the release flow and before `set -euo pipefail`.
if [ "${BASH_SOURCE[0]}" != "$0" ]; then
  return 0
fi

set -euo pipefail

MODE="${1:-full}"
case "$MODE" in
  dry | full) ;;
  # Anything else would otherwise fall through to the publishing path — `release.sh dr` must not
  # ship a version, least of all under YES=1.
  *)
    echo "usage: $0 [dry]" >&2
    exit 2
    ;;
esac

BRANCH="master"
RELEASE_WORKFLOW="Make Release"
PUBLISH_WORKFLOW="Publish to npm"
PACKAGE_PATH="packages/basalt-ui"
REPO_URL="https://github.com/jkrumm/basalt-ui"
RUN_TIMEOUT=1800  # 30m — a release run takes ~1m; this only ever fires on a wedge.
START_TIMEOUT=180 # 3m for a dispatched/triggered run to appear.
# 60m for the published version to be readable — a hang guard, not a budget: 1.32.0 took ~7.5m
# and 2.24.0 ~25m to be served, and the old 20m gave up on a release that had in fact succeeded.
REGISTRY_TIMEOUT=3600

die() {
  echo "✖ $*" >&2
  exit 1
}

# ── Preflight ────────────────────────────────────────────────────────────────
command -v gh >/dev/null || die "gh CLI not found"
gh auth status >/dev/null 2>&1 || die "gh is not authenticated"

current=$(git rev-parse --abbrev-ref HEAD)
[ "$current" = "$BRANCH" ] || die "on '$current' — releases cut from '$BRANCH' only"
# Tracked changes only. What gets released is `origin/$BRANCH` checked out fresh in CI, so an
# untracked local file cannot reach it — failing on one (a stray `.env.local`, an editor scratch
# file, a `.claude/` dir) would block a release for a reason that has nothing to do with the release.
# A MODIFIED tracked file is different: it means the thing under test is not the thing shipping.
[ -z "$(git status --porcelain --untracked-files=no)" ] ||
  die "tracked files are modified — commit or stash first"

git fetch origin --quiet
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$BRANCH")" ] ||
  die "local $BRANCH differs from origin/$BRANCH — push or pull first"

# 2.8.0 shipped on a red master: the head being released must have a green CI run (`ci_green`).
ci_green "$BRANCH" || die "CI is not green on the head being released (reason above) — fix master, then release."

# MIGRATING.md is generated at release time: `prepareCmd` merges `migrations/areas/*.json` into
# `migrations/<version>.json` and renders the file, and semantic-release SKIPS `prepare` in a dry
# run — so the dry run below cannot exercise it and a bad row would only surface in the published
# tarball. `--check` runs the same validation here, before anything is dispatched: every area file
# parses strictly, and the surface-diff gate finds no removed or renamed public symbol, subpath or
# `--vx-*` name that no row names.
bun "$PACKAGE_PATH/scripts/release-migrating.ts" --check ||
  die "migration ledger check failed (reason above) — fix migrations/areas/*.json (add the row for the removed or renamed name), then release."

# check-grace below decides "does this deprecated export still ship" from the committed
# `export-surface.json`, so a stale snapshot would let it wave through an export that is still in
# dist (or refuse one that is gone). Build and diff the snapshot against the built entries first —
# ~6s, and the same check the pack-test runs against the tarball.
# Quiet on success, but a failing build prints ALL its output: tsc reports on stdout, so a bare
# `>/dev/null` threw away the one line saying why.
build_log=$(cd "$PACKAGE_PATH" && bun run build 2>&1) || {
  printf '%s\n' "$build_log" >&2
  die "build failed (output above) — fix it, then release."
}
node --import "./$PACKAGE_PATH/scripts/css-noop-register.mjs" "$PACKAGE_PATH/scripts/export-surface.mjs" ||
  die "export-surface check failed (see above) — check-grace reads that snapshot, so the release stops here."

# ── Run helpers ──────────────────────────────────────────────────────────────
latest_run() {
  gh run list --workflow "$1" --limit 1 --json databaseId --jq '.[0].databaseId // empty' 2>/dev/null || true
}

# Wait for a run id to appear that is NOT the one that was newest before the trigger. Taking "the
# newest run" outright races the dispatch: for a few seconds it is still the PREVIOUS release's run,
# which is already `completed` and `success`, so the script would sail past a release that never ran.
await_new_run() {
  local workflow="$1" before="$2" deadline=$((SECONDS + START_TIMEOUT)) id
  while :; do
    id=$(latest_run "$workflow")
    if [ -n "$id" ] && [ "$id" != "$before" ]; then
      echo "$id"
      return 0
    fi
    [ "$SECONDS" -lt "$deadline" ] || die "no new '$workflow' run appeared within ${START_TIMEOUT}s"
    sleep 5
  done
}

# Poll to completion, bounded, and treat a persistently unreadable run as a failure rather than
# looping on it: a deleted run or a broken token would otherwise poll forever.
await_completion() {
  local id="$1" workflow="$2" deadline=$((SECONDS + RUN_TIMEOUT)) status errors=0
  while :; do
    if status=$(gh run view "$id" --json status --jq .status 2>/dev/null); then
      errors=0
      [ "$status" = "completed" ] && break
    else
      errors=$((errors + 1))
      [ "$errors" -lt 5 ] || die "cannot read '$workflow' run $id — $REPO_URL/actions/runs/$id"
    fi
    [ "$SECONDS" -lt "$deadline" ] ||
      die "'$workflow' run $id did not finish within ${RUN_TIMEOUT}s — $REPO_URL/actions/runs/$id"
    sleep 15
  done
  [ "$(gh run view "$id" --json conclusion --jq .conclusion)" = "success" ] ||
    die "'$workflow' run $id failed — $REPO_URL/actions/runs/$id"
}

# Poll the registry until it actually serves the version that was just published, and FAIL if it
# never does.
#
# This exists because the line it replaces was a single unretried `npm view` interpolated into the
# success message — so the script could, and did, print `✔ basalt-ui v1.30.1 published — registry
# reports 1.30.0` and exit 0. The whole reason this wrapper exists rather than a bare
# `gh workflow run` is that a green exit means "on npm" (see AGENTS.md § Release Process); a claim
# printed beside evidence contradicting it is worse than no claim, because it is the line a reader
# trusts instead of checking.
#
# Two independent reasons the read was stale, and the fix has to cover both: the registry needs a
# moment to serve a just-published version, and `npm view` will answer from the local cache without
# revalidating. `--prefer-online` forces the revalidation; the loop covers the propagation. A read
# that fails outright (network, registry 5xx) is retried rather than treated as a mismatch — only a
# DEFINITE wrong version, or the deadline, ends this.
await_registry() {
  local want="$1" prev="${last_tag#v}" deadline=$((SECONDS + REGISTRY_TIMEOUT)) got
  while :; do
    got=$(npm view --prefer-online basalt-ui version 2>/dev/null || echo '')
    [ "$got" = "$want" ] && return 0
    if [ "$SECONDS" -ge "$deadline" ]; then
      # Still the previous version: the publish run succeeded, the registry is just slow — not a failure.
      if [ -n "$got" ] && [ "$got" = "$prev" ]; then
        echo "published v$want (the publish run succeeded), the registry still serves $got after ${REGISTRY_TIMEOUT}s: still propagating — check \`npm view basalt-ui version\` later; do not release again"
        exit 3
      fi
      die "npm published v$want but the registry serves '${got:-<unreadable>}' after ${REGISTRY_TIMEOUT}s — check $REPO_URL/actions and \`npm view basalt-ui versions\` before releasing again."
    fi
    sleep 5
  done
}

release_run() {
  local dry="$1" before id
  before=$(latest_run "$RELEASE_WORKFLOW")
  gh workflow run "$RELEASE_WORKFLOW" --ref "$BRANCH" -f dry_run="$dry" >/dev/null
  id=$(await_new_run "$RELEASE_WORKFLOW" "$before")
  echo "  run: $REPO_URL/actions/runs/$id" >&2
  await_completion "$id" "$RELEASE_WORKFLOW"
  echo "$id"
}

# ── What is in it (local, exact, free) ───────────────────────────────────────
last_tag=$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null || echo '')
range="${last_tag:+$last_tag..}HEAD"
echo "── Since ${last_tag:-the beginning}, touching $PACKAGE_PATH ──"
git log "$range" --format='  %h %s' -- "$PACKAGE_PATH"
echo

# ── Dry run ──────────────────────────────────────────────────────────────────
echo "▸ dry run…" >&2
log=$(gh run view "$(release_run true)" --log)

if grep -q "no new version is released" <<<"$log"; then
  echo "No release: nothing since ${last_tag:-the beginning} bumps the version."
  exit 0
fi

# semantic-release no longer path-filters to the package, so a root-only `feat:` computes a version
# on its own; refuse unless a commit since the last tag actually touches the package.
package_commit_present "$last_tag" "$BRANCH" "$PACKAGE_PATH" || die "nothing to release (reason above)."

version=$(grep -oE 'The next release version is [0-9]+\.[0-9]+\.[0-9]+[^ ]*' <<<"$log" |
  head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^ ]*')
bump=$(grep -oE 'Analysis of [0-9]+ commits complete: [a-z]+ release' <<<"$log" |
  head -1 | awk '{print $(NF-1)}')
[ -n "$version" ] || die "could not read the next version out of the dry run"

echo
echo "  ${last_tag:-none} → v$version  (${bump:-unknown})"

ga_tag=$(ga_tag_exists) || die "cannot tell whether v${CURRENT_MAJOR}.0.0 shipped (reason above)."
ga_flag=0
[ "${GA:-}" != "1" ] || ga_flag=1
version_gate "$bump" "$version" "$ga_tag" "$ga_flag" || die "v$version is not releasable (reason above)."

# ── The C16 grace gate, against the version about to be cut ──────────────────
# The test-time gate reads package.json, i.e. the version already PUBLISHED, so it can only go red
# after the release that shipped a due entry — and it never runs on that release: semantic-release's
# `chore: release … [skip ci]` commit skips CI and `release.yml` runs no tests. The computed version
# is only known here, so this is the only place the gate can fire before the release rather than one
# minor after it (docs/CONTROLS-SPEC.md §1).
echo
bun "$PACKAGE_PATH/scripts/check-grace.ts" "$version" ||
  die "a ledger entry blocks v$version (see above)."

[ "$MODE" != "dry" ] || exit 0

# ── Confirm on the number, then publish ──────────────────────────────────────
if [ "${YES:-}" != "1" ]; then
  echo
  read -r -p "Publish v$version to npm? This is irreversible. [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || {
    echo "Aborted — nothing was published."
    exit 1
  }
fi

# Captured BEFORE the release so the publish run this waits on is provably the one it triggered.
publish_before=$(latest_run "$PUBLISH_WORKFLOW")

echo "▸ releasing…" >&2
release_run false >/dev/null

# `Publish to npm` fires on `release: published` — a separate run that can fail on its own, so the
# script follows it rather than reporting success at the tag.
echo "▸ waiting for the npm publish…" >&2
publish_id=$(await_new_run "$PUBLISH_WORKFLOW" "$publish_before")
echo "  run: $REPO_URL/actions/runs/$publish_id" >&2
await_completion "$publish_id" "$PUBLISH_WORKFLOW"

# The claim is only made once the registry has been PROVEN to serve it — see `await_registry`.
echo "▸ confirming the registry serves v${version}…" >&2
await_registry "$version"

echo
echo "✔ basalt-ui v$version published — registry serves $version"
