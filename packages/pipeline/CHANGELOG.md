## 0.22.1 (2026-03-13)

### 🩹 Fixes

- **pipeline:** inject VALUES into innermost subquery for per-class queries ([#234](https://github.com/ldelements/lde/pull/234))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.22.0 (2026-03-13)

### 🚀 Features

- **pipeline:** decouple SHACL validation from write path when onInvalid is 'write' ([#230](https://github.com/ldelements/lde/pull/230))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.21.0 (2026-03-12)

### 🚀 Features

- **pipeline:** add "Importing…" spinner with elapsed time ([#220](https://github.com/ldelements/lde/pull/220))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.20.0 (2026-03-09)

### 🚀 Features

- **pipeline:** add SHACL validation as a stage option ([#218](https://github.com/ldelements/lde/pull/218))

### ❤️ Thank You

- David de Boer

## 0.19.0 (2026-03-08)

### 🚀 Features

- **pipeline:** include triple count in import result reporting ([#217](https://github.com/ldelements/lde/pull/217))

### 🧱 Updated Dependencies

- Updated @lde/sparql-importer to 0.4.0

### ❤️ Thank You

- David de Boer @ddeboer

## 0.18.0 (2026-03-07)

### 🚀 Features

- **pipeline:** report distribution probe results as they complete ([#215](https://github.com/ldelements/lde/pull/215))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.17.1 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.7.3
- Updated @lde/sparql-importer to 0.3.1
- Updated @lde/dataset to 0.7.1

## 0.17.0 (2026-03-06)

### 🚀 Features

- **pipeline:** add distribution selection strategy to ImportResolver ([c3406b4](https://github.com/ldelements/lde/commit/c3406b4))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.16.0 (2026-03-06)

### 🚀 Features

- **pipeline:** show elapsed time and compact numbers during stage progress ([#208](https://github.com/ldelements/lde/pull/208))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.15.2 (2026-03-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.7.2

## 0.15.1 (2026-03-06)

### 🩹 Fixes

- **dataset-registry-client:** pass search criteria via ldkit's `where` option ([#205](https://github.com/ldelements/lde/pull/205))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.7.1

### ❤️ Thank You

- David de Boer @ddeboer

## 0.15.0 (2026-03-02)

### 🚀 Features

- **pipeline:** show dataset selection duration in console reporter ([#184](https://github.com/ldelements/lde/pull/184))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.14.0 (2026-03-02)

### 🚀 Features

- **pipeline:** add flush() to Writer and Turtle prefix support to FileWriter ([#182](https://github.com/ldelements/lde/pull/182))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.13.0 (2026-02-28)

### 🚀 Features

- **pipeline:** refactor ProgressReporter with domain objects and extract console reporter ([#178](https://github.com/ldelements/lde/pull/178))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.12.0 (2026-02-28)

### 🚀 Features

- **pipeline:** add distribution analysis and selection reporting ([#176](https://github.com/ldelements/lde/pull/176))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.11.0 (2026-02-27)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.7.0
- Updated @lde/sparql-importer to 0.3.0
- Updated @lde/dataset to 0.7.0

## 0.10.0 (2026-02-27)

### 🚀 Features

- **pipeline:** isolate errors per stage in processDataset() ([#160](https://github.com/ldelements/lde/pull/160))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.9.0 (2026-02-27)

### 🚀 Features

- **pipeline:** make FileWriter replacement character configurable ([#159](https://github.com/ldelements/lde/pull/159))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.8.1 (2026-02-27)

### 🩹 Fixes

- **pipeline:** preserve subjectFilter when importing distributions ([#150](https://github.com/ldelements/lde/pull/150))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.8.0 (2026-02-27)

### 🚀 Features

- change FileWriter default format to N-Triples ([#149](https://github.com/ldelements/lde/pull/149))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.7.1 (2026-02-20)

### 🩹 Fixes

- **pipeline:** clear graph and truncate file at most once per writer instance ([#140](https://github.com/ldelements/lde/pull/140))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.7.0 (2026-02-18)

### 🚀 Features

- document pipeline changes ([5489e18](https://github.com/ldelements/lde/commit/5489e18))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.32 (2026-02-16)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.17
- Updated @lde/local-sparql-endpoint to 0.2.12
- Updated @lde/sparql-importer to 0.2.10
- Updated @lde/sparql-server to 0.4.10
- Updated @lde/dataset to 0.6.10

## 0.6.31 (2026-02-16)

### 🚀 Features

- **pipeline:** add SparqlServer support to distribution resolver ([#118](https://github.com/ldelements/lde/pull/118))

### ❤️ Thank You

- David de Boer

## 0.6.30 (2026-02-16)

### 🩹 Fixes

- **pipeline:** don't mark empty distributions as valid ([#114](https://github.com/ldelements/lde/pull/114))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.29 (2026-02-16)

This was a version bump only for @lde/pipeline to align it with other projects, there were no code changes.

## 0.6.28 (2026-02-15)

This was a version bump only for @lde/pipeline to align it with other projects, there were no code changes.

## 0.6.27 (2026-02-15)

This was a version bump only for @lde/pipeline to align it with other projects, there were no code changes.

## 0.6.26 (2026-02-15)

### 🚀 Features

- **pipeline:** defer #subjectFilter# substitution to runtime ([#107](https://github.com/ldelements/lde/pull/107))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.25 (2026-02-13)

### 🚀 Features

- **pipeline:** rewrite Pipeline with multi-stage chaining ([#105](https://github.com/ldelements/lde/pull/105))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.16
- Updated @lde/local-sparql-endpoint to 0.2.11
- Updated @lde/sparql-importer to 0.2.9
- Updated @lde/dataset to 0.6.9

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.24 (2026-02-13)

### 🚀 Features

- **pipeline:** add concurrent executor execution in Stage.run() ([#103](https://github.com/ldelements/lde/pull/103))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.15
- Updated @lde/local-sparql-endpoint to 0.2.10

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.23 (2026-02-12)

### 🚀 Features

- **pipeline:** support authentication in SparqlUpdateWriter ([#91](https://github.com/ldelements/lde/pull/91))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.22 (2026-02-12)

This was a version bump only for @lde/pipeline to align it with other projects, there were no code changes.

## 0.6.21 (2026-02-12)

### 🚀 Features

- **pipeline:** add CLEAR GRAPH and on-the-fly batching to SparqlUpdateWriter ([#89](https://github.com/ldelements/lde/pull/89))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.20 (2026-02-12)

### 🚀 Features

- **pipeline:** integrate Writer into Stage.run() ([#87](https://github.com/ldelements/lde/pull/87))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.19 (2026-02-12)

### 🚀 Features

- **pipeline:** batch selector bindings to executor ([#85](https://github.com/ldelements/lde/pull/85))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.18 (2026-02-12)

### 🚀 Features

- **pipeline:** add resolveDistributions stage function ([#84](https://github.com/ldelements/lde/pull/84), [#76](https://github.com/ldelements/lde/issues/76))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.17 (2026-02-12)

This was a version bump only for @lde/pipeline to align it with other projects, there were no code changes.

## 0.6.16 (2026-02-12)

This was a version bump only for @lde/pipeline to align it with other projects, there were no code changes.

## 0.6.15 (2026-02-11)

### 🚀 Features

- **pipeline:** extract DistributionResolver, pass distribution explicitly ([#73](https://github.com/ldelements/lde/pull/73))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.14 (2026-02-11)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.14
- Updated @lde/local-sparql-endpoint to 0.2.9
- Updated @lde/sparql-importer to 0.2.8
- Updated @lde/sparql-server to 0.4.8
- Updated @lde/dataset to 0.6.8

## 0.6.13 (2026-02-09)

### 🚀 Features

- **pipeline:** AST-based query manipulation for SparqlConstructExecutor ([#69](https://github.com/ldelements/lde/pull/69))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.12 (2026-02-09)

### 🚀 Features

- **pipeline:** add StageSelector interface and SparqlSelector ([#68](https://github.com/ldelements/lde/pull/68))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.12
- Updated @lde/local-sparql-endpoint to 0.2.7
- Updated @lde/sparql-importer to 0.2.6
- Updated @lde/sparql-server to 0.4.6
- Updated @lde/dataset to 0.6.6

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.11 (2026-02-09)

### 🚀 Features

- **pipeline:** add Stage abstraction for pipeline composition ([#67](https://github.com/ldelements/lde/pull/67))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.11
- Updated @lde/local-sparql-endpoint to 0.2.6

### ❤️ Thank You

- David de Boer @ddeboer

## 0.6.10 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.10
- Updated @lde/sparql-importer to 0.2.5
- Updated @lde/sparql-server to 0.4.5
- Updated @lde/dataset to 0.6.5

## 0.6.9 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.9
- Updated @lde/local-sparql-endpoint to 0.2.5

## 0.6.8 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.8
- Updated @lde/sparql-importer to 0.2.4
- Updated @lde/sparql-server to 0.4.4
- Updated @lde/dataset to 0.6.4

## 0.6.7 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.7
- Updated @lde/local-sparql-endpoint to 0.2.4

## 0.6.6 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.6
- Updated @lde/sparql-importer to 0.2.3
- Updated @lde/sparql-server to 0.4.3
- Updated @lde/dataset to 0.6.3

## 0.6.5 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.5
- Updated @lde/local-sparql-endpoint to 0.2.3

## 0.6.4 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.4
- Updated @lde/sparql-importer to 0.2.2
- Updated @lde/sparql-server to 0.4.2
- Updated @lde/dataset to 0.6.2

## 0.6.3 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.3
- Updated @lde/local-sparql-endpoint to 0.2.2

## 0.6.2 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.2
- Updated @lde/sparql-importer to 0.2.1
- Updated @lde/sparql-server to 0.4.1
- Updated @lde/dataset to 0.6.1

## 0.6.1 (2026-02-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.1
- Updated @lde/local-sparql-endpoint to 0.2.1

## 0.6.0 (2026-02-07)

### 🚀 Features

- add pipeline-void package and extend pipeline with analyzers, writers, and SPARQL utilities ([#48](https://github.com/ldelements/lde/pull/48))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.6.0
- Updated @lde/local-sparql-endpoint to 0.2.0
- Updated @lde/sparql-importer to 0.2.0
- Updated @lde/sparql-server to 0.4.0
- Updated @lde/dataset to 0.6.0

### ❤️ Thank You

- David de Boer @ddeboer

## 0.5.1 (2026-02-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.5.0
- Updated @lde/local-sparql-endpoint to 0.1.0
- Updated @lde/sparql-importer to 0.1.0
- Updated @lde/sparql-server to 0.3.0
- Updated @lde/dataset to 0.5.0

## 0.5.0 (2026-01-22)

### 🚀 Features

- **sparql-monitor:** add CLI with TypeScript config support ([#38](https://github.com/ldelements/lde/pull/38))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.4.0 (2026-01-20)

### 🚀 Features

- add @lde/sparql-monitor package ([#37](https://github.com/ldelements/lde/pull/37))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.3.8 (2025-10-09)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.4.4
- Updated @lde/sparql-importer to 0.0.9
- Updated @lde/dataset to 0.4.2

## 0.3.7 (2025-10-06)

### 🩹 Fixes

- add repository URL ([7bb2f77](https://github.com/ldelements/lde/commit/7bb2f77))

### ❤️ Thank You

- David de Boer @ddeboer

## 0.3.6 (2025-10-06)

### 🧱 Updated Dependencies

- Updated @lde/sparql-importer to 0.0.8

## 0.3.5 (2025-10-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.4.3
- Updated @lde/local-sparql-endpoint to 0.0.3
- Updated @lde/sparql-server to 0.2.2

## 0.3.4 (2025-10-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.4.2
- Updated @lde/sparql-importer to 0.0.7
- Updated @lde/dataset to 0.4.1

## 0.3.3 (2025-10-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.4.1
- Updated @lde/sparql-importer to 0.0.6
- Updated @lde/dataset to 0.4.0

## 0.3.2 (2025-08-06)

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.4.0

## 0.3.1 (2025-07-31)

### 🩹 Fixes

- standardize exports field order in all packages ([#20](https://github.com/ldelements/lde/pull/20))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.3.1
- Updated @lde/local-sparql-endpoint to 0.0.2
- Updated @lde/sparql-importer to 0.0.5
- Updated @lde/sparql-server to 0.2.1
- Updated @lde/dataset to 0.3.1

### ❤️ Thank You

- David de Boer @ddeboer

## 0.3.0 (2025-07-29)

### 🚀 Features

- extend dataset properties ([#15](https://github.com/ldelements/lde/pull/15))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.3.0
- Updated @lde/sparql-importer to 0.0.4
- Updated @lde/dataset to 0.3.0

### ❤️ Thank You

- David de Boer @ddeboer

## 0.2.0 (2025-07-28)

### 🚀 Features

- add pipeline ([#11](https://github.com/ldelements/lde/pull/11))

### 🧱 Updated Dependencies

- Updated @lde/dataset-registry-client to 0.2.0
- Updated @lde/sparql-importer to 0.0.3
- Updated @lde/sparql-server to 0.2.0
- Updated @lde/dataset to 0.2.0

### ❤️ Thank You

- David de Boer @ddeboer