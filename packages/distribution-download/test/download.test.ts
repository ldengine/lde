import { Distribution } from '@lde/dataset';
import { LastModifiedDownloader } from '../src/download.js';
import nock from 'nock';
import { join } from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
const localFile = join(os.tmpdir(), 'example.com!file.nt');
const downloader = new LastModifiedDownloader(os.tmpdir());
const distribution = new Distribution(
  'https://example.com/file.nt',
  'application/n-triples'
);

describe('LastModifiedDownloader', () => {
  afterAll(async () => {
    nock.restore();
  });

  describe('download', () => {
    beforeEach(async () => {
      try {
        await fs.unlink(localFile);
      } catch {
        // Ignore if not exists.
      }
    });

    it('downloads file', async () => {
      nock('https://example.com').get('/file.nt').reply(200, 'mock file');

      const filePath = await downloader.download(distribution);
      expect(filePath).toBe(localFile);

      const fileContent = await fs.readFile(localFile, 'utf8');
      expect(fileContent).toBe('mock file');
    });

    it('does not download file again if it is up to date', async () => {
      nock('https://example.com')
        .get('/file.nt')
        .times(1)
        .reply(200, 'mock file');
      const filePath = await downloader.download(distribution);
      const stat = await fs.stat(filePath);

      distribution.lastModified = new Date('2001-01-01');
      await downloader.download(distribution);
      expect((await fs.stat(filePath)).mtime).toEqual(stat.mtime);
    });

    it('throws an error if file is unavailable', async () => {
      nock('https://example.com').get('/file.nt').reply(500);
      await expect(downloader.download(distribution)).rejects.toThrow(
        'Failed to download https://example.com/file.nt: Internal Server Error'
      );
    });

    it('throws an error if file is empty', async () => {
      nock('https://example.com').get('/file.nt').reply(200, '');
      await expect(downloader.download(distribution)).rejects.toThrow(
        'Distribution download is empty'
      );
    });
  });
});
