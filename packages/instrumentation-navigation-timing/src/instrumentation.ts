/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import {
  ATTR_NAVIGATION_CONNECT_END,
  ATTR_NAVIGATION_CONNECT_START,
  ATTR_NAVIGATION_DECODED_BODY_SIZE,
  ATTR_NAVIGATION_DOM_COMPLETE,
  ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_END,
  ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_START,
  ATTR_NAVIGATION_DOM_INTERACTIVE,
  ATTR_NAVIGATION_DOMAIN_LOOKUP_END,
  ATTR_NAVIGATION_DOMAIN_LOOKUP_START,
  ATTR_NAVIGATION_DURATION,
  ATTR_NAVIGATION_ENCODED_BODY_SIZE,
  ATTR_NAVIGATION_FETCH_START,
  ATTR_NAVIGATION_LOAD_EVENT_END,
  ATTR_NAVIGATION_LOAD_EVENT_START,
  ATTR_NAVIGATION_REDIRECT_COUNT,
  ATTR_NAVIGATION_REQUEST_START,
  ATTR_NAVIGATION_RESPONSE_END,
  ATTR_NAVIGATION_RESPONSE_START,
  ATTR_NAVIGATION_SECURE_CONNECTION_START,
  ATTR_NAVIGATION_TRANSFER_SIZE,
  ATTR_NAVIGATION_TYPE,
  ATTR_NAVIGATION_UNLOAD_EVENT_END,
  ATTR_NAVIGATION_UNLOAD_EVENT_START,
  ATTR_NAVIGATION_URL,
  NAVIGATION_TIMING_EVENT_NAME,
} from './semconv.ts';
import type { NavigationTimingInstrumentationConfig } from './types.ts';

const COMPLETE_ENTRY_DELAY_MS = 0;

/**
 * This class automatically instruments navigation timing within the browser.
 */
export class NavigationTimingInstrumentation extends InstrumentationBase<NavigationTimingInstrumentationConfig> {
  private _lastEntry?: PerformanceNavigationTiming;
  private _didEmit = false;
  private _completeDelayTimeoutId?: number;

  private _onLoad = () => {
    this._tryEmitOrSchedule();
  };

  private _onPageHide = () => {
    this._handleUnload();
  };

  constructor(config: NavigationTimingInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-navigation-timing', '0.1.0', config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    // Try emitting immediately (e.g. when enabled after load),
    // otherwise schedule for `load` or fall back to unload.
    this._tryEmitOrSchedule();
    if (this._didEmit) {
      return;
    }

    window.addEventListener('pagehide', this._onPageHide);
  }

  override disable(): void {
    this._unsubscribeAll();
    this._lastEntry = undefined;
  }

  private _getLatestNavigationEntry(): PerformanceNavigationTiming | undefined {
    const entries = performance?.getEntriesByType?.('navigation') as
      | PerformanceNavigationTiming[]
      | undefined;
    if (!entries || entries.length === 0) {
      return;
    }

    return entries[entries.length - 1];
  }

  /**
   * Attempts to emit the navigation timing event.
   *
   * - Emits immediately if a complete `PerformanceNavigationTiming` entry is available.
   * - If the page is still loading, waits for `window.load` and retries.
   * - If the page is already loaded but the entry is not finalized yet, schedules one
   *   deferred re-check (to allow the browser to populate the timing fields).
   *
   * This method can be called multiple times (from `enable()`, the load handler, or the
   * deferred timeout), so it must be safe to re-enter.
   */
  private _tryEmitOrSchedule(): void {
    if (this._didEmit) {
      return;
    }

    const entry = this._getLatestNavigationEntry();
    if (entry) {
      this._lastEntry = entry;
    }

    // Prefer emitting a "complete" navigation entry.
    if (entry && entry.loadEventEnd > 0) {
      this._emitAndCleanup(entry);
      return;
    }

    // If the document is still loading, wait for `load` and try again.
    if (document.readyState !== 'complete') {
      window.addEventListener('load', this._onLoad, { once: true });
      return;
    }

    // If the document is already complete but navigation timings are not finalized yet,
    // do a single deferred re-check to allow the browser to finish populating the entry.
    if (!this._completeDelayTimeoutId) {
      this._completeDelayTimeoutId = window.setTimeout(() => {
        this._completeDelayTimeoutId = undefined;
        this._tryEmitOrSchedule();
      }, COMPLETE_ENTRY_DELAY_MS);
    }
  }

