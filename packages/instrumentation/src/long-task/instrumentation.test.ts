/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { hrTimeToMilliseconds } from '@opentelemetry/core';
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
import { setupTestLogExporter } from '#utils/test';
import { LongTaskInstrumentation } from './instrumentation.ts';
import {
  ATTR_LONG_TASK_ATTRIBUTION,
  ATTR_LONG_TASK_DURATION,
  ATTR_LONG_TASK_ENTRY_TYPE,
  ATTR_LONG_TASK_NAME,
  LONG_TASK_EVENT_NAME,
} from './semconv.ts';
import type { PerformanceLongTaskTiming } from './types.ts';

describe('LongTaskInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: LongTaskInstrumentation;
  let observerCallback: PerformanceObserverCallback;
  let observe: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let PerformanceObserverMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    observe = vi.fn();
    disconnect = vi.fn();
    PerformanceObserverMock = vi.fn(function (
      this: unknown,
      callback: PerformanceObserverCallback,
    ) {
      observerCallback = callback;
      return { observe, disconnect };
    });
    Object.defineProperty(PerformanceObserverMock, 'supportedEntryTypes', {
      configurable: true,
      value: ['longtask'],
    });
    vi.stubGlobal('PerformanceObserver', PerformanceObserverMock);
  });

  afterEach(() => {
    instrumentation?.disable();
    inMemoryExporter.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('observes buffered long-task entries and emits their attributes as logs', () => {
    instrumentation = new LongTaskInstrumentation();

    expect(observe).toHaveBeenCalledWith({ type: 'longtask', buffered: true });

    const entry = createLongTaskEntry();
    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const records = inMemoryExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      eventName: LONG_TASK_EVENT_NAME,
      attributes: {
        [ATTR_LONG_TASK_NAME]: 'self',
        [ATTR_LONG_TASK_ENTRY_TYPE]: 'longtask',
        [ATTR_LONG_TASK_DURATION]: 73,
        [ATTR_LONG_TASK_ATTRIBUTION]: [
          {
            name: 'script',
            entry_type: 'taskattribution',
            start_time: 12,
            duration: 73,
            container_type: 'window',
            container_src: 'https://example.com/app.js',
            container_id: 'app',
            container_name: 'main',
          },
        ],
      },
    });
  });

  it('uses the entry start time as the log timestamp', () => {
    instrumentation = new LongTaskInstrumentation();
    const entry = createLongTaskEntry({ startTime: 456 });

    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const [record] = inMemoryExporter.getFinishedLogRecords();
    expect(record).toBeDefined();
    if (!record) {
      return;
    }
    expect(hrTimeToMilliseconds(record.hrTime)).toBe(
      performance.timeOrigin + 456,
    );
  });

  it('allows custom log record data and contains hook errors', () => {
    const hook = vi
      .fn()
      .mockImplementationOnce((record) => {
        record.attributes = {
          ...record.attributes,
          'app.route': '/checkout',
        };
      })
      .mockImplementationOnce(() => {
        throw new Error('hook failed');
      });
    instrumentation = new LongTaskInstrumentation({
      applyCustomLogRecordData: hook,
    });
    const diagError = vi
      .spyOn(
        (
          instrumentation as unknown as {
            _diag: { error: (...args: unknown[]) => void };
          }
        )._diag,
        'error',
      )
      .mockImplementation(() => {});

    observerCallback(
      createEntryList([
        createLongTaskEntry(),
        createLongTaskEntry({ startTime: 200 }),
      ]),
      { disconnect } as unknown as PerformanceObserver,
    );

    const records = inMemoryExporter.getFinishedLogRecords();
    expect(records).toHaveLength(2);
    expect(records[0]?.attributes['app.route']).toBe('/checkout');
    expect(diagError).toHaveBeenCalledWith(
      'applyCustomLogRecordData hook failed',
      expect.any(Error),
    );
  });

  it('does not create an observer when PerformanceObserver is unavailable', () => {
    vi.stubGlobal('PerformanceObserver', undefined);

    instrumentation = new LongTaskInstrumentation();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('does not create an observer when supported entry types are unavailable', () => {
    Object.defineProperty(PerformanceObserverMock, 'supportedEntryTypes', {
      configurable: true,
      value: undefined,
    });

    instrumentation = new LongTaskInstrumentation();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('does not create an observer when long tasks are unsupported', () => {
    Object.defineProperty(PerformanceObserverMock, 'supportedEntryTypes', {
      configurable: true,
      value: ['resource'],
    });

    instrumentation = new LongTaskInstrumentation();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('disconnects the observer and can be enabled again', () => {
    instrumentation = new LongTaskInstrumentation();

    instrumentation.disable();
    instrumentation.disable();
    instrumentation.enable();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(PerformanceObserverMock).toHaveBeenCalledTimes(2);
  });

  it('does not emit a queued callback after being disabled', () => {
    instrumentation = new LongTaskInstrumentation();
    instrumentation.disable();

    observerCallback(createEntryList([createLongTaskEntry()]), {
      disconnect,
    } as unknown as PerformanceObserver);

    expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(0);
  });

  it('omits attribution when the browser does not provide an array', () => {
    instrumentation = new LongTaskInstrumentation();
    const entry = createLongTaskEntry();
    Object.defineProperty(entry, 'attribution', { value: undefined });

    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const [record] = inMemoryExporter.getFinishedLogRecords();
    expect(record?.attributes).not.toHaveProperty(ATTR_LONG_TASK_ATTRIBUTION);
  });

  it('contains observer setup failures', () => {
    observe.mockImplementation(() => {
      throw new Error('observe failed');
    });
    instrumentation = new LongTaskInstrumentation({ enabled: false });
    const diagError = vi
      .spyOn(
        (
          instrumentation as unknown as {
            _diag: { error: (...args: unknown[]) => void };
          }
        )._diag,
        'error',
      )
      .mockImplementation(() => {});

    expect(() => instrumentation.enable()).not.toThrow();
    expect(diagError).toHaveBeenCalledWith(
      'Failed to start long-task PerformanceObserver',
      expect.any(Error),
    );
  });
});

function createEntryList(
  entries: PerformanceLongTaskTiming[],
): PerformanceObserverEntryList {
  return {
    getEntries: () => entries,
    getEntriesByName: () => entries,
    getEntriesByType: () => entries,
  } as PerformanceObserverEntryList;
}

function createLongTaskEntry(
  overrides: Partial<PerformanceLongTaskTiming> = {},
): PerformanceLongTaskTiming {
  return {
    name: 'self',
    entryType: 'longtask',
    startTime: 100,
    duration: 73,
    attribution: [
      {
        name: 'script',
        entryType: 'taskattribution',
        startTime: 12,
        duration: 73,
        containerType: 'window',
        containerSrc: 'https://example.com/app.js',
        containerId: 'app',
        containerName: 'main',
        toJSON: () => ({}),
      },
    ],
    toJSON: () => ({}),
    ...overrides,
  };
}
