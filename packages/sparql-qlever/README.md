# SPARQL QLever

An adapter for the [QLever](https://github.com/ad-freiburg/qlever) SPARQL server.

## Index caching

Building a QLever index is slow. To avoid rebuilding it on every pipeline run, the importer caches a single index per `indexName` and reuses it when the source data hasn't changed.

After a successful `qlever-index`, a `{indexName}.cache-info.json` marker is written next to the data file. On subsequent runs the marker is checked: if the recorded source file matches and the data file hasn't been re-downloaded (mtime comparison), indexing is skipped entirely.

Only **one** index is cached at a time. In a multi-dataset pipeline that shares an `indexName`, each dataset overwrites the previous index. When the pipeline re-runs, a dataset whose source file doesn't match the marker triggers a fresh index build, while the dataset that was indexed last gets a cache hit.

Caching is enabled by default. Disable it by passing `cacheIndex: false` to `createQlever()` or the `Importer` constructor (e.g. driven by a `QLEVER_CACHE_INDEX=false` environment variable).
