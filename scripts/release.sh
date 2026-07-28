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
#   • a preflight (right branch, clean tree, in sync) before anything is dispatched;
#   • a dry run first, ALWAYS, with the computed version read back before the real one is offered;
#   • a hard refusal on a major — majors are banned here by design (see CLAUDE.md), and the one
#     way to get one by accident is a stray `feat!:`/`BREAKING CHANGE:` reaching master. Nothing
#     else in the pipeline checks;
#   • one confirmation, on the number itself rather than on the intent;
#   • follow-through to the registry, so a green exit means "on npm" rather than "the job finished".
#
# Usage:  scripts/release.sh dry     — dry run only, print the verdict, change nothing
#         scripts/release.sh         — dry run, confirm, publish
#         YES=1 scripts/release.sh   — same without the prompt (non-interactive callers)
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
last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo '')
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

version=$(grep -oE 'The next release version is [0-9]+\.[0-9]+\.[0-9]+[^ ]*' <<<"$log" |
  head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^ ]*')
bump=$(grep -oE 'Analysis of [0-9]+ commits complete: [a-z]+ release' <<<"$log" |
  head -1 | awk '{print $(NF-1)}')
[ -n "$version" ] || die "could not read the next version out of the dry run"

echo
echo "  ${last_tag:-none} → v$version  (${bump:-unknown})"

if [ "$bump" = "major" ]; then
  die "a MAJOR is banned in this repo (CLAUDE.md: no majors, 1.x absorbs breaks).
   Something on $BRANCH carries \`feat!:\` or a BREAKING CHANGE footer. Rewrite it as a plain
   \`feat:\` documenting the change in the body, then release again."
fi

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

echo
echo "✔ basalt-ui v$version published — registry reports $(npm view basalt-ui version)"
