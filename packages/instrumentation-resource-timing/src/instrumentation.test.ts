/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceTimingInstrumentation } from './instrumentation.ts';

describe('ResourceTimingInstrumentation', () => {
  let instrumentation: ResourceTimingInstrumentation;
  let mockObserver: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let observerCallback: PerformanceObserverCallback;
  let PerformanceObserverMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };

    PerformanceObserverMock = vi.fn(
      function (callback: PerformanceObserverCallback) {
        observerCallback = callback;
        return mockObserver;
      }
    );

    vi.stubGlobal('document', {
      readyState: 'complete',
      hidden: false,
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('window', {
      PerformanceObserver: PerformanceObserverMock,
      requestIdleCallback: vi.fn((cb) => setTimeout(cb, 0)),
      cancelIdleCallback: vi.fn(clearTimeout),
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('PerformanceObserver', PerformanceObserverMock);
    vi.stubGlobal('requestIdleCallback', vi.fn((cb) => setTimeout(cb, 0)));
    vi.stubGlobal('cancelIdleCallback', vi.fn(clearTimeout));
  });

  afterEach(() => {
    instrumentation?.disable();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Instrumentation lifecycle', () => {
    it('should wait for load event when document not ready', () => {
      const listeners = new Map();
      vi.stubGlobal('document', { readyState: 'loading', addEventListener: vi.fn() });
      vi.stubGlobal('window', {
        PerformanceObserver: PerformanceObserverMock,
        addEventListener: vi.fn((event, handler, options) => {
          listeners.set(event, { handler, options });
        }),
        requestIdleCallback: vi.fn(),
        cancelIdleCallback: vi.fn(),
      });

      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      expect(PerformanceObserverMock).not.toHaveBeenCalled();

      const loadListener = listeners.get('load');
      expect(loadListener?.options?.once).toBe(true);
      loadListener?.handler();

      expect(PerformanceObserverMock).toHaveBeenCalled();
    });

    it('should cleanup observer and pending entries on disable', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver
      );

      instrumentation.disable();

      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('PerformanceObserver Integration', () => {
    it('should handle missing PerformanceObserver gracefully', () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', { readyState: 'complete', addEventListener: vi.fn() });

      instrumentation = new ResourceTimingInstrumentation();
      expect(() => instrumentation.enable()).not.toThrow();
    });
  });

  describe('Idle Callback Scheduling', () => {
    it('should schedule idle callback for processing', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver
      );

      expect(window.requestIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 1000 }
      );
    });

    it('should only schedule one callback at a time', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const entry1 = createMockResourceEntry({ name: 'test1.js' });
      const entry2 = createMockResourceEntry({ name: 'test2.js' });

      observerCallback(
        createMockPerformanceObserverEntryList([entry1]),
        mockObserver as unknown as PerformanceObserver
      );
      observerCallback(
        createMockPerformanceObserverEntryList([entry2]),
        mockObserver as unknown as PerformanceObserver
      );

      expect(window.requestIdleCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration', () => {
    it('should respect custom idleTimeout', () => {
      instrumentation = new ResourceTimingInstrumentation({
        idleTimeout: 500,
      });
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver
      );

      expect(window.requestIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 500 }
      );
    });
  });

});

function createMockResourceEntry(
  overrides: Partial<PerformanceResourceTiming> = {}
): PerformanceResourceTiming {
  return {
    name: 'https://example.com/resource.js',
    entryType: 'resource',
    startTime: 0,
    duration: 100,
    initiatorType: 'script',
    nextHopProtocol: 'h2',
    renderBlockingStatus: 'non-blocking',
    responseStatus: 200,
    deliveryType: '',
    fetchStart: 0,
    domainLookupStart: 0,
    domainLookupEnd: 0,
    connectStart: 0,
    connectEnd: 0,
    secureConnectionStart: 0,
    requestStart: 0,
    responseStart: 0,
    responseEnd: 0,
    transferSize: 0,
    encodedBodySize: 0,
    decodedBodySize: 0,
    redirectStart: 0,
    redirectEnd: 0,
    workerStart: 0,
    toJSON: () => ({}),
    ...overrides,
  } as PerformanceResourceTiming;
}

function createMockPerformanceObserverEntryList(
  entries: PerformanceResourceTiming[]
): PerformanceObserverEntryList {
  return {
    getEntries: () => entries,
    getEntriesByName: () => [],
    getEntriesByType: () => entries,
  } as PerformanceObserverEntryList;
}
