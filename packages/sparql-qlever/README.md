# SPARQL QLever

An adapter for the [QLever](https://github.com/ad-freiburg/qlever) SPARQL server.

## Index caching

Building a QLever index is slow. To avoid rebuilding it on every pipeline run, the importer caches a single index and reuses it when the source data hasn't changed. On subsequent runs, indexing is skipped when the source file matches and hasn't been re-downloaded.

Only **one** index is cached at a time. In a multi-dataset pipeline, each dataset overwrites the previous index. On re-run, the last-indexed dataset gets a cache hit while the others rebuild.

Caching is enabled by default. Disable it by passing `cacheIndex: false` to `createQlever()` or the `Importer` constructor (e.g. driven by a `QLEVER_CACHE_INDEX=false` environment variable).
