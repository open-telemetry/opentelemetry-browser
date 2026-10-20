/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/sdk-trace';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionManagerConfig } from './SessionManager.ts';
import { SessionManager } from './SessionManager.ts';
import { SessionSpanProcessor } from './SessionSpanProcessor.ts';
import type { Session } from './types/Session.ts';
import type { SessionIdGenerator } from './types/SessionIdGenerator.ts';
import type { SessionObserver } from './types/SessionObserver.ts';
import type { SessionStore } from './types/SessionStore.ts';

class MockSessionIdGenerator implements SessionIdGenerator {
  private _id = 0;
  generateSessionId(): string {
    return `session-${++this._id}`;
  }
}

class MockSessionStore implements SessionStore {
  private _session: Session | null = null;
  save(session: Session): Promise<void> {
    this._session = session;
    return Promise.resolve();
  }
  get(): Promise<Session | null> {
    return Promise.resolve(this._session);
  }
}

class MockSessionObserver implements SessionObserver {
  startedSessions: Session[] = [];
  endedSessions: Session[] = [];

  onSessionStarted(newSession: Session): void {
    this.startedSessions.push(newSession);
  }

  onSessionEnded(session: Session): void {
    this.endedSessions.push(session);
  }
}

interface PrivateSessionManager {
  resetSession(): void;
}