  private _handleUnload(): void {
    if (this._didEmit) {
      return;
    }

    const entry = this._getLatestNavigationEntry() ?? this._lastEntry;
    if (!entry) {
      this._unsubscribeAll();
      return;
    }

    // Emit even if partial (e.g. loadEventEnd === 0).
    this._emitAndCleanup(entry);
  }

  private _emitAndCleanup(entry: PerformanceNavigationTiming): void {
    if (this._didEmit) {
      return;
    }

    this._didEmit = true;

    this._emitNavigationTiming(entry);
    this._lastEntry = undefined;
    this._unsubscribeAll();
  }

  private _emitNavigationTiming(entry: PerformanceNavigationTiming) {
    if (!entry) {
      return;
    }

    this.logger.emit({
      body: NAVIGATION_TIMING_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      attributes: {
        [ATTR_NAVIGATION_TYPE]: entry.type,
        [ATTR_NAVIGATION_URL]: entry.name,
        [ATTR_NAVIGATION_DURATION]: entry.duration,
        [ATTR_NAVIGATION_DOM_COMPLETE]: entry.domComplete,
        [ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_END]:
          entry.domContentLoadedEventEnd,
        [ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_START]:
          entry.domContentLoadedEventStart,
        [ATTR_NAVIGATION_DOM_INTERACTIVE]: entry.domInteractive,
        [ATTR_NAVIGATION_LOAD_EVENT_END]: entry.loadEventEnd,
        [ATTR_NAVIGATION_LOAD_EVENT_START]: entry.loadEventStart,

        // TODO: clarify if these will have different attribute names because they are the same as in the resource timings instrumentation
        // TODO: do we already have semantic attributes for these?
        [ATTR_NAVIGATION_REDIRECT_COUNT]: entry.redirectCount,
        [ATTR_NAVIGATION_UNLOAD_EVENT_END]: entry.unloadEventEnd,
        [ATTR_NAVIGATION_UNLOAD_EVENT_START]: entry.unloadEventStart,
        [ATTR_NAVIGATION_FETCH_START]: entry.fetchStart,
        [ATTR_NAVIGATION_DOMAIN_LOOKUP_START]: entry.domainLookupStart,
        [ATTR_NAVIGATION_DOMAIN_LOOKUP_END]: entry.domainLookupEnd,
        [ATTR_NAVIGATION_CONNECT_START]: entry.connectStart,
        [ATTR_NAVIGATION_CONNECT_END]: entry.connectEnd,
        [ATTR_NAVIGATION_SECURE_CONNECTION_START]: entry.secureConnectionStart,
        [ATTR_NAVIGATION_REQUEST_START]: entry.requestStart,
        [ATTR_NAVIGATION_RESPONSE_START]: entry.responseStart,
        [ATTR_NAVIGATION_RESPONSE_END]: entry.responseEnd,
        [ATTR_NAVIGATION_TRANSFER_SIZE]: entry.transferSize,
        [ATTR_NAVIGATION_ENCODED_BODY_SIZE]: entry.encodedBodySize,
        [ATTR_NAVIGATION_DECODED_BODY_SIZE]: entry.decodedBodySize,
      },
    });
  }

  private _unsubscribeAll(): void {
    if (this._completeDelayTimeoutId) {
      clearTimeout(this._completeDelayTimeoutId);
      this._completeDelayTimeoutId = undefined;
    }

    window.removeEventListener('load', this._onLoad);
    window.removeEventListener('pagehide', this._onPageHide);
  }
}
