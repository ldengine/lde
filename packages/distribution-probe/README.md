# Distribution Probe

Probes a DCAT `Distribution` to check availability and gather metadata. Returns `SparqlProbeResult`, `DataDumpProbeResult`, or `NetworkError` – the probe never throws.

```ts
import { Distribution } from '@lde/dataset';
import { probe } from '@lde/distribution-probe';

const distribution = new Distribution(
  new URL('https://example.org/data.ttl'),
  'text/turtle',
);
const result = await probe(distribution);
```

## Behaviour

### SPARQL endpoints

Sends `POST` with `SELECT * { ?s ?p ?o } LIMIT 1` and `Accept: application/sparql-results+json`, then:

- **Content-Type is enforced.** The response Content-Type must start with `application/sparql-results+json`; anything else fails the probe (`isSuccess() === false`). This rules out HTML error pages served with `200 OK`.
- The JSON body must parse and contain a `results` object. Empty bodies, invalid JSON, and missing `results` all fail the probe with a `failureReason`.

### Data dumps

Sends `HEAD` with `Accept: <distribution.mimeType>` and `Accept-Encoding: identity`. If `Content-Length` is missing or ≤ 10 KB, retries with `GET` to validate the body – this also catches servers that return `0` from `HEAD`.

- **Content-Type is checked as a soft warning, not a hard failure.** If the server’s Content-Type disagrees with the distribution’s declared `mimeType`, a message is appended to `result.warnings` but `isSuccess()` stays `true`. Compression wrappers (`application/gzip`, `application/x-gzip`, `application/octet-stream`) are skipped so a gzipped Turtle file doesn’t trigger a warning.
- **Body is parse-validated only for Turtle, N-Triples, and N-Quads** (Content-Type starting with `text/turtle`, `application/n-triples`, or `application/n-quads`). Empty bodies and parse errors fail the probe. Other RDF serializations (RDF/XML, JSON-LD, TriG, …) are not parse-validated – only HTTP status and headers are checked.
- Bodies larger than 10 KB are not fetched; only `HEAD` metadata is inspected.

### Network errors

Any thrown exception from `fetch` (DNS, connection refused, TLS, timeout after the configured `timeout` – default 5 000 ms) is caught and returned as a `NetworkError` with the original message.
