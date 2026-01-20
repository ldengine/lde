import { PostgresObservationStore } from '../src/store.js';

// Store tests require a real PostgreSQL database connection.
// The static factory method connects and initializes the schema immediately.

describe('PostgresObservationStore', () => {
  it('exports create factory method', () => {
    expect(PostgresObservationStore.create).toBeInstanceOf(Function);
  });

  // Integration tests would go here with a real database connection.
  // For example:
  //
  // describe('integration', () => {
  //   let store: PostgresObservationStore;
  //
  //   beforeAll(async () => {
  //     store = await PostgresObservationStore.create(process.env.TEST_DATABASE_URL!);
  //   });
  //
  //   afterAll(async () => {
  //     await store.close();
  //   });
  //
  //   it('stores and retrieves observations', async () => {
  //     const observation = await store.store({
  //       monitor: 'test-monitor',
  //       responseTime: new Date(),
  //       success: true,
  //       responseTimeMs: 100,
  //       errorMessage: null,
  //     });
  //
  //     const retrieved = await store.get(observation.id);
  //     expect(retrieved?.id).toBe(observation.id);
  //   });
  // });
});
