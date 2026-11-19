.DEFAULT_GOAL := help
.PHONY: help check check-fast ci-gate check-pre check-pre-fast check-post gen-check quality-matrix-fast verify deploy logs marketing-image pre test test-fast layout layout-fast build evidence compare release release-dry sync-self merge-guard quality-matrix browser-shell

help: ## List targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# The heavy steps run in one of the host's test slots when `factory` is installed, so two leads' runs never
# overlap: the browser steps (each a Chrome tree on a shared 32 GB host) and the unit suite (`make test`, the
# last step of `bun run pre`, which the factory bills to the lead when it runs outside a slot). Without `factory`
# (CI) the bare command. It fails open: a server that is down or a full house runs the suite anyway. The step is
# named after the project, never the worktree directory: the factory learns a step's peak by name, so a per-worktree
# name is a step with no learned peak on its first run. `$(call slot,<step>)` is the prefix.
SLOT_PROJECT = basalt-ui
slot = $(if $(shell command -v factory 2>/dev/null),factory slot run --name "$(SLOT_PROJECT) $(1)" --,)
# A browser step that has failed once is a slot minute spent for nothing: where the steps run in a slot (`factory`
# installed) they stop at the first failing test, as the unit suite stops at its first failing process
# (scripts/unit-test.ts). CI has no `factory`, runs the same files through its own steps and reports every failure.
bail = $(if $(shell command -v factory 2>/dev/null),--bail,)

# The local gate: the validation CI runs (.github/workflows/ci.yml), all in one target. Builds FIRST
# on purpose — the playground's typecheck and `bun run pre`'s lint resolve
# `basalt-ui/*` through the package's `exports` — both read `dist`, not the working tree, so a gate
# that built last would grade the previous build (packages/basalt-ui/MAINTAINING.md, "a gate reading
# dist"). `pack-test` rebuilds anyway; the point of the first build is what `pre` reads.
# `check` and `check-fast` differ in TWO steps: the layout suite (`check` runs all of it, `check-fast` the files the
# branch's changes reach, scripts/layout-select.ts) and the unit suite (the tests the changes reach, scripts/unit-select.ts).
# CI runs both in full on every pull request head.
# `CI_SPLIT=1` is CI's `gate` job: `make check CI_SPLIT=1` runs only the steps of `check` that no other CI job runs
# (`ci-gate`), because the `checks`, `unit` and `layout` jobs run the rest. The step stays `make check`, the target
# project.yaml `checks.full` names, so the one gate has one name; locally `check` is unchanged.
check: ## Local CI gate: gen sync checks + build + pre + playground build + layout + coverage/doc-drift + pack-test (CI_SPLIT=1: only the steps no other CI job runs)
ifeq ($(CI_SPLIT),1)
	@$(MAKE) --no-print-directory ci-gate
else
	@$(MAKE) --no-print-directory check-pre browser-shell
	@$(call slot,layout) sh -c 'bun run test:layout $(bail) && bun run test:layout:harness $(bail)'
	@$(MAKE) --no-print-directory check-post
endif

# The lead's local check (project.yaml `checks.fast`): everything of `check` but the layout and unit suites is the same;
# those run only the files the branch's changes reach, and CI (checks.ci) runs the rest.
check-fast: ## Local check for a lead: `check` with only the layout and unit files the branch's changes reach (CI runs both in full)
	@$(MAKE) --no-print-directory check-pre-fast
	@$(MAKE) --no-print-directory layout-fast
	@$(MAKE) --no-print-directory check-post QUALITY_STEP=quality-matrix-fast

# What CI's `gate` job runs as `make check CI_SPLIT=1` (.github/workflows/ci.yml): the steps of `check` that no other CI job runs. The `checks`
# job runs the formatters, lint, typecheck, budgets, coverage, drift, contract-frozen and pack-test gates, the `unit` job
# the unit suite (which includes the contract tests), the `layout` shards the layout suite, the `quality-matrix` job
# the quality matrix (`make quality-matrix`, sampled), so `check` whole would run each of those twice. Together the jobs
# cover every step of `check`. It builds first, as `check` does: the lint-style gates read dist and the playground build.
ci-gate:
	@cd packages/basalt-ui && bun run build
	@bun --filter @basalt-ui/playground build
	@$(MAKE) --no-print-directory gen-check
	@bun run check-literals
	@bun run check-recipes-lint
	@bun run check-readme-types
	@bun run check-playground-lint
	@bun packages/basalt-ui/src/ui/guard-completeness.ts
	@bun packages/basalt-ui/scripts/check-test-ledger.ts