describe('SessionManager', () => {
  let config: SessionManagerConfig;
  let store: MockSessionStore;
  let idGenerator: MockSessionIdGenerator;
  let observer: MockSessionObserver;
  let sessionManager: SessionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    idGenerator = new MockSessionIdGenerator();
    store = new MockSessionStore();
    observer = new MockSessionObserver();
    config = {
      sessionIdGenerator: idGenerator,
      sessionStore: store,
    };
  });

  afterEach(() => {
    sessionManager.shutdown();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts an in-memory session when a custom get throws synchronously', async () => {
    const failure = new Error('store unavailable');
    vi.spyOn(store, 'get').mockImplementation(() => {
      throw failure;
    });
    const debugSpy = vi.spyOn(diag, 'debug');
    sessionManager = new SessionManager(config);
    sessionManager.addObserver(observer);
    await expect(sessionManager.start()).resolves.toBeUndefined();
    expect(sessionManager.getSessionId()).toBe('session-1');
    expect(observer.startedSessions).toHaveLength(1);
    expect(debugSpy).toHaveBeenCalledWith(
      'Could not read the session from the session store',
      failure,
    );
  });

  describe.each(['throw', 'reject'] as const)(
    'when a custom save fails with %s',
    (mode) => {
      const failure = new Error('store unavailable');
      const fail = (): never | Promise<never> => {
        if (mode === 'throw') {
          throw failure;
        }
        return Promise.reject(failure);
      };

      it('lets spans start without awaiting start when save fails', async () => {
        let saveCalls = 0;
        store.save = () => {
          saveCalls++;
          return fail();
        };
        const debugSpy = vi.spyOn(diag, 'debug');
        sessionManager = new SessionManager(config);
        const tracer = new TracerProvider({
          spanProcessors: [new SessionSpanProcessor(sessionManager)],
        }).getTracer('custom-store-testing');
        vi.useRealTimers();
        const onUnhandledRejection = vi.fn();
        window.addEventListener('unhandledrejection', onUnhandledRejection);
        try {
          for (const name of ['first', 'second']) {
            const span = tracer.startSpan(name) as Span;
            expect(span.attributes['session.id']).toBe('session-1');
            span.end();
          }
          await new Promise((resolve) => setTimeout(resolve, 50));
          expect(onUnhandledRejection).not.toHaveBeenCalled();
          expect(saveCalls).toBe(1);
          expect(debugSpy).toHaveBeenCalledWith(
            'Session not saved by the session store',
            failure,
          );
        } finally {
          window.removeEventListener(
            'unhandledrejection',
            onUnhandledRejection,
          );
        }
      });
    },
  );

  it('should start a new session if none exists', async () => {
    sessionManager = new SessionManager(config);
    const session = sessionManager.getSession();
    expect(session.id).toBe('session-1');
    expect((await store.get())?.id).toBe('session-1');
  });

  it('should return the same session ID if session exists', () => {
    sessionManager = new SessionManager(config);
    sessionManager.getSessionId(); // Starts session-1
    const sessionId = sessionManager.getSessionId(); // Reuse session-1
    expect(sessionId).toBe('session-1');
  });

  it('should reset session after max duration', () => {
    config = {
      sessionIdGenerator: idGenerator,
      sessionStore: store,
      maxDuration: 0.5,
    };
    sessionManager = new SessionManager(config);

    sessionManager.getSessionId(); // Starts session-1
    vi.advanceTimersByTime(600);
    const sessionId = sessionManager.getSessionId();
    expect(sessionId).toBe('session-2');
  });

  it('should resume max duration in a new instance', () => {
    config = {
      sessionIdGenerator: idGenerator,
      sessionStore: store,
      maxDuration: 0.5,
    };
    sessionManager = new SessionManager(config);
    sessionManager.getSessionId(); // Starts session-1
    vi.advanceTimersByTime(400);

    // create a new manager with the same store
    sessionManager.shutdown();
    sessionManager = new SessionManager(config);

    vi.advanceTimersByTime(300);
    const sessionId = sessionManager.getSessionId();
    expect(sessionId).toBe('session-2');
  });

  it('should reset session after inactivity timeout', () => {
    config = {
      sessionIdGenerator: idGenerator,
      sessionStore: store,
      maxDuration: 1,
      inactivityTimeout: 0.5,
    };
    sessionManager = new SessionManager(config);

    sessionManager.getSessionId(); // Starts session-1
    vi.advanceTimersByTime(600);
    const sessionId = sessionManager.getSessionId();
    expect(sessionId).toBe('session-2');
  });

  it('should extend session life when there is activity', () => {
    config = {
      sessionIdGenerator: idGenerator,
      sessionStore: store,
      maxDuration: 1,
      inactivityTimeout: 0.5,
    };
    sessionManager = new SessionManager(config);

    sessionManager.getSessionId(); // Starts session-1

    vi.advanceTimersByTime(300);
    let sessionId = sessionManager.getSessionId(); // extends session-1
    expect(sessionId).toBe('session-1');

    vi.advanceTimersByTime(600);
    sessionId = sessionManager.getSessionId();
    expect(sessionId).toBe('session-2');
  });

  it('should notify observers when session starts and ends', () => {
    let idSeenInsideOnStarted: string | null | undefined;
    const inspectingObserver: SessionObserver = {
      onSessionStarted: () => {
        idSeenInsideOnStarted = sessionManager.getSessionId();
      },
      onSessionEnded: () => {},
    };

    sessionManager = new SessionManager(config);
    sessionManager.addObserver(observer);
    sessionManager.addObserver(inspectingObserver);

    sessionManager.getSessionId(); // Starts session-1
    sessionManager.getSessionId(); // Reuse session-1
    expect(observer.startedSessions.length).toBe(1);
    expect(observer.startedSessions[0]?.id).toEqual('session-1');
    expect(observer.endedSessions.length).toBe(0);
    // Reading back during onSessionStarted must see the new session.
    expect(idSeenInsideOnStarted).toBe('session-1');

    (sessionManager as unknown as PrivateSessionManager).resetSession();
    expect(observer.startedSessions.length).toBe(2);
    expect(observer.startedSessions[1]?.id).toEqual('session-2');
    expect(observer.endedSessions.length).toBe(1);
    expect(observer.endedSessions[0]?.id).toEqual('session-1');
    expect(idSeenInsideOnStarted).toBe('session-2');
  });

  it('should persist session in store', async () => {
    sessionManager = new SessionManager(config);
    const sessionId = sessionManager.getSessionId();
    expect((await store.get())?.id).toBe(sessionId);
  });

  it('keeps the session when the store throws on save', () => {
    const debugSpy = vi.spyOn(diag, 'debug');
    const throwingStore: SessionStore = {
      get: () => Promise.resolve(null),
      save: () => {
        throw new Error('store down');
      },
    };
    sessionManager = new SessionManager({
      ...config,
      sessionStore: throwingStore,
    });
    expect(() => sessionManager.getSessionId()).not.toThrow();
    expect(sessionManager.getSessionId()).toBeTruthy();
    expect(debugSpy).toHaveBeenCalledWith(
      'Session not saved by the session store',
      expect.any(Error),
    );
  });

  it('logs when the store rejects on save', async () => {
    const debugSpy = vi.spyOn(diag, 'debug');
    const rejectingStore: SessionStore = {
      get: () => Promise.resolve(null),
      save: () => Promise.reject(new Error('store down')),
    };
    sessionManager = new SessionManager({
      ...config,
      sessionStore: rejectingStore,
    });
    sessionManager.getSessionId();
    await Promise.resolve();
    await Promise.resolve();
    expect(debugSpy).toHaveBeenCalledWith(
      'Session not saved by the session store',
      expect.any(Error),
    );
  });

  it('starts a new session when the store cannot be read', async () => {
    const debugSpy = vi.spyOn(diag, 'debug');
    const failingStore: SessionStore = {
      get: () => Promise.reject(new Error('store down')),
      save: () => Promise.resolve(),
    };
    sessionManager = new SessionManager({
      ...config,
      sessionStore: failingStore,
    });
    await expect(sessionManager.start()).resolves.toBeUndefined();
    expect(sessionManager.getSessionId()).toBeTruthy();
    expect(debugSpy).toHaveBeenCalledWith(
      'Could not read the session from the session store',
      expect.any(Error),
    );
  });
});
