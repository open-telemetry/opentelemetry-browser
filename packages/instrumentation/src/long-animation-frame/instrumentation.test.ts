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
import { LongAnimationFrameInstrumentation } from './instrumentation.ts';
import {
  ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION,
  ATTR_LONG_ANIMATION_FRAME_DURATION,
  ATTR_LONG_ANIMATION_FRAME_ENTRY_TYPE,
  ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP,
  ATTR_LONG_ANIMATION_FRAME_NAME,
  ATTR_LONG_ANIMATION_FRAME_RENDER_START,
  ATTR_LONG_ANIMATION_FRAME_SCRIPTS,
  ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START,
  LONG_ANIMATION_FRAME_EVENT_NAME,
} from './semconv.ts';
import type { PerformanceLongAnimationFrameTiming } from './types.ts';

describe('LongAnimationFrameInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: LongAnimationFrameInstrumentation;
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
      value: ['long-animation-frame'],
    });
    vi.stubGlobal('PerformanceObserver', PerformanceObserverMock);
  });

  afterEach(() => {
    instrumentation?.disable();
    inMemoryExporter.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('observes buffered long-animation-frame entries and emits their attributes as logs', () => {
    instrumentation = new LongAnimationFrameInstrumentation();

    expect(observe).toHaveBeenCalledWith({
      type: 'long-animation-frame',
      buffered: true,
    });

    const entry = createLongAnimationFrameEntry();
    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const records = inMemoryExporter.getFinishedLogRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      eventName: LONG_ANIMATION_FRAME_EVENT_NAME,
      attributes: {
        [ATTR_LONG_ANIMATION_FRAME_NAME]: 'frame',
        [ATTR_LONG_ANIMATION_FRAME_ENTRY_TYPE]: 'long-animation-frame',
        [ATTR_LONG_ANIMATION_FRAME_DURATION]: 320,
        [ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION]: 250,
        [ATTR_LONG_ANIMATION_FRAME_RENDER_START]: 120,
        [ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START]: 130,
        [ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP]: 100,
        [ATTR_LONG_ANIMATION_FRAME_SCRIPTS]: [
          {
            name: 'app.js',
            entry_type: 'script',
            start_time: 110,
            duration: 200,
            execution_start: 120,
            invoker: 'script',
            invoker_type: 'classic-script',
            source_url: 'https://example.com/app.js',
            source_function_name: 'render',
            source_char_position: 12,
            pause_duration: 10,
            forced_style_and_layout_duration: 40,
            window_attribution: 'self',
          },
        ],
      },
    });
  });

  it('uses the entry start time as the log timestamp', () => {
    instrumentation = new LongAnimationFrameInstrumentation();
    const entry = createLongAnimationFrameEntry({ startTime: 456 });

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

  it('does not create an observer when PerformanceObserver is unavailable', () => {
    vi.stubGlobal('PerformanceObserver', undefined);

    instrumentation = new LongAnimationFrameInstrumentation();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('does not create an observer when supported entry types are unavailable', () => {
    Object.defineProperty(PerformanceObserverMock, 'supportedEntryTypes', {
      configurable: true,
      value: undefined,
    });

    instrumentation = new LongAnimationFrameInstrumentation();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('does not create an observer when long animation frames are unsupported', () => {
    Object.defineProperty(PerformanceObserverMock, 'supportedEntryTypes', {
      configurable: true,
      value: ['resource'],
    });

    instrumentation = new LongAnimationFrameInstrumentation();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('disconnects the observer and can be enabled again', () => {
    instrumentation = new LongAnimationFrameInstrumentation();

    instrumentation.disable();
    instrumentation.disable();
    instrumentation.enable();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(PerformanceObserverMock).toHaveBeenCalledTimes(2);
  });

  it('does not emit a queued callback after being disabled', () => {
    instrumentation = new LongAnimationFrameInstrumentation();
    instrumentation.disable();

    observerCallback(createEntryList([createLongAnimationFrameEntry()]), {
      disconnect,
    } as unknown as PerformanceObserver);

    expect(inMemoryExporter.getFinishedLogRecords()).toHaveLength(0);
  });

  it('omits scripts when the browser does not provide an array', () => {
    instrumentation = new LongAnimationFrameInstrumentation();
    const entry = createLongAnimationFrameEntry();
    Object.defineProperty(entry, 'scripts', { value: undefined });

    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const [record] = inMemoryExporter.getFinishedLogRecords();
    expect(record?.attributes).not.toHaveProperty(
      ATTR_LONG_ANIMATION_FRAME_SCRIPTS,
    );
  });

  it('contains observer setup failures', () => {
    observe.mockImplementation(() => {
      throw new Error('observe failed');
    });
    instrumentation = new LongAnimationFrameInstrumentation({ enabled: false });
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
      'Failed to start long-animation-frame PerformanceObserver',
      expect.any(Error),
    );
  });
});

function createEntryList(
  entries: PerformanceLongAnimationFrameTiming[],
): PerformanceObserverEntryList {
  return {
    getEntries: () => entries,
    getEntriesByName: () => entries,
    getEntriesByType: () => entries,
  } as PerformanceObserverEntryList;
}

function createLongAnimationFrameEntry(
  overrides: Partial<PerformanceLongAnimationFrameTiming> = {},
): PerformanceLongAnimationFrameTiming {
  return {
    name: 'frame',
    entryType: 'long-animation-frame',
    startTime: 100,
    duration: 320,
    renderStart: 120,
    styleAndLayoutStart: 130,
    blockingDuration: 250,
    firstUIEventTimestamp: 100,
    scripts: [
      {
        name: 'app.js',
        entryType: 'script',
        startTime: 110,
        duration: 200,
        executionStart: 120,
        invoker: 'script',
        invokerType: 'classic-script',
        sourceURL: 'https://example.com/app.js',
        sourceFunctionName: 'render',
        sourceCharPosition: 12,
        pauseDuration: 10,
        forcedStyleAndLayoutDuration: 40,
        windowAttribution: 'self',
        window: null,
        toJSON: () => ({}),
      },
    ],
    toJSON: () => ({}),
    ...overrides,
  };
}
