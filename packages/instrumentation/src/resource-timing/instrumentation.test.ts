/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { setupTestLogExporter } from '#instrumentation-test-utils';
import * as shimModule from './idle-callback-shim.ts';
import { ResourceTimingInstrumentation } from './instrumentation.ts';
import {
  ATTR_NETWORK_PROTOCOL_NAME,
  ATTR_NETWORK_PROTOCOL_VERSION,
  ATTR_RESOURCE_CONNECT_END,
  ATTR_RESOURCE_CONNECT_START,
  ATTR_RESOURCE_DOMAIN_LOOKUP_END,
  ATTR_RESOURCE_DOMAIN_LOOKUP_START,
  ATTR_RESOURCE_DURATION,
  ATTR_RESOURCE_FETCH_START,
  ATTR_RESOURCE_REDIRECT_END,
  ATTR_RESOURCE_REDIRECT_START,
  ATTR_RESOURCE_RENDER_BLOCKING_STATUS,
  ATTR_RESOURCE_REQUEST_START,
  ATTR_RESOURCE_RESPONSE_END,
  ATTR_RESOURCE_RESPONSE_START,
  ATTR_RESOURCE_SECURE_CONNECTION_START,
  ATTR_RESOURCE_TRANSFER_SIZE,
  ATTR_RESOURCE_URL,
  ATTR_RESOURCE_WORKER_START,
  RESOURCE_TIMING_EVENT_NAME,
} from './semconv.ts';

// supportsIdleCallback is a module-level constant (false in jsdom). The shim
// always uses the setTimeout fallback in tests. We spy on requestIdleCallbackShim
// to capture the scheduled callback and invoke it with a controlled deadline.
function triggerIdleCallback(timeRemaining = 10, didTimeout = false): void {
  const callback = vi.mocked(shimModule.requestIdleCallbackShim).mock
    .lastCall?.[0];
  callback?.({ timeRemaining: () => timeRemaining, didTimeout });
}

const MOCK_TIME_ORIGIN = 1700000000000;

