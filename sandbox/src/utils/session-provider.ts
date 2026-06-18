// session-provider.ts — Minimal mutable SessionProvider used by the sandbox.
// Rotating the id lets QA observe `session.id` changing on subsequently
// emitted spans and log records.

import type { SessionProvider } from '@opentelemetry/browser-sdk/session';

export interface MutableSessionProvider extends SessionProvider {
  rotate(): string;
}

export function createMutableSessionProvider(): MutableSessionProvider {
  let currentId = crypto.randomUUID();
  return {
    getSessionId: () => currentId,
    rotate: () => {
      currentId = crypto.randomUUID();
      return currentId;
    },
  };
}
