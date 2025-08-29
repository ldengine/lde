# LDE – Linked Data Engine

LDE is a suite of Node.js libraries to power your Linked Data applications and pipelines.
Use it to efficiently query, analyze, transform, enrich and validate RDF datasets.

LDE is built on standards including SPARQL, SHACL and DCAT-AP 3.0.

## Features

* Discover and retrieve datasets from DCAT-AP 3.0 registries.
* Query and transform datasets with pure SPARQL queries (instead of code or a DSL): no vendor lock-in.
* Use SPARQL endpoints directly when possible; import data dumps to a local endpoint when necessary.
* Compose pipelines with YAML (for non-technical users) or TypeScript code (for developers). 
* Get started quickly with ready-to-use Docker images.

## Packages

LDE is an [Nx](https://nx.dev) monorepo that includes the following packages:

* [x] [@lde/dataset](packages/dataset): core objects dataset and distribution
* [ ] [@lde/dataset-analyzer-pipeline](packages/dataset-analyzer-pipeline): statistical analysis of datasets
* [x] [@lde/dataset-registry-client](packages/dataset-registry-client): retrieve dataset descriptions from DCAT-AP 3.0 registries
* [x] [@lde/distribution-download](packages/distribution-download): download distributions for processing locally
* [x] [@lde/local-sparql-endpoint](packages/pipeline): quickly start a local SPARQL endpoint for testing and development
* [ ] [@lde/pipeline](packages/pipeline): build pipelines that query, transform and enrich Linked Data
* [ ] [@lde/docgen](packages/docgen): generate documentation from RDF such as SHACL shapes
* [x] [@lde/sparql-importer](packages/sparql-importer): import data dumps to a local SPARQL endpoint for querying
* [x] [@lde/sparql-qlever](packages/sparql-qlever): QLever SPARQL adapter for importing and serving data
* [ ] [@lde/task-runner](packages/task-runner): task runner core classes and interfaces
* [ ] [@lde/task-runner-docker](packages/task-runner-docker): run tasks in Docker containers
* [ ] [@lde/task-runner-native](packages/task-runner-native): run tasks natively on the host system
* [ ] [@lde/validator](packages/validator): validate datasets and pipeline outputs against SHACL shapes
* [x] [@lde/wait-for-sparql](packages/wait-for-sparql): wait for a SPARQL endpoint to become available
