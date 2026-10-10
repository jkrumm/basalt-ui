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

# Production probe, NOT the local gate (`make check`). basalt-ui is a published library with no
# runtime of its own to ping, so "live" is the registry serving a version at least as new as this
# checkout: `npm view basalt-ui version` equal to or newer than packages/basalt-ui/package.json
# exits 0, while an unreachable registry or an OLDER published version exits non-zero with the why.
verify: ## Probe production — exit 0 when the published npm package is live
	@local=$$(node -p "require('./packages/basalt-ui/package.json').version"); \
	registry=$$(timeout 20 npm view basalt-ui version 2>/dev/null); \
	if [ -z "$$registry" ]; then \
		echo "verify: npm registry unreachable — 'timeout 20 npm view basalt-ui version' returned nothing"; \
		exit 1; \
	fi; \
	if [ "$$registry" != "$$local" ] && \
		[ "$$registry" != "$$(printf '%s\n%s\n' "$$local" "$$registry" | sort -V | tail -n1)" ]; then \
		echo "verify: npm serves basalt-ui@$$registry, OLDER than local $$local"; \
		exit 1; \
	fi; \
	echo "OK basalt-ui@$$registry is live on npm (local $$local)"

# Publishing is `make release` (below), not a deploy — there is nothing for a deploy target to do.
deploy: ## No-op — publishing is `make release`
	@echo "published by make release; nothing to deploy"

# A published library has no runtime to tail: it is files on npm, not a server or a container.
logs: ## No-op — a library has no runtime logs
	@echo "library: no runtime logs"

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
