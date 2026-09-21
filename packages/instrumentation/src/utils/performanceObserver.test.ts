/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createPerformanceObserver,
  isEntryTypeSupported,
} from './performanceObserver.ts';

type ObserverCallback = (list: {
  getEntries: () => PerformanceEntry[];
}) => void;

class MockPerformanceObserver {
  public static supportedEntryTypes: string[] = ['mark', 'measure'];
  public observeOptions: PerformanceObserverInit | null = null;
  public disconnected = false;
  private _callback: ObserverCallback;

  public constructor(callback: ObserverCallback) {
    this._callback = callback;
  }

  public observe(options: PerformanceObserverInit): void {
    this.observeOptions = options;
  }

  public disconnect(): void {
    this.disconnected = true;
  }

  public trigger(entries: PerformanceEntry[]): void {
    this._callback({ getEntries: () => entries });
  }
}

describe('performanceObserver utils', () => {
  let originalPerformanceObserver: typeof globalThis.PerformanceObserver;
  let lastObserverInstance: MockPerformanceObserver | null = null;

  beforeEach(() => {
    originalPerformanceObserver = globalThis.PerformanceObserver;
    lastObserverInstance = null;

    const MockClass = class extends MockPerformanceObserver {
      public constructor(callback: ObserverCallback) {
        super(callback);
        lastObserverInstance = this;
      }
    };
    MockClass.supportedEntryTypes = ['mark', 'measure'];

    vi.stubGlobal('PerformanceObserver', MockClass);
  });

  afterEach(() => {
    vi.stubGlobal('PerformanceObserver', originalPerformanceObserver);
    vi.unstubAllGlobals();
  });

  describe('isEntryTypeSupported', () => {
    it('should return true when type is in supportedEntryTypes', () => {
      expect(isEntryTypeSupported('mark')).toBe(true);
      expect(isEntryTypeSupported('measure')).toBe(true);
    });

    it('should return false when type is not in supportedEntryTypes', () => {
      expect(isEntryTypeSupported('long-animation-frame')).toBe(false);
    });

    it('should return false when supportedEntryTypes is undefined', () => {
      (
        globalThis.PerformanceObserver as unknown as {
          supportedEntryTypes: undefined;
        }
      ).supportedEntryTypes = undefined;
      expect(isEntryTypeSupported('mark')).toBe(false);
    });

    it('should return false when PerformanceObserver is undefined', () => {
      vi.stubGlobal('PerformanceObserver', undefined);
      expect(isEntryTypeSupported('mark')).toBe(false);
    });
  });

  describe('createPerformanceObserver', () => {
    it('should return null when type is unsupported', () => {
      const result = createPerformanceObserver(
        'long-animation-frame',
        () => {},
      );
      expect(result).toBeNull();
    });

    it('should call diag.debug when type is unsupported and diag is provided', () => {
      const debugMessages: string[] = [];
      const diag: DiagLogger = {
        debug: (msg: string) => debugMessages.push(msg),
        verbose: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      const result = createPerformanceObserver(
        'long-animation-frame',
        () => {},
        { diag },
      );
      expect(result).toBeNull();
      expect(debugMessages).toHaveLength(1);
      expect(debugMessages[0]).toContain('long-animation-frame');
    });

    it('should return null when PerformanceObserver is undefined', () => {
      vi.stubGlobal('PerformanceObserver', undefined);
      const result = createPerformanceObserver('mark', () => {});
      expect(result).toBeNull();
    });

    it('should return an observer for a supported type', () => {
      const result = createPerformanceObserver('mark', () => {});
      expect(result).not.toBeNull();
    });

    it('should observe with buffered: true by default', () => {
      createPerformanceObserver('mark', () => {});
      expect(lastObserverInstance?.observeOptions).toEqual({
        type: 'mark',
        buffered: true,
      });
    });

    it('should merge caller options with buffered default', () => {
      createPerformanceObserver('mark', () => {}, { buffered: false });
      expect(lastObserverInstance?.observeOptions).toEqual({
        type: 'mark',
        buffered: false,
      });
    });

    it('should invoke processEntry once per entry', () => {
      const received: PerformanceEntry[] = [];
      createPerformanceObserver('mark', (entry) => {
        received.push(entry);
      });

      const a = { name: 'mark-a', entryType: 'mark' } as PerformanceEntry;
      const b = { name: 'mark-b', entryType: 'mark' } as PerformanceEntry;
      lastObserverInstance?.trigger([a, b]);

      expect(received).toEqual([a, b]);
    });

    it('should catch processEntry errors and log them via diag', () => {
      const errors: unknown[] = [];
      const diag: DiagLogger = {
        error: (_msg: string, err: unknown) => errors.push(err),
        verbose: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
      };

      createPerformanceObserver(
        'mark',
        () => {
          throw new Error('boom');
        },
        { diag },
      );

      const entry = { name: 'bad', entryType: 'mark' } as PerformanceEntry;
      lastObserverInstance?.trigger([entry]);

      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('boom');
    });

    it('should not throw when processEntry errors and no diag is provided', () => {
      createPerformanceObserver('mark', () => {
        throw new Error('boom');
      });

      const entry = { name: 'bad', entryType: 'mark' } as PerformanceEntry;
      expect(() => lastObserverInstance?.trigger([entry])).not.toThrow();
    });

    it('should return null when the observer constructor throws', () => {
      class ThrowingPerformanceObserver {
        public static supportedEntryTypes = ['mark'];
        public constructor() {
          throw new Error('constructor failed');
        }
      }
      vi.stubGlobal('PerformanceObserver', ThrowingPerformanceObserver);

      const result = createPerformanceObserver('mark', () => {});
      expect(result).toBeNull();
    });

    it('should log via diag when the observer constructor throws', () => {
      class ThrowingPerformanceObserver {
        public static supportedEntryTypes = ['mark'];
        public constructor() {
          throw new Error('constructor failed');
        }
      }
      vi.stubGlobal('PerformanceObserver', ThrowingPerformanceObserver);

      const errors: unknown[] = [];
      const diag: DiagLogger = {
        error: (_msg: string, err: unknown) => errors.push(err),
        verbose: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
      };

      const result = createPerformanceObserver('mark', () => {}, { diag });

      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
      expect((errors[0] as Error).message).toBe('constructor failed');
    });
  });
});
