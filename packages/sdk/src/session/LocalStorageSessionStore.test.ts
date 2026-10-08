/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/sdk-trace';
import { TracerProvider } from '@opentelemetry/sdk-trace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageSessionStore } from './LocalStorageSessionStore.ts';
import { SessionManager } from './SessionManager.ts';
import { SessionSpanProcessor } from './SessionSpanProcessor.ts';
import type { Session } from './types/Session.ts';

describe('LocalStorageSessionStore', () => {
  let store: LocalStorageSessionStore;
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    store = new LocalStorageSessionStore();
    getItemSpy = vi.spyOn(globalThis.localStorage, 'getItem');
    setItemSpy = vi.spyOn(globalThis.localStorage, 'setItem');
    debugSpy = vi.spyOn(diag, 'debug');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.localStorage.clear();
  });

  it('calls localStorage.setItem on save', async () => {
    const session: Session = { id: 'id', startTimestamp: Date.now() };
    await store.save(session);
    expect(setItemSpy).toHaveBeenCalledOnce();
  });

  it('calls localStorage.getItem on get', async () => {
    await store.get();
    expect(getItemSpy).toHaveBeenCalledOnce();
  });

  it('saves and retrieves the same session', async () => {
    const session: Session = {
      id: 'integration-id',
      startTimestamp: 1234567890,
    };

    await store.save(session);
    const retrieved = await store.get();

    expect(retrieved).toEqual(session);
  });

  it('returns null if localStorage is not available', async () => {
    vi.stubGlobal('localStorage', undefined);
    const retrieved = await store.get();
    expect(retrieved).toBeNull();
  });

  it('returns null if stored session is invalid', async () => {
    getItemSpy.mockReturnValue('invalid-json');
    const retrieved = await store.get();
    expect(retrieved).toBeNull();
    expect(debugSpy).toHaveBeenCalledWith(
      'Could not read the session from localStorage',
      expect.any(SyntaxError),
    );
  });

  it('resolves when setItem throws because storage is full', async () => {
    setItemSpy.mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    const session: Session = { id: 'id', startTimestamp: Date.now() };
    let result: Promise<void> | undefined;
    expect(() => {
      result = store.save(session);
    }).not.toThrow();
    await expect(result).resolves.toBeUndefined();
    expect(debugSpy).toHaveBeenCalledWith(
      'Session not saved to localStorage, it stays in memory only',
      expect.any(DOMException),
    );
  });

  describe('when reading localStorage throws', () => {
    // Firefox with cookies blocked and sandboxed iframes throw a
    // SecurityError as soon as `window.localStorage` is read.
    let original: PropertyDescriptor | undefined;

    beforeEach(() => {
      original = Object.getOwnPropertyDescriptor(window, 'localStorage');
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('The operation is insecure.', 'SecurityError');
        },
      });
    });

    afterEach(() => {
      if (original) {
        Object.defineProperty(window, 'localStorage', original);
      }
    });

    it('resolves save without throwing', async () => {
      const session: Session = { id: 'id', startTimestamp: Date.now() };
      let result: Promise<void> | undefined;
      expect(() => {
        result = store.save(session);
      }).not.toThrow();
      await expect(result).resolves.toBeUndefined();
      expect(debugSpy).toHaveBeenCalledWith(
        'Session not saved to localStorage, it stays in memory only',
        expect.any(DOMException),
      );
    });

    it('resolves get with null', async () => {
      let result: Promise<Session | null> | undefined;
      expect(() => {
        result = store.get();
      }).not.toThrow();
      await expect(result).resolves.toBeNull();
      expect(debugSpy).toHaveBeenCalledWith(
        'Could not read the session from localStorage',
        expect.any(DOMException),
      );
    });

    it('lets the session manager start', async () => {
      const manager = new SessionManager({
        sessionIdGenerator: { generateSessionId: () => 'session-1' },
        sessionStore: store,
      });
      try {
        await expect(manager.start()).resolves.toBeUndefined();
        expect(manager.getSessionId()).toBe('session-1');
      } finally {
        manager.shutdown();
      }
    });

    it('lets spans start through the session span processor', () => {
      const manager = new SessionManager({
        sessionIdGenerator: { generateSessionId: () => 'session-1' },
        sessionStore: store,
      });
      try {
        const tracer = new TracerProvider({
          spanProcessors: [new SessionSpanProcessor(manager)],
        }).getTracer('session-testing');
        const span = tracer.startSpan('test-span') as Span;
        expect(span.attributes['session.id']).toBe('session-1');
        span.end();
      } finally {
        manager.shutdown();
      }
    });
  });
});
