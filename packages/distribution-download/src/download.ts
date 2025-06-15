import { Distribution } from '@lde/dataset';
import filenamifyUrl from 'filenamify-url';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';

export class Downloader {
  constructor(private readonly path = 'imports') {}

  public async download(
    distribution: Distribution,
    target = join(this.path, filenamifyUrl(distribution.accessUrl))
  ): Promise<string> {
    const downloadUrl = distribution.accessUrl;
    const filePath = resolve(target);

    if (await this.localFileIsUpToDate(filePath, distribution.lastModified)) {
      return filePath;
    }

    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok || !downloadResponse.body) {
      throw new Error(
        `Failed to download ${downloadUrl}: ${downloadResponse.statusText}`
      );
    }

    try {
      await pipeline(downloadResponse.body, createWriteStream(filePath));
    } catch (error) {
      throw new Error(`Failed to save ${downloadUrl} to ${filePath}: ${error}`);
    }

    const stats = await stat(filePath);
    if (stats.size <= 1) {
      throw new Error('Distribution download is empty');
    }

    return filePath;
  }

  private async localFileIsUpToDate(
    filePath: string,
    lastModified?: Date
  ): Promise<boolean> {
    if (undefined === lastModified) {
      return false;
    }

    try {
      await access(filePath);
    } catch {
      return false;
    }
    const stats = await stat(filePath);
    const fileDate = stats.mtime;

    return fileDate >= lastModified;
  }
}
