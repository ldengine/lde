export interface ProgressReporter {
  pipelineStart(name: string): void;
  datasetStart(dataset: string): void;
  stageStart(stage: string): void;
  stageProgress(update: {
    elementsProcessed: number;
    quadsGenerated: number;
  }): void;
  stageComplete(
    stage: string,
    result: {
      elementsProcessed: number;
      quadsGenerated: number;
      duration: number;
    }
  ): void;
  stageSkipped(stage: string, reason: string): void;
  datasetComplete(dataset: string): void;
  datasetSkipped(dataset: string, reason: string): void;
  pipelineComplete(result: { duration: number }): void;
}
