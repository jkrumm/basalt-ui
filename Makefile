.DEFAULT_GOAL := help
.PHONY: help pre test build release release-dry

help: ## List targets
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

pre: ## fmt:check + lint + typecheck + check-theme (run before committing)
	@bun run pre

test: ## Run the test suite
	@bun test

build: ## Build the published package (dist-first tsup + declarations)
	@cd packages/basalt-ui && bun run build

release-dry: ## Preview the next release — dry run only, publishes nothing
	@scripts/release.sh dry

release: ## Dry run, show the version bump, confirm, then publish to npm
	@scripts/release.sh
