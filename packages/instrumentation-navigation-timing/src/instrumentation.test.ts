/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import { setupTestLogExporter } from '@opentelemetry/test-utils';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationTimingInstrumentation } from './instrumentation';
import {
  ATTR_NAVIGATION_LOAD_EVENT_END,
  NAVIGATION_TIMING_EVENT_NAME,
} from './semconv';

describe('NavigationTimingInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: NavigationTimingInstrumentation;
  let restoreReadyState: (() => void) | undefined;
  let restoreGetEntriesByType: (() => void) | undefined;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    instrumentation = new NavigationTimingInstrumentation();
  });

  afterEach(() => {
    instrumentation.disable();
    inMemoryExporter.reset();
    document.body.innerHTML = '';
    restoreReadyState?.();
    restoreReadyState = undefined;
    restoreGetEntriesByType?.();
    restoreGetEntriesByType = undefined;
  });

  it('should create an instance of NavigationTimingInstrumentation', () => {
    expect(instrumentation).toBeInstanceOf(NavigationTimingInstrumentation);
  });

  it('should enable and disable without errors', () => {
    expect(() => {
      instrumentation.enable();
      instrumentation.disable();
    }).not.toThrow();
  });

  const getNavigationTimingLogs = () =>
    inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.body === NAVIGATION_TIMING_EVENT_NAME);

  const setReadyState = (state: DocumentReadyState) => {
    const original = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', {
      value: state,
      configurable: true,
    });

    restoreReadyState = () => {
      if (original) {
        Object.defineProperty(document, 'readyState', original);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (document as unknown as { readyState?: unknown }).readyState;
      }
    };
  };

  const stubGetEntriesByType = (
    impl: (type: string) => PerformanceEntry[],
  ) => {
    const perf = globalThis.performance as unknown as {
      getEntriesByType?: (type: string) => PerformanceEntry[];
    };
    const original = perf.getEntriesByType;

    // vitest can run with a non-browser `performance`; we only need this method.
    (perf as unknown as { getEntriesByType: (type: string) => PerformanceEntry[] })
      .getEntriesByType = vi.fn(impl);

    restoreGetEntriesByType = () => {
      if (original) {
        (perf as unknown as { getEntriesByType: (type: string) => PerformanceEntry[] })
          .getEntriesByType = original;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete (perf as unknown as { getEntriesByType?: unknown }).getEntriesByType;
      }
    };
  };

  it('should emit immediately when the navigation entry is complete', () => {
    setReadyState('complete');

    const entry = {
      name: 'https://example.test/',
      entryType: 'navigation',
      startTime: 0,
      duration: 123,
      type: 'navigate',
      loadEventEnd: 456,
    } as unknown as PerformanceNavigationTiming;

    stubGetEntriesByType(() => [entry] as unknown as PerformanceEntry[]);

    instrumentation.enable();

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.body).toBe(NAVIGATION_TIMING_EVENT_NAME);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(456);
  });

  it('should wait for load when the document is loading and entry is incomplete', () => {
    setReadyState('loading');

    let entry = {
      name: 'https://example.test/',
      entryType: 'navigation',
      startTime: 0,
      duration: 1,
      type: 'navigate',
      loadEventEnd: 0,
    } as unknown as PerformanceNavigationTiming;

    stubGetEntriesByType(() => [entry] as unknown as PerformanceEntry[]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    // Simulate the entry being finalized once the page load completes.
    entry = {
      ...entry,
      loadEventEnd: 999,
    } as unknown as PerformanceNavigationTiming;
    setReadyState('complete');
    window.dispatchEvent(new Event('load'));

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(999);
  });

  it('should delay once when readyState is complete but navigation entry is not finalized yet', () => {
    vi.useFakeTimers();
    setReadyState('complete');

    const entry = {
      name: 'https://example.test/',
      entryType: 'navigation',
      startTime: 0,
      duration: 1,
      type: 'navigate',
      loadEventEnd: 0,
    } as unknown as PerformanceNavigationTiming;

    stubGetEntriesByType(() => [entry] as unknown as PerformanceEntry[]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    // Simulate the timing entry being finalized after enable().
    (entry as unknown as { loadEventEnd: number }).loadEventEnd = 222;
    vi.runOnlyPendingTimers();

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(222);

    vi.useRealTimers();
  });

  it('should emit partial values on pagehide if the page unloads before load completes', () => {
    setReadyState('loading');

    const entry = {
      name: 'https://example.test/',
      entryType: 'navigation',
      startTime: 0,
      duration: 1,
      type: 'navigate',
      loadEventEnd: 0,
    } as unknown as PerformanceNavigationTiming;

    stubGetEntriesByType(() => [entry] as unknown as PerformanceEntry[]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    window.dispatchEvent(new Event('pagehide'));

    const logs = getNavigationTimingLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]?.attributes[ATTR_NAVIGATION_LOAD_EVENT_END]).toBe(0);
  });

  it('should not emit twice (load then pagehide)', () => {
    setReadyState('loading');

    let entry = {
      name: 'https://example.test/',
      entryType: 'navigation',
      startTime: 0,
      duration: 1,
      type: 'navigate',
      loadEventEnd: 0,
    } as unknown as PerformanceNavigationTiming;

    stubGetEntriesByType(() => [entry] as unknown as PerformanceEntry[]);

    instrumentation.enable();
    expect(getNavigationTimingLogs().length).toBe(0);

    entry = {
      ...entry,
      loadEventEnd: 111,
    } as unknown as PerformanceNavigationTiming;
    setReadyState('complete');
    window.dispatchEvent(new Event('load'));
    expect(getNavigationTimingLogs().length).toBe(1);

    window.dispatchEvent(new Event('pagehide'));
    expect(getNavigationTimingLogs().length).toBe(1);
  });
});
