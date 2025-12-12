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

import { SeverityNumber } from "@opentelemetry/api-logs";
import { InstrumentationBase } from "@opentelemetry/instrumentation";
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
} from "./semconv";
import type { NavigationTimingInstrumentationConfig } from "./types";

/**
 * This class automatically instruments navigation timing within the browser.
 */
export class NavigationTimingInstrumentation extends InstrumentationBase<NavigationTimingInstrumentationConfig> {
  private _observer?: PerformanceObserver;
  private _lastEntry?: PerformanceNavigationTiming;

  constructor(config: NavigationTimingInstrumentationConfig = {}) {
    super("@opentelemetry/instrumentation-navigation-timing", "0.1.0", config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    this._observeNavigationTimings();

    window.addEventListener("pagehide", () => {
      this._emitNavigationTiming(
        this._lastEntry as PerformanceNavigationTiming
      );
      this._lastEntry = undefined;
      this._unsubscribeAll();
    });
  }

  override disable(): void {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = undefined;
    }

    this._unsubscribeAll();
  }

  private _observeNavigationTimings() {
    if (typeof PerformanceObserver === "undefined") {
      return;
    }

    this._observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ((entry as PerformanceNavigationTiming).loadEventEnd > 0) {
          this._emitNavigationTiming(entry as PerformanceNavigationTiming);
          this._lastEntry = undefined;
          this._unsubscribeAll();
        } else {
          this._lastEntry = entry as PerformanceNavigationTiming;
        }
      }
    });

    this._observer.observe({
      type: "navigation",
      buffered: true,
    });
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
    document.removeEventListener("load", () => {
      this._emitNavigationTiming;
    });

    document.removeEventListener("pagehide", () => {
      this._emitNavigationTiming;
    });
  }
}
