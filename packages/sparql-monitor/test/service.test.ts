import { MonitorService } from '../src/service.js';
import { SparqlMonitor } from '../src/monitor.js';
import type { ObservationStore, MonitorConfig } from '../src/types.js';

function createMockStore(): ObservationStore {
  return {
    getLatest: vi.fn().mockResolvedValue(new Map()),
    get: vi.fn().mockResolvedValue(null),
    store: vi.fn().mockResolvedValue({
      id: 'obs-1',
      monitor: 'test-monitor',
      observedAt: new Date(),
      success: true,
      responseTimeMs: 100,
      errorMessage: null,
    }),
    refreshLatestObservationsView: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockMonitor(): SparqlMonitor {
  return {
    check: vi.fn().mockResolvedValue({
      success: true,
      responseTimeMs: 100,
      errorMessage: null,
      observedAt: new Date(),
    }),
  } as unknown as SparqlMonitor;
}

const testMonitors: MonitorConfig[] = [
  {
    identifier: 'test-monitor',
    endpointUrl: new URL('http://example.org/sparql'),
    query: 'ASK { ?s ?p ?o }',
  },
];

describe('MonitorService', () => {
  describe('checkNow', () => {
    it('performs an immediate check', async () => {
      const store = createMockStore();
      const sparqlMonitor = createMockMonitor();
      const service = new MonitorService({
        store,
        monitors: testMonitors,
        sparqlMonitor,
      });

      await service.checkNow('test-monitor');

      expect(sparqlMonitor.check).toHaveBeenCalledWith(
        new URL('http://example.org/sparql'),
        'ASK { ?s ?p ?o }'
      );
      expect(store.store).toHaveBeenCalledWith(
        expect.objectContaining({
          monitor: 'test-monitor',
          success: true,
          responseTimeMs: 100,
        })
      );
    });

    it('throws when monitor not found', async () => {
      const store = createMockStore();
      const service = new MonitorService({ store, monitors: testMonitors });

      await expect(service.checkNow('nonexistent')).rejects.toThrow(
        'Monitor not found: nonexistent'
      );
    });
  });

  describe('checkAll', () => {
    it('checks all monitors', async () => {
      const store = createMockStore();
      const sparqlMonitor = createMockMonitor();
      const monitors: MonitorConfig[] = [
        {
          identifier: 'monitor-1',
          endpointUrl: new URL('http://example.org/sparql1'),
          query: 'ASK { ?s ?p ?o }',
        },
        {
          identifier: 'monitor-2',
          endpointUrl: new URL('http://example.org/sparql2'),
          query: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1',
        },
      ];
      const service = new MonitorService({ store, monitors, sparqlMonitor });

      await service.checkAll();

      expect(sparqlMonitor.check).toHaveBeenCalledTimes(2);
      expect(store.store).toHaveBeenCalledTimes(2);
      expect(store.store).toHaveBeenCalledWith(
        expect.objectContaining({ monitor: 'monitor-1' })
      );
      expect(store.store).toHaveBeenCalledWith(
        expect.objectContaining({ monitor: 'monitor-2' })
      );
    });
  });

  describe('start/stop', () => {
    it('starts and stops monitoring', () => {
      const store = createMockStore();
      const service = new MonitorService({ store, monitors: testMonitors });

      service.start();
      expect(service.isRunning()).toBe(true);

      service.stop();
      expect(service.isRunning()).toBe(false);
    });
  });
});
