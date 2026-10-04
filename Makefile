.DEFAULT_GOAL := help
.PHONY: help check verify deploy logs pre test layout build release release-dry sync-self

help: ## List targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# The local gate: the validation CI runs (.github/workflows/ci.yml), all in one target. Builds FIRST
# on purpose — `bun run pre` runs `check-theme`, and the playground's typecheck resolves
# `basalt-ui/*` through the package's `exports` — both read `dist`, not the working tree, so a gate
# that built last would grade the previous build (packages/basalt-ui/CLAUDE.md, "a gate reading
# dist"). `pack-test` rebuilds anyway; the point of the first build is what `pre` reads.
check: ## Local CI gate: gen sync checks + build + pre + layout + coverage/doc-drift + pack-test
	@bun packages/basalt-ui/scripts/gen-oxlint.ts --check
	@bun packages/basalt-ui/scripts/gen-llms.ts --check
	@cd packages/basalt-ui && bun run build
	@bun run pre
	@bun run test:layout
	@bun packages/basalt-ui/scripts/check-coverage.ts --check
	@bun packages/basalt-ui/scripts/check-agent-doc-drift.ts
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
	@bun run test:layout

build: ## Build the published package (dist-first tsup + declarations)
	@cd packages/basalt-ui && bun run build

release-dry: ## Preview the next release — dry run only, publishes nothing
	@scripts/release.sh dry

release: ## Dry run, show the version bump, confirm, then publish to npm
	@scripts/release.sh

sync-self: ## Install basalt-ui's own shipped rules + skills into this repo's /.claude/ (dogfood)
	@bun packages/basalt-ui/scripts/sync-self.ts
