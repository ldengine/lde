import { Dataset, Distribution } from '@lde/dataset';
import {
  Failure,
  Finishable,
  NotSupported,
  SingleStep,
  Success,
} from './step.js';
import {
  Importer,
  ImportFailed,
  NotSupported as ImporterNotSupported,
} from '@lde/sparql-importer';
import { SparqlServer } from '@lde/sparql-server';

/**
 * A pipeline step that imports a database using an {@link Importer} and makes
 * the import available at a local SPARQL endpoint.
 */
export class Import implements SingleStep, Finishable {
  public readonly identifier = 'import';
  private readonly importer: Importer;
  private readonly server: SparqlServer;
  private readonly forceImport: boolean;

  /**
   * Create a Pipeline ImportStep.
   *
   * @param {object} args
   * @param args.importer A concrete importer that will import the distribution if needed.
   * @param args.server SPARQL server that will be started to serve the imported data.
   * @param args.forceImport Whether to force an import even if the dataset already has a SPARQL distribution.
   */
  constructor({
    importer,
    server,
    forceImport,
  }: {
    importer: Importer;
    server: SparqlServer;
    forceImport?: boolean;
  }) {
    this.importer = importer;
    this.server = server;
    this.forceImport = forceImport ?? false;
  }

  public async execute(
    dataset: Dataset
  ): Promise<NotSupported | Failure | Success> {
    if (dataset.getSparqlDistribution()?.isValid && !this.forceImport) {
      return new NotSupported(
        'A valid SPARQL distribution is available so no import needed'
      );
    }

    const result = await this.importer.import(dataset);
    if (result instanceof ImporterNotSupported) {
      return new NotSupported('No download distribution available');
    }

    if (result instanceof ImportFailed) {
      return new Failure(result.distribution, result.error);
    }

    await this.server.start();

    dataset.distributions.push(Distribution.sparql(this.server.queryEndpoint));

    return new Success(dataset, result.distribution);
  }

  public async finish(): Promise<void> {
    await this.server.stop();
  }
}
