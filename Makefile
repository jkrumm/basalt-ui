.DEFAULT_GOAL := help
.PHONY: help pre verify test layout build release release-dry

help: ## List targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

pre: ## fmt:check + lint + typecheck + check-theme + bun test (run before committing)
	@bun run pre

# Builds FIRST on purpose. `bun run pre` runs `check-theme`, and the playground's typecheck
# resolves `basalt-ui/*` through the package's `exports` — both read `dist`, not the working tree,
# so a verify that built last would grade the previous build (packages/basalt-ui/CLAUDE.md, "a gate
# reading dist"). `pack-test` rebuilds anyway; the point of the first build is what `pre` reads.
verify: ## build + pre + the layout suite + the dist gate (pack-test) — the full gate
	@cd packages/basalt-ui && bun run build
	@bun run pre
	@bun run test:layout
	@cd packages/basalt-ui && bun run pack-test

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
