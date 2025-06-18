# LDE – Linked Data Engine

LDE is a suite of Node.js libraries that power your Linked Data applications and pipelines.

## Packages

* [@lde/dataset](packages/dataset): core objects dataset and distribution
* [@lde/dataset-registry-client](packages/dataset-registry-client): retrieve dataset descriptions from DCAT-AP 3.0 registries
* [@lde/dataset-analyzer-pipeline](packages/dataset-analyzer-pipeline): statistical analysis of datasets
* [@lde/distribution-download](packages/distribution-download): download distributions for processing locally
* [@lde/pipeline](packages/pipeline): build pipelines that query, transform and enrich Linked Data
* [@lde/sparql-importer](packages/sparql-importer): import data dumps to a local SPARQL endpoint for querying
* [@lde/sparql-qlever](packages/sparql-qlever): QLever SPARQL adapter for importing and serving data
* [@lde/task-runner](packages/task-runner): task runner core classes and interfaces
* [@lde/task-runner-docker](packages/task-runner-docker): run tasks in Docker containers
* [@lde/task-runner-native](packages/task-runner-native): run tasks natively on the host system
* [@lde/wait-for-sparql](packages/wait-for-sparql): wait for a SPARQL endpoint to become available