check-pre:
	@$(MAKE) --no-print-directory check-build
	@bun run pre
	@bun --filter @basalt-ui/playground build

# `check-pre` with the unit step of `pre` narrowed to the tests the branch reaches (`pre:static` is `pre` without it).
check-pre-fast:
	@$(MAKE) --no-print-directory check-build
	@bun run pre:static
	@$(MAKE) --no-print-directory test-fast
	@bun --filter @basalt-ui/playground build

check-build:
	@bun packages/basalt-ui/scripts/gen-oxlint.ts --check
	@$(MAKE) --no-print-directory gen-check
	@bun scripts/check-legacy-names.ts
	@cd packages/basalt-ui && bun run build

# `check` runs the quality matrix always; `check-fast` only when the branch touched a UI input (quality-matrix-fast).
QUALITY_STEP ?= quality-matrix
check-post:
	@$(MAKE) --no-print-directory $(QUALITY_STEP)
	@bun packages/basalt-ui/scripts/check-coverage.ts --check
	@bun packages/basalt-ui/scripts/check-agent-doc-drift.ts
	@bun packages/basalt-ui/scripts/check-contract-frozen.ts
	@bun packages/basalt-ui/src/ui/guard-completeness.ts
	@bun test ./packages/basalt-ui/src/ui/primitive.contract.test.tsx ./packages/basalt-ui/tests/ui/contract
	@bun packages/basalt-ui/scripts/check-test-ledger.ts
	@cd packages/basalt-ui && bun run pack-test

# Production probe, NOT the local gate (`make check`). `curl -fsS` exits non-zero on any 4xx/5xx or
# connection failure, so a green run means basalt-ui.com answered 2xx. The site is a static nginx
# image; there is no application `/health` endpoint to hit.
verify: ## Probe production — exit 0 means https://basalt-ui.com/ is live and healthy
	@curl -fsS --max-time 15 -o /dev/null https://basalt-ui.com/
	@echo "OK https://basalt-ui.com/"

# The marketing/docs site deploys continuously on every push to master via RollHook
# (.github/workflows/deploy.yml), so there is nothing to run by hand here. npm publishing is a
# release process, not a deploy — it lives in `make release`.
deploy: ## No-op — the site is deployed by CI on push (npm publishing is `make release`)
	@echo "deployed by CI on push"

# Bounded tail, never -f: reads the production marketing container's logs and returns. The compose
# service name matches the deploy image (basalt-ui-marketing, .github/workflows/deploy.yml).
logs: ## Print the last 200 lines of the production container's logs, then exit
	@ssh vps 'docker logs --tail 200 $$(docker ps -q --filter "label=com.docker.compose.service=basalt-ui-marketing" | head -n1)'

# The production image build without the push: CI deploys on every apps/marketing/** change, and a root
# bun.lock change reaches the image too, so a lockfile refresh is checked here before it lands.
# arm64 by default: the colima VM cannot hold amd64 emulation plus astro build; CI builds linux/amd64.
PLATFORM ?= linux/arm64
marketing-image: ## Build the marketing image locally to reproduce a deploy failure (PLATFORM=linux/amd64 is CI's)
	@docker build --platform $(PLATFORM) -f apps/marketing/Dockerfile -t basalt-ui-marketing:local .

pre: ## fmt:check + lint + typecheck + budgets + literals + the unit suite in a slot (run before committing)
	@bun run pre

# One `bun test` over the whole suite peaked at 6.1 GiB; scripts/unit-test.ts runs it as consecutive processes.
test: ## Run the unit suite in a host test slot (scripts/unit-test.ts: `bun test` processes, one after another by default, peak under 2 GiB)
	@$(call slot,unit) bun scripts/unit-test.ts

