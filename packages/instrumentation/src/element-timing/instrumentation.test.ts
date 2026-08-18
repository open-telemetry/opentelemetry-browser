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
import { setupTestLogExporter } from '#utils/test';
import { ElementTimingInstrumentation } from './instrumentation.ts';
import {
  ATTR_ELEMENT_TIMING_ELEMENT,
  ATTR_ELEMENT_TIMING_IDENTIFIER,
  ATTR_ELEMENT_TIMING_LOAD_TIME,
  ATTR_ELEMENT_TIMING_NATURAL_HEIGHT,
  ATTR_ELEMENT_TIMING_NATURAL_WIDTH,
  ATTR_ELEMENT_TIMING_RENDER_TIME,
  ATTR_ELEMENT_TIMING_START_TIME,
  ATTR_ELEMENT_TIMING_URL,
  ELEMENT_TIMING_EVENT_NAME,
} from './semconv.ts';
import type { PerformanceElementTiming } from './types.ts';

describe('ElementTimingInstrumentation', () => {
  let instrumentation: ElementTimingInstrumentation;
  let inMemoryExporter: InMemoryLogRecordExporter;
  let mockObserver: {
    observe: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  let observerCallback: PerformanceObserverCallback;
  let PerformanceObserverMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
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
    (
      PerformanceObserverMock as unknown as { supportedEntryTypes: string[] }
    ).supportedEntryTypes = ['element'];

    vi.stubGlobal('window', { PerformanceObserver: PerformanceObserverMock });
    vi.stubGlobal('PerformanceObserver', PerformanceObserverMock);
  });

  afterEach(() => {
    instrumentation?.disable();
    inMemoryExporter.reset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const getElementTimingLogs = () =>
    inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.eventName === ELEMENT_TIMING_EVENT_NAME);

  function createMockElementEntry(
    overrides: Partial<PerformanceElementTiming> = {},
  ): PerformanceElementTiming {
    return {
      name: 'image-paint',
      entryType: 'element',
      startTime: 200,
      duration: 0,
      identifier: 'hero-image',
      element: { tagName: 'IMG' } as Element,
      renderTime: 200,
      loadTime: 180,
      url: 'https://example.com/hero.jpg',
      naturalWidth: 1200,
      naturalHeight: 800,
      toJSON: () => ({}),
      ...overrides,
    } as PerformanceElementTiming;
  }

  function createMockPerformanceObserverEntryList(
    entries: PerformanceElementTiming[],
  ): PerformanceObserverEntryList {
    return {
      getEntries: () => entries,
      getEntriesByName: () => [],
      getEntriesByType: () => entries,
    } as PerformanceObserverEntryList;
  }

  it('should observe element entries with buffered: true', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();

    expect(mockObserver.observe).toHaveBeenCalledWith({
      type: 'element',
      buffered: true,
    });
  });

  it('should emit a log record for an element timing entry', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();

    observerCallback(
      createMockPerformanceObserverEntryList([createMockElementEntry()]),
      mockObserver as unknown as PerformanceObserver,
    );

    const logs = getElementTimingLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_IDENTIFIER]).toBe(
      'hero-image',
    );
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_ELEMENT]).toBe('img');
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_RENDER_TIME]).toBe(200);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_LOAD_TIME]).toBe(180);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_START_TIME]).toBe(200);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_URL]).toBe(
      'https://example.com/hero.jpg',
    );
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_NATURAL_WIDTH]).toBe(1200);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_NATURAL_HEIGHT]).toBe(800);
  });

  it('should omit resource attributes for text-paint entries', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();

    observerCallback(
      createMockPerformanceObserverEntryList([
        createMockElementEntry({
          name: 'text-paint',
          identifier: 'headline',
          element: { tagName: 'P' } as Element,
          loadTime: 0,
          url: '',
          naturalWidth: 0,
          naturalHeight: 0,
        }),
      ]),
      mockObserver as unknown as PerformanceObserver,
    );

    const logs = getElementTimingLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_IDENTIFIER]).toBe(
      'headline',
    );
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_ELEMENT]).toBe('p');
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_START_TIME]).toBe(200);
    expect(ATTR_ELEMENT_TIMING_URL in (logs[0]?.attributes ?? {})).toBe(false);
    expect(ATTR_ELEMENT_TIMING_LOAD_TIME in (logs[0]?.attributes ?? {})).toBe(
      false,
    );
    expect(
      ATTR_ELEMENT_TIMING_NATURAL_WIDTH in (logs[0]?.attributes ?? {}),
    ).toBe(false);
    expect(
      ATTR_ELEMENT_TIMING_NATURAL_HEIGHT in (logs[0]?.attributes ?? {}),
    ).toBe(false);
  });

  it('should set element attribute to undefined when entry.element is null', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();

    observerCallback(
      createMockPerformanceObserverEntryList([
        createMockElementEntry({ element: null }),
      ]),
      mockObserver as unknown as PerformanceObserver,
    );

    const logs = getElementTimingLogs();
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_ELEMENT]).toBeUndefined();
  });

  it('should emit multiple entries delivered in the same callback', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();

    observerCallback(
      createMockPerformanceObserverEntryList([
        createMockElementEntry({ identifier: 'el-0' }),
        createMockElementEntry({ identifier: 'el-1' }),
      ]),
      mockObserver as unknown as PerformanceObserver,
    );

    const logs = getElementTimingLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0]?.attributes[ATTR_ELEMENT_TIMING_IDENTIFIER]).toBe('el-0');
    expect(logs[1]?.attributes[ATTR_ELEMENT_TIMING_IDENTIFIER]).toBe('el-1');
  });

  it('should not emit logs after disable', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();
    instrumentation.disable();

    expect(mockObserver.disconnect).toHaveBeenCalled();

    observerCallback(
      createMockPerformanceObserverEntryList([
        createMockElementEntry({ identifier: 'late-element' }),
      ]),
      mockObserver as unknown as PerformanceObserver,
    );

    expect(getElementTimingLogs()).toHaveLength(0);
  });

  it('should not enable twice', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();
    instrumentation.enable();

    expect(PerformanceObserverMock).toHaveBeenCalledTimes(1);
  });

  it('should not replay buffered entries when re-enabled', () => {
    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();
    instrumentation.disable();
    instrumentation.enable();

    expect(mockObserver.observe).toHaveBeenLastCalledWith({
      type: 'element',
      buffered: false,
    });
  });

  it('should bail early when PerformanceObserver is unsupported', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('PerformanceObserver', undefined);

    instrumentation = new ElementTimingInstrumentation();
    expect(() => instrumentation.enable()).not.toThrow();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();
  });

  it('should not create an observer when the element entry type is unsupported', () => {
    (
      PerformanceObserverMock as unknown as { supportedEntryTypes: string[] }
    ).supportedEntryTypes = [];

    instrumentation = new ElementTimingInstrumentation();
    expect(() => instrumentation.enable()).not.toThrow();

    expect(PerformanceObserverMock).not.toHaveBeenCalled();

    instrumentation.disable();
    expect(mockObserver.disconnect).not.toHaveBeenCalled();
  });

  it('should stay disabled after a failed enable so a later enable can retry', () => {
    const supported = PerformanceObserverMock as unknown as {
      supportedEntryTypes: string[];
    };
    supported.supportedEntryTypes = [];

    instrumentation = new ElementTimingInstrumentation();
    instrumentation.enable();
    expect(PerformanceObserverMock).not.toHaveBeenCalled();

    supported.supportedEntryTypes = ['element'];
    instrumentation.enable();

    expect(PerformanceObserverMock).toHaveBeenCalledTimes(1);

    observerCallback(
      createMockPerformanceObserverEntryList([createMockElementEntry()]),
      mockObserver as unknown as PerformanceObserver,
    );
    expect(getElementTimingLogs()).toHaveLength(1);
  });
});
