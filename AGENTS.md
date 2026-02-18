# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

LDE (Linked Data Engine) is an Nx monorepo of Node.js libraries for building Linked Data applications and pipelines.
Built on SPARQL, SHACL, and DCAT-AP 3.0 standards.
Uses TypeScript with ESNext modules and Vite for building/testing.

## Documentation

- Record architecture decisions in @docs/decisions following the ADR format.
  ADR titles start with a verb (e.g. ‘Merge pipeline approaches’).

## Development

- We’re pre-release, so be aggressive about removing dead code. Do not yet care about backward compatibility.

## Development Commands

### Building

- `npx nx build <package-name>` - Build a specific package
- `npx nx run-many -t build` - Build all packages

### Testing

- `npx nx test <package-name>` - Run tests for a specific package (Vitest)
- `npx nx run-many -t test` - Run all tests
- `npx vitest <test-file-path>` - Run individual test file

### Linting and Type Checking

- `npx nx lint <package-name>` - Lint a specific package
- `npx nx typecheck <package-name>` - Type check a specific package
- `npx nx run-many -t lint typecheck` - Lint and type check all packages

### Affected Commands

- `npx nx affected -t lint test typecheck build` - Run tasks only on changed packages (used in CI)

## Architecture

### Package Structure

Packages live in `/packages/` with `@lde/` scope:

- **Data**: `dataset`, `dataset-registry-client` (DCAT-AP 3.0 discovery)
- **Processing**: `distribution-download`, `sparql-importer`, `sparql-qlever`, `pipeline`
- **Infrastructure**: `local-sparql-endpoint`, `wait-for-sparql`, `task-runner*`
- **Documentation**: `docgen` (SHACL shapes to docs)
- **Web**: `fastify-rdf` (RDF content negotiation plugin)

### TypeScript Configuration

- Module resolution: `nodenext` (ESM)
- Strict mode enabled with composite projects for incremental builds
- Each package has `tsconfig.json`, `tsconfig.lib.json`, and `tsconfig.spec.json`

### Package Exports

Each package uses conditional exports with a `development` condition for local development:

```json
"exports": {
  ".": {
    "development": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```

### Testing

- Vitest with coverage via `@vitest/coverage-v8`
- Test files use `.test.ts` suffix in `test/` directory
- Fixtures in `test/fixtures/`
- HTTP mocking with Nock
- Tests that start a local SPARQL endpoint (`@lde/local-sparql-endpoint`) must use unique ports across packages to avoid conflicts when Nx runs tests in parallel. Current port allocations: `dataset-registry-client` (3002), `pipeline` sparqlQuery (3001), `pipeline` executor (3003)

### Key Dependencies

- RDF: `n3`, `sparqljs`, `jsonld`
- Query engines: `@comunica/query-sparql-file`, `ldkit`
- CLI packages use Commander

## Creating New Packages

- Use Nx generators: packages are TypeScript libraries with ESLint and Vitest
- Configure Nx in `package.json` (not `project.json`)
- Add `development` condition in exports for local dev
- Add README.md similar to other packages
- Add the package to root README.md
- For CLIs, use Commander and expose version from `package.json`

## CI/CD

### GitHub Actions

- `.github/workflows/ci.yml` - Runs tests, linting, and builds on PRs and main branch pushes
- `.github/workflows/release.yml` - Automated releases on main branch pushes using `nx release`

### Release

- Automated releases via GitHub Actions on pushes to main
- Uses conventional commits for version determination
- Independent versioning per package
- Uses NPM OIDC Trusted Publishing

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