# The browser of the layout and quality-matrix suites is BASALT_TEST_BROWSER=shell|chrome (tests/support/test-browser.ts).
# `chrome` is the installed Google Chrome and downloads nothing; `shell` is Playwright's chromium-headless-shell,
# fetched here and nowhere else (a no-op when the pinned revision is already in the Playwright cache). `check`,
# `layout`, `layout-fast` and `quality-matrix` depend on it, so a local gate never skips for a missing shell.
browser-shell: ## Install Playwright's chromium-headless-shell (BASALT_TEST_BROWSER=shell)
	@bun x playwright-core install --only-shell chromium

layout: browser-shell ## Run the layout regression suite (real CSS geometry, headless shell)
	@$(call slot,layout) sh -c 'bun run test:layout $(bail) && bun run test:layout:harness $(bail)'

# The layout files the branch's changes reach (scripts/layout-select.ts prints them and why, on stderr), plus the
# harness self-test when any of them runs. No layout input changed: no slot is taken, nothing runs.
LAYOUT_BUN = bun --config=./packages/basalt-ui/tests/layout/bunfig.toml test --timeout 60000 $(bail)
layout-fast: browser-shell ## Run only the layout files the branch's changes reach (BASE=<ref>, default origin/master)
	@files="$$(bun scripts/layout-select.ts --base $(or $(BASE),origin/master))" || exit $$?; \
	if [ -z "$$files" ]; then exit 0; fi; \
	$(call slot,layout-fast) sh -c '$(LAYOUT_BUN) '"$$(echo $$files)"' && bun run test:layout:harness $(bail)'

# The unit tests the branch's changes reach (scripts/unit-select.ts): bun's module graph through `bun test --changed`
# plus the always-on set of tests that read files. CI and `make check` run the whole suite. Its slot is `unit-fast`, not
# `unit`: project.yaml lets the `unit` step run on the step host, whose copy of the tree has no git diff of the working
# tree, so `--changed` would see no change there and skip tests; `unit-fast` is declared nowhere and runs on the mini.
test-fast: ## Run only the unit tests the branch's changes reach (BASE=<ref>, default origin/master)
	@$(call slot,unit-fast) bun scripts/unit-test.ts --changed --base $(or $(BASE),origin/master)

build: ## Build the published package (dist-first tsup + declarations)
	@cd packages/basalt-ui && bun run build

# `quality` is a lane of `make evidence` that scripts/evidence does not know: it is taken out of LANES
# before the script sees it, and the script is skipped when `quality` was the only lane asked for.
comma := ,
space := $(subst ,, )
EVIDENCE_LANES = $(subst $(space),$(comma),$(strip $(filter-out quality,$(subst $(comma),$(space),$(LANES)))))

# Measurement harness (scripts/evidence): builds the package + playground unless DIST is given, serves
# the dist on an ephemeral port, runs every lane, writes .evidence/<LABEL>/ and the summary
# .evidence/summaries/<LABEL>.md (all gitignored). ROUTES = file with one path per line (external dists). LANES = comma list: a subset run writes
# <LABEL>.<lanes>.md beside the full summary instead of replacing it.
evidence: ## Measure bundle/screens/lighthouse/...: make evidence LABEL=<label> [DIST=<dir>] [ROUTES=<file>] [LANES=a,b]
	@test -n "$(LABEL)" || { echo "usage: make evidence LABEL=<label> [DIST=<dir>] [ROUTES=<file>] [LANES=a,b]"; exit 2; }
	@$(if $(or $(if $(LANES),,x),$(EVIDENCE_LANES)),bun scripts/evidence/index.ts --label "$(LABEL)" $(if $(DIST),--dist "$(DIST)") $(if $(ROUTES),--routes "$(ROUTES)") $(if $(EVIDENCE_LANES),--lanes "$(EVIDENCE_LANES)"))
	@$(if $(if $(LANES),$(findstring quality,$(LANES)),x),$(MAKE) --no-print-directory quality-matrix QUALITY_MATRIX=full)

