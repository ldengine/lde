export class Paginator<T> implements AsyncIterable<T> {
  constructor(
    private readonly fetchPage: (offset: number, limit: number) => Promise<T[]>,
    public readonly total: number,
    private readonly pageSize = 1000
  ) {}

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let offset = 0;
    while (true) {
      if (offset >= this.pageSize) {
        break;
      }

      const items = await this.fetchPage(offset, this.pageSize);
      if (items.length === 0) {
        break;
      }

      for (const item of items) {
        yield item;
      }

      offset += items.length;
    }
  }
}
