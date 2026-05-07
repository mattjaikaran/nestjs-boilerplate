.PHONY: help setup install dev build start stop lint lint-fix format check typecheck \
        test test-watch test-cov test-e2e \
        db-up db-down db-reset db-migrate db-generate db-push db-studio db-seed \
        docker-up docker-down docker-logs docker-build docker-rebuild \
        docker-prod-up docker-prod-down docker-prod-build docker-prod-rebuild docker-prod-logs \
        clean generate deps-check ci

# Colors
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
CYAN   := $(shell tput -Txterm setaf 6)
RESET  := $(shell tput -Txterm sgr0)

##@ Setup
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\n${CYAN}NestJS Boilerplate — Make Commands${RESET}\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  ${YELLOW}%-22s${RESET} %s\n", $$1, $$2 } /^##@/ { printf "\n${GREEN}%s${RESET}\n", substr($$0, 5) }' $(MAKEFILE_LIST)

setup: install ## Full first-run setup (install deps, copy .env)
	@cp -n .env.example .env 2>/dev/null && echo "✅ .env created from .env.example" || echo "ℹ️  .env already exists"
	@echo "✅ Setup complete. Run 'make db-up && make db-migrate && make db-seed' to initialise the database."

install: ## Install dependencies with bun
	@bun install

##@ Development
dev: ## Start dev server with watch mode
	@bun run start:dev

start: ## Start built server
	@bun run start:prod

debug: ## Start dev server with debug
	@bun run start:debug

build: ## Compile with SWC
	@bun run build

clean: ## Remove build artifacts
	@rm -rf dist coverage .jest-cache

##@ Code Quality
lint: ## Run Biome linter
	@bun run lint

lint-fix: ## Run Biome linter and auto-fix
	@bun run lint:fix

format: ## Run Biome formatter
	@bun run format

check: ## Run Biome check (lint + format)
	@bun run check

check-fix: ## Run Biome check and auto-fix
	@bun run check:fix

typecheck: ## TypeScript type check (no emit)
	@bun run typecheck

##@ Testing
test: ## Run unit tests
	@bun run test

test-watch: ## Run unit tests in watch mode
	@bun run test:watch

test-cov: ## Run unit tests with coverage
	@bun run test:cov

test-e2e: ## Run E2E tests
	@bun run test:e2e

ci: lint typecheck test-cov ## Run full CI check locally (lint + typecheck + tests)

##@ Database
db-up: ## Start database container
	@docker compose up -d postgres
	@echo "✅ PostgreSQL started on port 5432"

db-down: ## Stop database container
	@docker compose down postgres

db-migrate: ## Run pending migrations
	@bun run db:migrate

db-generate: ## Generate migration from schema changes
	@bun run db:generate

db-push: ## Push schema directly (dev only — bypasses migration files)
	@bun run db:push

db-studio: ## Open Drizzle Studio (browser DB viewer)
	@bun run db:studio

db-seed: ## Seed the database
	@bun run db:seed

db-reset: ## Reset database schema (DESTRUCTIVE)
	@read -p "Reset database? This will DROP everything. [y/N] " confirm && [ "$$confirm" = "y" ] && bun run db:reset || echo "Aborted"

##@ Docker
docker-up: ## Start all dev containers (postgres + redis + api)
	@docker compose up -d

docker-down: ## Stop all dev containers
	@docker compose down

docker-logs: ## Tail container logs
	@docker compose logs -f

docker-build: ## Build dev Docker image
	@docker compose build

docker-rebuild: ## Force rebuild dev image (no cache) then start
	@docker compose build --no-cache
	@docker compose up -d

docker-prod-up: ## Start production containers
	@docker compose -f docker-compose.prod.yml up -d

docker-prod-down: ## Stop production containers
	@docker compose -f docker-compose.prod.yml down

docker-prod-build: ## Build production Docker image
	@docker compose -f docker-compose.prod.yml build

docker-prod-rebuild: ## Force rebuild production image (no cache)
	@docker compose -f docker-compose.prod.yml build --no-cache

docker-prod-logs: ## Tail production container logs
	@docker compose -f docker-compose.prod.yml logs -f

##@ Generators
generate: ## Scaffold a new NestJS module (interactive)
	@bun run generate

##@ Dependencies
deps-check: ## Check for outdated dependencies
	@bun outdated
