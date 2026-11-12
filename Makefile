.DEFAULT_GOAL := help
.PHONY: help check gen-check verify deploy logs pre test layout build evidence compare release release-dry sync-self merge-guard quality-matrix

help: ## List targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# The browser steps run in one of the host's test slots when `factory` is installed, so two leads' layout
# runs never overlap (each is a Chrome tree on a shared 32 GB host); without it (CI) the bare command. It
# fails open: a server that is down or a full house runs the suite anyway.
SLOT = $(if $(shell command -v factory 2>/dev/null),factory slot run --name "$(notdir $(CURDIR)) layout" --,)

# The local gate: the validation CI runs (.github/workflows/ci.yml), all in one target. Builds FIRST
# on purpose — `bun run pre` runs `check-theme`, and the playground's typecheck resolves
# `basalt-ui/*` through the package's `exports` — both read `dist`, not the working tree, so a gate
# that built last would grade the previous build (packages/basalt-ui/MAINTAINING.md, "a gate reading
# dist"). `pack-test` rebuilds anyway; the point of the first build is what `pre` reads.
check: ## Local CI gate: gen sync checks + build + pre + playground build + layout + coverage/doc-drift + pack-test
	@bun packages/basalt-ui/scripts/gen-oxlint.ts --check
	@$(MAKE) --no-print-directory gen-check
	@cd packages/basalt-ui && bun run build
	@bun run pre
	@bun --filter @basalt-ui/playground build
	@$(SLOT) sh -c 'bun run test:layout && bun run test:layout:harness'
	@$(MAKE) --no-print-directory quality-matrix
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

pre: ## fmt:check + lint + typecheck + check-theme + bun test (run before committing)
	@bun run pre

test: ## Run the test suite
	@bun test

layout: ## Run the layout regression suite (real CSS geometry, headless Chrome)
	@$(SLOT) sh -c 'bun run test:layout && bun run test:layout:harness'

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
quality-matrix: ## Quality matrix in real Chrome: make quality-matrix [QUALITY_MATRIX=sampled|full]
	@$(SLOT) sh -c 'BASALT_MATRIX=$(QUALITY_MATRIX) bun --config=./packages/basalt-ui/tests/quality/matrix/bunfig.toml test --timeout 180000 packages/basalt-ui/tests/quality/matrix'

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