# The quality matrix (quality-contract section 4; packages/basalt-ui/tests/quality/matrix): every
# playground route in real Chrome against the seeded offenders. QUALITY_MATRIX=sampled is what `make
# check` runs (1800 light en + 390 dark pseudo-locale per route); `make evidence` runs `full` (x both
# schemes) unless LANES excludes `quality`. Needs the built package and playground deps, like `check`.
QUALITY_MATRIX ?= sampled
quality-matrix: browser-shell ## Quality matrix in a real browser: make quality-matrix [QUALITY_MATRIX=sampled|full]
	@$(call slot,quality-matrix) sh -c 'BASALT_MATRIX=$(QUALITY_MATRIX) bun --config=./packages/basalt-ui/tests/quality/matrix/bunfig.toml test --timeout 180000 $(bail) packages/basalt-ui/tests/quality/matrix'

# The matrix is 400 runs (~200 s) and only a UI input reaches a route: the package source, the matrix itself, the
# playground, a dependency bump. `check-fast` runs it when the branch (merge base with BASE, default origin/master,
# through the working tree, untracked files included) touched one of QUALITY_INPUTS; CI runs it on every head.
# No merge base to diff against: it runs. `make quality-matrix` and `make check` always run it.
QUALITY_INPUTS = packages/basalt-ui/src packages/basalt-ui/tests/quality packages/basalt-ui/tests/support packages/basalt-ui/package.json apps/playground package.json bun.lock
quality-matrix-fast: ## Quality matrix only when the branch touched a UI input (BASE=<ref>, default origin/master)
	@base="$$(git merge-base $(or $(BASE),origin/master) HEAD 2>/dev/null)"; \
	if [ -n "$$base" ] && [ -z "$$(git diff --name-only "$$base" -- $(QUALITY_INPUTS); git ls-files --others --exclude-standard -- $(QUALITY_INPUTS))" ]; then \
		echo "quality-matrix: no UI input changed since $(or $(BASE),origin/master); CI runs it on the head"; exit 0; \
	fi; \
	$(MAKE) --no-print-directory quality-matrix

# Design-parity board (scripts/evidence/compare.ts): crops each mapped playground pattern beside the local
# Keel reference (.design-parity/keel/) into .design-parity/<LABEL>/ unless OUT is given. Images and board.html
# never enter git; compare.json lands in .evidence/design-parity/<LABEL>/ (gitignored). Builds the playground unless DIST is given.
compare: ## Side-by-side design-parity board: make compare LABEL=<label> [OUT=<dir>] [DIST=<dir>] [PATTERNS=a,b]
	@test -n "$(LABEL)" || { echo "usage: make compare LABEL=<label> [OUT=<dir>] [DIST=<dir>] [PATTERNS=a,b]"; exit 2; }
	@bun scripts/evidence/compare.ts --label "$(LABEL)" $(if $(OUT),--out "$(OUT)") $(if $(DIST),--dist "$(DIST)") $(if $(PATTERNS),--patterns "$(PATTERNS)")

release-dry: ## Preview the next release — dry run only, publishes nothing
	@scripts/release.sh dry

release: ## Dry run, show the version bump, confirm, then publish to npm
	@scripts/release.sh

sync-self: ## Install basalt-ui's own shipped rules + skills into this repo's /.claude/ (dogfood)
	@bun packages/basalt-ui/scripts/sync-self.ts

# A lead runs this right before it merges its pull request: PR CI green for the exact HEAD, generated files in sync, master not moved under it.
merge-guard: ## Refuse unless PR CI is green for HEAD, generated files are in sync and master did not move under the branch (MERGE_GUARD_ARGS=--wait waits for the head's CI first)
	@bun scripts/merge-guard.ts $(MERGE_GUARD_ARGS)

gen-check: ## Generated docs in sync: gen-docs --check (JSDoc gate), then gen-recipes --check
	@bun packages/basalt-ui/scripts/gen-docs.ts --check
	@bun packages/basalt-ui/scripts/gen-recipes.ts --check
