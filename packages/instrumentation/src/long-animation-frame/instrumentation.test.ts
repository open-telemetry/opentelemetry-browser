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
  ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP,
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
        [ATTR_LONG_ANIMATION_FRAME_DURATION]: 320,
        [ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION]: 250,
        [ATTR_LONG_ANIMATION_FRAME_RENDER_START]: 120,
        [ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START]: 130,
        [ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP]: 100,
        [ATTR_LONG_ANIMATION_FRAME_SCRIPTS]: [
          {
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

  it('does not repeat the constants the event name already carries', () => {
    instrumentation = new LongAnimationFrameInstrumentation();

    observerCallback(createEntryList([createLongAnimationFrameEntry()]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const [record] = inMemoryExporter.getFinishedLogRecords();
    expect(record?.attributes).not.toHaveProperty(
      'browser.long_animation_frame.name',
    );
    expect(record?.attributes).not.toHaveProperty(
      'browser.long_animation_frame.entry_type',
    );

    const [script] = (record?.attributes?.[ATTR_LONG_ANIMATION_FRAME_SCRIPTS] ??
      []) as Array<Record<string, unknown>>;
    expect(script).not.toHaveProperty('name');
    expect(script).not.toHaveProperty('entry_type');
  });

  it('emits invoker and source_url unchanged when sanitizeUrl is not configured', () => {
    instrumentation = new LongAnimationFrameInstrumentation();
    const entry = createLongAnimationFrameEntry({
      scripts: [
        createScriptEntry({
          invoker: 'DOMWindow.onclick',
          sourceURL: 'https://app.example/account/reset?token=s3cret#step2',
        }),
      ],
    });

    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const [record] = inMemoryExporter.getFinishedLogRecords();
    expect(record?.attributes[ATTR_LONG_ANIMATION_FRAME_SCRIPTS]).toEqual([
      expect.objectContaining({
        invoker: 'DOMWindow.onclick',
        source_url: 'https://app.example/account/reset?token=s3cret#step2',
      }),
    ]);
  });

  it('applies sanitizeUrl to invoker and source_url', () => {
    const sanitizeUrl = vi.fn((url: string) =>
      url.replace('token=s3cret', 'token=REDACTED'),
    );
    instrumentation = new LongAnimationFrameInstrumentation({ sanitizeUrl });
    const entry = createLongAnimationFrameEntry({
      scripts: [
        createScriptEntry({
          invoker: 'https://app.example/account/reset?token=s3cret',
          sourceURL: 'https://app.example/account/reset?token=s3cret#step2',
        }),
      ],
    });

    observerCallback(createEntryList([entry]), {
      disconnect,
    } as unknown as PerformanceObserver);

    const [record] = inMemoryExporter.getFinishedLogRecords();
    expect(record?.attributes[ATTR_LONG_ANIMATION_FRAME_SCRIPTS]).toEqual([
      expect.objectContaining({
        invoker: 'https://app.example/account/reset?token=REDACTED',
        source_url: 'https://app.example/account/reset?token=REDACTED#step2',
      }),
    ]);
    expect(sanitizeUrl).toHaveBeenCalledTimes(2);
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

  it('replays buffered entries on the first enable only', () => {
    instrumentation = new LongAnimationFrameInstrumentation();

    instrumentation.disable();
    instrumentation.enable();

    expect(observe).toHaveBeenCalledTimes(2);
    expect(observe).toHaveBeenNthCalledWith(1, {
      type: 'long-animation-frame',
      buffered: true,
    });
    expect(observe).toHaveBeenNthCalledWith(2, {
      type: 'long-animation-frame',
      buffered: false,
    });
  });

  it('keeps the buffered replay pending when the first observe fails', () => {
    observe.mockImplementationOnce(() => {
      throw new Error('observe failed');
    });
    instrumentation = new LongAnimationFrameInstrumentation({ enabled: false });
    vi.spyOn(
      (
        instrumentation as unknown as {
          _diag: { error: (...args: unknown[]) => void };
        }
      )._diag,
      'error',
    ).mockImplementation(() => {});

    instrumentation.enable();
    instrumentation.disable();
    instrumentation.enable();

    expect(observe).toHaveBeenNthCalledWith(2, {
      type: 'long-animation-frame',
      buffered: true,
    });
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
    scripts: [createScriptEntry()],
    toJSON: () => ({}),
    ...overrides,
  };
}

function createScriptEntry(
  overrides: Partial<
    PerformanceLongAnimationFrameTiming['scripts'][number]
  > = {},
): PerformanceLongAnimationFrameTiming['scripts'][number] {
  return {
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
    ...overrides,
  } as PerformanceLongAnimationFrameTiming['scripts'][number];
}
