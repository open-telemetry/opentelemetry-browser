/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceTimingInstrumentation } from './instrumentation.ts';
import {
  ATTR_RESOURCE_DURATION,
  ATTR_RESOURCE_TRANSFER_SIZE,
  ATTR_RESOURCE_URL,
  RESOURCE_TIMING_EVENT_NAME,
} from './semconv.ts';

function withTestLogger(
  inst: ResourceTimingInstrumentation,
  provider: LoggerProvider,
): void {
  Object.defineProperty(inst, 'logger', {
    value: provider.getLogger('test'),
    configurable: true,
  });
}

function triggerIdleCallback(timeRemaining = 10, didTimeout = false): void {
  const callback = vi.mocked(window.requestIdleCallback).mock.lastCall?.[0];
  callback?.({ timeRemaining: () => timeRemaining, didTimeout });
}

describe('ResourceTimingInstrumentation', () => {
  let instrumentation: ResourceTimingInstrumentation;
  let exporter: InMemoryLogRecordExporter;
  let provider: LoggerProvider;
  let mockObserver: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let observerCallback: PerformanceObserverCallback;
  let PerformanceObserverMock: ReturnType<typeof vi.fn>;
  let mockDocument: {
    readyState: string;
    hidden: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    exporter = new InMemoryLogRecordExporter();
    provider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor(exporter)],
    });

    mockObserver = {
      observe: vi.fn(),
      disconnect: vi.fn(),
    };

    PerformanceObserverMock = vi.fn(function (
      this: unknown,
      callback: PerformanceObserverCallback,
    ) {
      observerCallback = callback;
      return mockObserver;
    });

    mockDocument = {
      readyState: 'complete',
      hidden: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    vi.stubGlobal('document', mockDocument);

    vi.stubGlobal('window', {
      PerformanceObserver: PerformanceObserverMock,
      requestIdleCallback: vi.fn((cb) => setTimeout(cb, 0)),
      cancelIdleCallback: vi.fn(clearTimeout),
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('PerformanceObserver', PerformanceObserverMock);
  });

  afterEach(() => {
    instrumentation?.disable();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Instrumentation lifecycle', () => {
    it('should wait for load event when document not ready', () => {
      const listeners = new Map();
      vi.stubGlobal('document', {
        readyState: 'loading',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
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

    it('should flush pending entries on disable', () => {
      instrumentation = new ResourceTimingInstrumentation();
      withTestLogger(instrumentation, provider);
      instrumentation.enable();

      const mockEntries = [
        createMockResourceEntry({ name: 'https://example.com/entry1.js' }),
        createMockResourceEntry({ name: 'https://example.com/entry2.js' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(mockEntries),
        mockObserver as unknown as PerformanceObserver,
      );

      instrumentation.disable();

      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(2);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe(
        'https://example.com/entry1.js',
      );
      expect(records[1]?.attributes[ATTR_RESOURCE_URL]).toBe(
        'https://example.com/entry2.js',
      );
    });
  });

  describe('Configuration', () => {
    it('should use default forceProcessingAfter of 1000ms', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      expect(window.requestIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 1000 },
      );
    });

    it('should respect custom forceProcessingAfter', () => {
      instrumentation = new ResourceTimingInstrumentation({
        forceProcessingAfter: 500,
      });
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      expect(window.requestIdleCallback).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 500 },
      );
    });

    it('should respect maxProcessingTime and limit entries processed per chunk', () => {
      instrumentation = new ResourceTimingInstrumentation({
        maxProcessingTime: 0,
        batchSize: 100,
      });
      withTestLogger(instrumentation, provider);
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1' }),
        createMockResourceEntry({ name: '2' }),
        createMockResourceEntry({ name: '3' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      // With maxProcessingTime: 0, time budget is exhausted immediately
      triggerIdleCallback(0);

      // No entries should be emitted since the time budget was 0
      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(0);
    });
  });

  describe('Data Emission', () => {
    it('should emit log records with correct attributes', () => {
      instrumentation = new ResourceTimingInstrumentation();
      withTestLogger(instrumentation, provider);
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        name: 'https://example.com/script.js',
        duration: 50,
        transferSize: 1000,
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe(
        'https://example.com/script.js',
      );
      expect(records[0]?.attributes[ATTR_RESOURCE_DURATION]).toBe(50);
      expect(records[0]?.attributes[ATTR_RESOURCE_TRANSFER_SIZE]).toBe(1000);
      expect(
        (records[0] as unknown as { eventName: string } | undefined)?.eventName,
      ).toBe(RESOURCE_TIMING_EVENT_NAME);
    });

    it('should flush on visibility change', () => {
      const visibilityListeners: Array<() => void> = [];
      mockDocument.addEventListener = vi.fn((event, handler) => {
        if (event === 'visibilitychange') {
          visibilityListeners.push(handler as () => void);
        }
      });

      instrumentation = new ResourceTimingInstrumentation();
      withTestLogger(instrumentation, provider);
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      // Simulate page becoming hidden
      mockDocument.hidden = true;
      for (const handler of visibilityListeners) {
        handler();
      }

      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle missing PerformanceObserver gracefully', () => {
      vi.stubGlobal('window', {
        requestIdleCallback: vi.fn(),
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('PerformanceObserver', undefined);

      instrumentation = new ResourceTimingInstrumentation();
      expect(() => instrumentation.enable()).not.toThrow();
    });
  });

  describe('Queueing and Batching', () => {
    it('should flush synchronously when maxQueueSize is reached', () => {
      instrumentation = new ResourceTimingInstrumentation({
        maxQueueSize: 2,
      });
      withTestLogger(instrumentation, provider);
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1' }),
        createMockResourceEntry({ name: '2' }),
        createMockResourceEntry({ name: '3' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(2);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe('1');
      expect(records[1]?.attributes[ATTR_RESOURCE_URL]).toBe('2');
    });

    it('should respect batchSize', () => {
      instrumentation = new ResourceTimingInstrumentation({
        batchSize: 2,
      });
      withTestLogger(instrumentation, provider);
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1' }),
        createMockResourceEntry({ name: '2' }),
        createMockResourceEntry({ name: '3' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(1000);

      const records = exporter.getFinishedLogRecords();
      expect(records).toHaveLength(2);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe('1');
      expect(records[1]?.attributes[ATTR_RESOURCE_URL]).toBe('2');

      expect(window.requestIdleCallback).toHaveBeenCalledTimes(2);
    });
  });
});

function createMockResourceEntry(
  overrides: Partial<PerformanceResourceTiming> = {},
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
  entries: PerformanceResourceTiming[],
): PerformanceObserverEntryList {
  return {
    getEntries: () => entries,
    getEntriesByName: () => [],
    getEntriesByType: () => entries,
  } as PerformanceObserverEntryList;
}
