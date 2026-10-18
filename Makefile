# Local quality gate: the same steps as the "quality" job of .github/workflows/ci.yml plus the
# function length ratchet (docs/QUALIDADE.md). Run `pnpm install` once before `make check`.

PNPM ?= pnpm
CHECK_POSTGRES_PORT ?= 5482
CHECK_POSTGRES_CONTAINER ?= rc-check-postgres
CHECK_POSTGRES_IMAGE ?= postgres:17-alpine
TEST_DATABASE_URL ?= postgres://castro:castro@localhost:$(CHECK_POSTGRES_PORT)/castro
FUNCTION_LENGTH = tools/quality/node_modules/.bin/tsx tools/quality/src/cli.ts

.DEFAULT_GOAL := help
.PHONY: help check packages contracts lint depcruise typecheck test test-db test-db-down web \
	function-length function-length-list function-length-baseline

help: ## List the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  %-26s %s\n", $$1, $$2}'

check: packages contracts lint depcruise typecheck function-length test web ## Everything the CI quality job checks
	@echo "make check: OK"

packages: ## Build the shared packages the apps import
	$(PNPM) --filter './packages/*' run build

contracts: ## OpenAPI and generated client match the API
	$(PNPM) --filter @rc/contracts generate
	git diff --exit-code packages/contracts

lint: ## ESLint and Prettier
	$(PNPM) lint

depcruise: ## Module boundaries of the API
	$(PNPM) depcruise

typecheck: ## TypeScript in every package
	$(PNPM) typecheck

test: test-db ## Unit and integration tests with 100% coverage
	TEST_DATABASE_URL=$(TEST_DATABASE_URL) $(PNPM) test

# A throwaway container on its own port, so it never touches the dev database of infra/compose.yaml.
test-db: ## PostgreSQL for the tests (skipped when TEST_DATABASE_URL comes from the environment)
ifneq ($(origin TEST_DATABASE_URL),environment)
	@docker inspect $(CHECK_POSTGRES_CONTAINER) >/dev/null 2>&1 || docker run --detach --rm \
		--name $(CHECK_POSTGRES_CONTAINER) --publish $(CHECK_POSTGRES_PORT):5432 \
		--env POSTGRES_USER=castro --env POSTGRES_PASSWORD=castro --env POSTGRES_DB=castro \
		$(CHECK_POSTGRES_IMAGE) >/dev/null
	@until docker exec $(CHECK_POSTGRES_CONTAINER) pg_isready -h 127.0.0.1 -U castro >/dev/null 2>&1; do sleep 1; done
endif

test-db-down: ## Remove the test PostgreSQL container
	docker rm --force $(CHECK_POSTGRES_CONTAINER)

web: ## Production build of the site
	$(PNPM) --filter @rc/web run build

function-length: ## Ratchet: no new function past 12 lines, no baselined function grows
	$(FUNCTION_LENGTH)

function-length-list: ## Every function past 12 lines, longest first
	$(FUNCTION_LENGTH) --list

function-length-baseline: ## Shrink tools/function_length_baseline.json; ALLOW_GROWTH=1 is exceptional
	$(FUNCTION_LENGTH) --write-baseline $(if $(ALLOW_GROWTH),--allow-growth)
