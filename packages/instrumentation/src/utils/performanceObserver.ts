/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';

export function isEntryTypeSupported(type: string): boolean {
  return (
    typeof PerformanceObserver !== 'undefined' &&
    (PerformanceObserver.supportedEntryTypes?.includes(type) ?? false)
  );
}

/**
 * Creates a PerformanceObserver for the specified entry type if supported, and starts observing.
 * Returns the observer instance, or null if the entry type is not supported or if an error occurs.
 *
 * Each entry is passed individually to `processEntry`. Errors thrown by `processEntry` are caught
 * and logged via `diag` (if provided) so that one bad entry does not block the rest.
 *
 * Note: Defaults to `buffered: true`, so the observer will receive entries recorded before
 * it was created. Pass `{ buffered: false }` in `options` to opt out.
 */
export function createPerformanceObserver<T extends PerformanceEntry>(
  type: string,
  processEntry: (entry: T) => void,
  options?: PerformanceObserverInit & { diag?: DiagLogger },
): PerformanceObserver | null {
  const { diag, ...observeOptions } = options ?? {};

  if (!isEntryTypeSupported(type)) {
    diag?.debug(`${type} not supported, skipping observer`);
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as T[]) {
        try {
          processEntry(entry);
        } catch (e) {
          diag?.error(`error processing ${type} entry`, e);
        }
      }
    });
    observer.observe({ type, buffered: true, ...observeOptions });
    return observer;
  } catch {
    return null;
  }
}
