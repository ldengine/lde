# @lde/sparql-monitor — DEPRECATED

This package has been renamed to [`@lde/distribution-monitor`](../distribution-monitor) to reflect its broader scope: it monitors DCAT distributions, including SPARQL endpoints **and** data dumps.

## Migration

```bash
npm uninstall @lde/sparql-monitor
npm install @lde/distribution-monitor
```

The configuration schema has changed. See the [`@lde/distribution-monitor` README](../distribution-monitor/README.md) for the new shape (`distribution.accessUrl`, `distribution.mediaType`, `distribution.conformsTo`, `sparqlQuery`).

This shim package re-exports `@lde/distribution-monitor` and prints a deprecation warning on import. It will be removed from the workspace after the deprecation has been in effect for one minor version.
