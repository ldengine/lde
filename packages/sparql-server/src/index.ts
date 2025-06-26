export interface SparqlServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  queryEndpoint: URL;
}
