/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const IDLE_DEADLINE_MS = 50;

function supportsIdleCallback(): boolean {
  // eslint-disable-next-line baseline-js/use-baseline
  return typeof window.requestIdleCallback === 'function';
}

export interface IdleCallbackHandle {
  id: number;
  native: boolean;
}

/**
 * Schedules a callback during idle time, using the native requestIdleCallback
 * when available. Falls back to setTimeout with a synthetic IdleDeadline that
 * reports ~50ms of available time (per the W3C spec recommendation).
 */
export function requestIdleCallbackShim(
  callback: IdleRequestCallback,
  options?: IdleRequestOptions,
): IdleCallbackHandle {
  if (supportsIdleCallback()) {
    // eslint-disable-next-line baseline-js/use-baseline
    const id = window.requestIdleCallback(callback, options);
    return { id, native: true };
  }

  const id = window.setTimeout(() => {
    const start = performance.now();
    callback({
      didTimeout: false,
      timeRemaining: () =>
        Math.max(0, IDLE_DEADLINE_MS - (performance.now() - start)),
    });
  }, 1);
  return { id, native: false };
}

/**
 * Cancels a previously scheduled idle callback.
 */
export function cancelIdleCallbackShim(handle: IdleCallbackHandle): void {
  if (handle.native) {
    // eslint-disable-next-line baseline-js/use-baseline
    window.cancelIdleCallback(handle.id);
  } else {
    clearTimeout(handle.id);
  }
}
