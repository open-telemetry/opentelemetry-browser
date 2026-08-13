import { afterAll, afterEach, beforeAll } from 'vitest';
import { mockServer } from './mock-server.ts';
import { collector } from './test-collector.ts';

beforeAll(async () => {
  await mockServer.start(...collector.handlers);
});

afterEach(() => {
  collector.reset();
  mockServer.resetHandlers();
});

afterAll(() => {
  mockServer.stop();
});
