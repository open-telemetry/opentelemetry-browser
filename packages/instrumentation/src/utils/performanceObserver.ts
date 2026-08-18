/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';
import { diag as globalDiag } from '@opentelemetry/api';

export function isEntryTypeSupported(type: string): boolean {
  return (
    typeof PerformanceObserver !== 'undefined' &&
    (PerformanceObserver.supportedEntryTypes?.includes(type) ?? false)
  );
}

/**
 * Creates a PerformanceObserver for the specified entry type if supported, and starts observing.
 * Returns the observer instance, or null if the entry type is not supported or if `observe()` throws.
 * Both failure paths are logged, so a null return is always accompanied by a diag message.
 *
 * Each entry is passed individually to `processEntry`. Errors thrown by `processEntry` are caught
 * and logged so that one bad entry does not block the rest.
 *
 * Note: Defaults to `buffered: true`, so the observer will receive entries recorded before
 * it was created. Pass `{ buffered: false }` in `options` to opt out.
 */
export function createPerformanceObserver<T extends PerformanceEntry>(
  type: string,
  processEntry: (entry: T) => void,
  options?: Omit<PerformanceObserverInit, 'type' | 'entryTypes'> & {
    diag?: DiagLogger;
  },
): PerformanceObserver | null {
  const { diag = globalDiag, ...observeOptions } = options ?? {};

  if (!isEntryTypeSupported(type)) {
    diag.debug(
      `PerformanceEntry type "${type}" is not supported, no entries will be collected`,
    );
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as T[]) {
        try {
          processEntry(entry);
        } catch (e) {
          diag.error(`error processing ${type} entry`, e);
        }
      }
    });
    observer.observe({ type, buffered: true, ...observeOptions });
    return observer;
  } catch (e) {
    diag.error(`failed to observe ${type} entries`, e);
    return null;
  }
}