describe('ResourceTimingInstrumentation', () => {
  let instrumentation: ResourceTimingInstrumentation;
  let inMemoryExporter: InMemoryLogRecordExporter;
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

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    vi.spyOn(shimModule, 'requestIdleCallbackShim');
    vi.spyOn(shimModule, 'cancelIdleCallbackShim');

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
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
      addEventListener: vi.fn(),
    });

    vi.stubGlobal('PerformanceObserver', PerformanceObserverMock);

    vi.stubGlobal('performance', {
      now: vi.fn(() => 0),
      timeOrigin: MOCK_TIME_ORIGIN,
    });
  });

  afterEach(() => {
    instrumentation?.disable();
    inMemoryExporter.reset();
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
        removeEventListener: vi.fn(),
        setTimeout: vi.fn(() => 1),
        clearTimeout: vi.fn(),
      });

      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      expect(PerformanceObserverMock).not.toHaveBeenCalled();

      const loadListener = listeners.get('load');
      expect(loadListener?.options?.once).toBe(true);
      loadListener?.handler();

      expect(PerformanceObserverMock).toHaveBeenCalled();
    });

    it('should remove load listener when disabled before load fires', () => {
      const removeEventListener = vi.fn();
      vi.stubGlobal('document', {
        readyState: 'loading',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      });
      vi.stubGlobal('window', {
        PerformanceObserver: PerformanceObserverMock,
        addEventListener: vi.fn(),
        removeEventListener,
        setTimeout: vi.fn(() => 1),
        clearTimeout: vi.fn(),
      });

      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();
      instrumentation.disable();

      expect(removeEventListener).toHaveBeenCalledWith(
        'load',
        expect.any(Function),
      );
      expect(PerformanceObserverMock).not.toHaveBeenCalled();
    });

    it('should flush pending entries on disable', () => {
      instrumentation = new ResourceTimingInstrumentation();
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

      const records = inMemoryExporter.getFinishedLogRecords();
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

      expect(shimModule.requestIdleCallbackShim).toHaveBeenCalledWith(
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

      expect(shimModule.requestIdleCallbackShim).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 500 },
      );
    });

    it('should clamp batchSize: 0 to 1 so entries are still processed', () => {
      instrumentation = new ResourceTimingInstrumentation({ batchSize: 0 });
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(1000);

      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(1);
    });

    it('should clamp maxQueueSize: 0 to 1 so flush still triggers', () => {
      instrumentation = new ResourceTimingInstrumentation({ maxQueueSize: 0 });
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1' }),
        createMockResourceEntry({ name: '2' }),
      ];
      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      // First entry fills the queue (size 1), flush fires synchronously
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(1);
    });

    it('should clamp forceProcessingAfter: -1 to 0', () => {
      instrumentation = new ResourceTimingInstrumentation({
        forceProcessingAfter: -1,
      });
      instrumentation.enable();

      const mockEntry = createMockResourceEntry();
      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      expect(shimModule.requestIdleCallbackShim).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 0 },
      );
    });

    it('should clamp maxProcessingTime: -1 to 0 and reschedule remaining entries', () => {
      instrumentation = new ResourceTimingInstrumentation({
        maxProcessingTime: -1,
        batchSize: 100,
      });
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1' }),
        createMockResourceEntry({ name: '2' }),
      ];
      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(1000);

      // Time budget is 0, nothing emitted but entries rescheduled
      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(0);
      expect(shimModule.requestIdleCallbackShim).toHaveBeenCalledTimes(2);
    });

    it('should respect maxProcessingTime and limit entries processed per chunk', () => {
      instrumentation = new ResourceTimingInstrumentation({
        maxProcessingTime: 0,
        batchSize: 100,
      });
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
      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(0);
    });
  });

  describe('Filtering', () => {
    it('should capture all entries when initiatorTypes is not set', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1', initiatorType: 'script' }),
        createMockResourceEntry({ name: '2', initiatorType: 'fetch' }),
        createMockResourceEntry({ name: '3', initiatorType: 'img' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(1000);

      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(3);
    });

    it('should only capture entries matching initiatorTypes', () => {
      instrumentation = new ResourceTimingInstrumentation({
        initiatorTypes: ['fetch', 'xmlhttprequest'],
      });
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1', initiatorType: 'script' }),
        createMockResourceEntry({ name: '2', initiatorType: 'fetch' }),
        createMockResourceEntry({ name: '3', initiatorType: 'xmlhttprequest' }),
        createMockResourceEntry({ name: '4', initiatorType: 'img' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(1000);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(2);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe('2');
      expect(records[1]?.attributes[ATTR_RESOURCE_URL]).toBe('3');
    });

    it('should capture no entries when initiatorTypes is empty', () => {
      instrumentation = new ResourceTimingInstrumentation({
        initiatorTypes: [],
      });
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1', initiatorType: 'script' }),
        createMockResourceEntry({ name: '2', initiatorType: 'fetch' }),
      ];

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(1000);

      expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(0);
    });
  });

  describe('Data Emission', () => {
    it('should emit log records with correct event name and basic attributes', () => {
      instrumentation = new ResourceTimingInstrumentation();
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

      const records = inMemoryExporter.getFinishedLogRecords();
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

    it('should compute http.call.start_time as absolute timestamp (timeOrigin + fetchStart)', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        fetchStart: 100,
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.attributes[ATTR_RESOURCE_FETCH_START]).toBe(
        MOCK_TIME_ORIGIN + 100,
      );
    });

    it('should compute timing attributes as deltas from fetchStart', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        fetchStart: 100,
        domainLookupStart: 110,
        domainLookupEnd: 120,
        connectStart: 120,
        connectEnd: 140,
        requestStart: 140,
        responseStart: 160,
        responseEnd: 200,
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      const attrs = records[0]?.attributes;

      // All timing values should be relative to fetchStart (100)
      expect(attrs?.[ATTR_RESOURCE_DOMAIN_LOOKUP_START]).toBe(10); // 110 - 100
      expect(attrs?.[ATTR_RESOURCE_DOMAIN_LOOKUP_END]).toBe(20); // 120 - 100
      expect(attrs?.[ATTR_RESOURCE_CONNECT_START]).toBe(20); // 120 - 100
      expect(attrs?.[ATTR_RESOURCE_CONNECT_END]).toBe(40); // 140 - 100
      expect(attrs?.[ATTR_RESOURCE_REQUEST_START]).toBe(40); // 140 - 100
      expect(attrs?.[ATTR_RESOURCE_RESPONSE_START]).toBe(60); // 160 - 100
      expect(attrs?.[ATTR_RESOURCE_RESPONSE_END]).toBe(100); // 200 - 100
    });

    it('should omit timing attributes when browser API returns 0 (phase did not occur)', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        fetchStart: 100,
        // These are 0 → phase did not occur → should be omitted
        redirectStart: 0,
        redirectEnd: 0,
        secureConnectionStart: 0,
        workerStart: 0,
        // These are non-zero → should be present
        domainLookupStart: 110,
        domainLookupEnd: 120,
        connectStart: 120,
        connectEnd: 130,
        requestStart: 130,
        responseStart: 150,
        responseEnd: 200,
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      const attrs = records[0]?.attributes;

      // Omitted (value was 0)
      expect(attrs?.[ATTR_RESOURCE_REDIRECT_START]).toBeUndefined();
      expect(attrs?.[ATTR_RESOURCE_REDIRECT_END]).toBeUndefined();
      expect(attrs?.[ATTR_RESOURCE_SECURE_CONNECTION_START]).toBeUndefined();
      expect(attrs?.[ATTR_RESOURCE_WORKER_START]).toBeUndefined();

      // Present (non-zero)
      expect(attrs?.[ATTR_RESOURCE_DOMAIN_LOOKUP_START]).toBe(10);
      expect(attrs?.[ATTR_RESOURCE_DOMAIN_LOOKUP_END]).toBe(20);
      expect(attrs?.[ATTR_RESOURCE_CONNECT_START]).toBe(20);
      expect(attrs?.[ATTR_RESOURCE_CONNECT_END]).toBe(30);
      expect(attrs?.[ATTR_RESOURCE_REQUEST_START]).toBe(30);
      expect(attrs?.[ATTR_RESOURCE_RESPONSE_START]).toBe(50);
    });

    it('should parse nextHopProtocol with slash into name and version', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        nextHopProtocol: 'http/1.1',
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.attributes[ATTR_NETWORK_PROTOCOL_NAME]).toBe('http');
      expect(records[0]?.attributes[ATTR_NETWORK_PROTOCOL_VERSION]).toBe('1.1');
    });

    it('should parse nextHopProtocol without slash as name only', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        nextHopProtocol: 'h2',
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.attributes[ATTR_NETWORK_PROTOCOL_NAME]).toBe('h2');
      expect(
        records[0]?.attributes[ATTR_NETWORK_PROTOCOL_VERSION],
      ).toBeUndefined();
    });

    it('should omit protocol attributes when nextHopProtocol is empty', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({
        nextHopProtocol: '',
      });

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(
        records[0]?.attributes[ATTR_NETWORK_PROTOCOL_NAME],
      ).toBeUndefined();
      expect(
        records[0]?.attributes[ATTR_NETWORK_PROTOCOL_VERSION],
      ).toBeUndefined();
    });

    it('should include renderBlockingStatus when available', () => {
      instrumentation = new ResourceTimingInstrumentation();
      instrumentation.enable();

      const mockEntry = createMockResourceEntry({}, 'blocking');

      observerCallback(
        createMockPerformanceObserverEntryList([mockEntry]),
        mockObserver as unknown as PerformanceObserver,
      );

      triggerIdleCallback(10);

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.attributes[ATTR_RESOURCE_RENDER_BLOCKING_STATUS]).toBe(
        'blocking',
      );
    });

    it('should flush on visibility change', () => {
      const visibilityListeners: Array<() => void> = [];
      mockDocument.addEventListener = vi.fn((event, handler) => {
        if (event === 'visibilitychange') {
          visibilityListeners.push(handler as () => void);
        }
      });

      instrumentation = new ResourceTimingInstrumentation();
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

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
    });
  });

  describe('Browser Compatibility', () => {
    it('should bail early PerformanceObserver is unsupported', () => {
      vi.stubGlobal('window', {
        setTimeout: vi.fn(() => 1),
        addEventListener: vi.fn(),
      });
      vi.stubGlobal('PerformanceObserver', undefined);

      instrumentation = new ResourceTimingInstrumentation();
      expect(() => instrumentation.enable()).not.toThrow();

      // No observer should be constructed
      expect(PerformanceObserverMock).not.toHaveBeenCalled();
      // No window/document listeners should be registered
      expect(mockDocument.addEventListener).not.toHaveBeenCalled();
      expect(shimModule.requestIdleCallbackShim).not.toHaveBeenCalled();
    });
  });

  describe('Queueing and Batching', () => {
    it('should flush synchronously when maxQueueSize is reached', () => {
      instrumentation = new ResourceTimingInstrumentation({
        maxQueueSize: 2,
      });
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

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(2);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe('1');
      expect(records[1]?.attributes[ATTR_RESOURCE_URL]).toBe('2');
    });

    it('should reschedule remaining entries if _emitResource throws', () => {
      instrumentation = new ResourceTimingInstrumentation({ batchSize: 1 });
      instrumentation.enable();

      const entries = [
        createMockResourceEntry({ name: '1' }),
        createMockResourceEntry({ name: '2' }),
      ];

      // Simulate _emitResource throwing (bypassing its own try/catch)
      vi.spyOn(
        instrumentation as unknown as { _emitResource: () => void },
        '_emitResource',
      ).mockImplementationOnce(() => {
        throw new Error('unexpected emit failure');
      });

      observerCallback(
        createMockPerformanceObserverEntryList(entries),
        mockObserver as unknown as PerformanceObserver,
      );

      expect(() => triggerIdleCallback(1000)).toThrow(
        'unexpected emit failure',
      );

      // finally block should have called _scheduleProcessing for the remaining entry
      expect(shimModule.requestIdleCallbackShim).toHaveBeenCalledTimes(2);
    });

    it('should respect batchSize', () => {
      instrumentation = new ResourceTimingInstrumentation({
        batchSize: 2,
      });
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

      const records = inMemoryExporter.getFinishedLogRecords();
      expect(records).toHaveLength(2);
      expect(records[0]?.attributes[ATTR_RESOURCE_URL]).toBe('1');
      expect(records[1]?.attributes[ATTR_RESOURCE_URL]).toBe('2');

      expect(shimModule.requestIdleCallbackShim).toHaveBeenCalledTimes(2);
    });
  });
});

function createMockResourceEntry(
  overrides: Partial<PerformanceResourceTiming> = {},
  renderBlockingStatus = 'non-blocking',
): PerformanceResourceTiming {
  return {
    name: 'https://example.com/resource.js',
    entryType: 'resource',
    startTime: 0,
    duration: 100,
    initiatorType: 'script',
    nextHopProtocol: 'h2',
    // renderBlockingStatus is Chromium-only, not in the TS type definition
    renderBlockingStatus,
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
