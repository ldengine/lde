import type { Dataset, Distribution } from '@lde/dataset';

export interface DistributionAnalysisResult {
  distribution: Distribution;
  type: 'sparql' | 'data-dump' | 'network-error';
  available: boolean;
  statusCode?: number;
  error?: string;
}

export interface ProgressReporter {
  pipelineStart?(name: string): void;
  datasetsSelected?(count: number): void;
  datasetStart?(dataset: Dataset): void;
  distributionsAnalyzed?(
    dataset: Dataset,
    results: DistributionAnalysisResult[],
  ): void;
  distributionSelected?(
    dataset: Dataset,
    distribution: Distribution,
    importedFrom?: Distribution,
    importDuration?: number,
  ): void;
  stageStart?(stage: string): void;
  stageProgress?(update: {
    elementsProcessed: number;
    quadsGenerated: number;
  }): void;
  stageComplete?(
    stage: string,
    result: {
      elementsProcessed: number;
      quadsGenerated: number;
      duration: number;
    },
  ): void;
  stageFailed?(stage: string, error: Error): void;
  stageSkipped?(stage: string, reason: string): void;
  datasetComplete?(dataset: Dataset): void;
  datasetSkipped?(dataset: Dataset, reason: string): void;
  pipelineComplete?(result: { duration: number }): void;
}
