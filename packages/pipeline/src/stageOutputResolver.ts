import { Distribution } from '@lde/dataset';

export interface StageOutputResolver {
  resolve(outputPath: string): Promise<Distribution>;
  cleanup(): Promise<void>;
}
