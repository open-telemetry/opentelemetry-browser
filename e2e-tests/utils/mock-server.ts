import type { HttpHandler } from 'msw';
import { setupWorker } from 'msw/browser';

// A page can only have one active MSW Service Worker registration at a time,
// so this is the single shared instance every test's HTTP mocking goes
// through — including the OTLP collector (see test-collector.ts).
let worker: ReturnType<typeof setupWorker> | undefined;

export const mockServer = {
  async start(...handlers: HttpHandler[]): Promise<void> {
    worker = setupWorker(...handlers);
    await worker.start({ onUnhandledRequest: 'error', quiet: true });
  },

  stop(): void {
    worker?.stop();
    worker = undefined;
  },

  resetHandlers(): void {
    worker?.resetHandlers();
  },

  use(...handlers: HttpHandler[]): void {
    worker?.use(...handlers);
  },
};
