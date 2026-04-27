/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import { isUrlIgnored } from '@opentelemetry/core';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { version } from '../../package.json' with { type: 'json' };
import type { IdleCallbackHandle } from './idle-callback-shim.ts';
import {
  cancelIdleCallbackShim,
  requestIdleCallbackShim,
} from './idle-callback-shim.ts';
import {
  ATTR_RESOURCE_CONNECT_END,
  ATTR_RESOURCE_CONNECT_START,
  ATTR_RESOURCE_DECODED_BODY_SIZE,
  ATTR_RESOURCE_DOMAIN_LOOKUP_END,
  ATTR_RESOURCE_DOMAIN_LOOKUP_START,
  ATTR_RESOURCE_DURATION,
  ATTR_RESOURCE_ENCODED_BODY_SIZE,
  ATTR_RESOURCE_FETCH_START,
  ATTR_RESOURCE_INITIATOR_TYPE,
  ATTR_RESOURCE_NEXT_HOP_PROTOCOL,
  ATTR_RESOURCE_REDIRECT_END,
  ATTR_RESOURCE_REDIRECT_START,
  ATTR_RESOURCE_RENDER_BLOCKING_STATUS,
  ATTR_RESOURCE_REQUEST_START,
  ATTR_RESOURCE_RESPONSE_END,
  ATTR_RESOURCE_RESPONSE_START,
  ATTR_RESOURCE_SECURE_CONNECTION_START,
  ATTR_RESOURCE_TRANSFER_SIZE,
  ATTR_RESOURCE_URL,
  ATTR_RESOURCE_WORKER_START,
  RESOURCE_TIMING_EVENT_NAME,
} from './semconv.ts';
import type { ResourceTimingInstrumentationConfig } from './types.ts';

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_FORCE_PROCESSING_AFTER = 1000;
const DEFAULT_MAX_PROCESSING_TIME = 50;
const DEFAULT_MAX_QUEUE_SIZE = 1000;

const MIN_BATCH_SIZE = 1;
const MIN_FORCE_PROCESSING_AFTER = 0;
const MIN_PROCESSING_TIME = 0;
const MIN_QUEUE_SIZE = 1;

/**
 * OpenTelemetry instrumentation for resource timing for browser applications.
 *
 * This instrumentation captures resource timing data using PerformanceObserver
 * and batches emissions to avoid overwhelming the main thread. It uses
 * requestIdleCallback when available (with fallback for Safari) to ensure
 * processing happens during idle periods.
 */
export class ResourceTimingInstrumentation extends InstrumentationBase<ResourceTimingInstrumentationConfig> {
  private _observer?: PerformanceObserver;
  private _pendingEntries: PerformanceResourceTiming[] = [];
  private _idleHandle?: IdleCallbackHandle;

  // Use `declare` to prevent JS class field initializers from running after
  // super(), which would reset values set by the enable() call that
  // InstrumentationBase makes during its constructor.
  private declare _isEnabled: boolean;
  private declare _loadHandler: (() => void) | undefined;
  private declare _visibilityChangeHandler: (() => void) | undefined;

  constructor(config: ResourceTimingInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/resource-timing',
      version,
      config,
    );
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._isEnabled) {
      return;
    }

    if (!('PerformanceObserver' in window)) {
      this._diag.debug(
        'PerformanceObserver is not supported, resource timings will not be collected',
      );
      return;
    }

    this._isEnabled = true;

    if (document.readyState === 'complete') {
      this._setupObserver();
    } else {
      this._loadHandler = () => this._setupObserver();
      window.addEventListener('load', this._loadHandler, { once: true });
    }

    this._visibilityChangeHandler = () => {
      if (document.hidden) {
        this._flush();
      }
    };
    document.addEventListener(
      'visibilitychange',
      this._visibilityChangeHandler,
    );
  }

  override disable(): void {
    this._isEnabled = false;
    this._flush();
    this._observer?.disconnect();
    this._observer = undefined;
    if (this._loadHandler) {
      window.removeEventListener('load', this._loadHandler);
      this._loadHandler = undefined;
    }
    if (this._visibilityChangeHandler) {
      document.removeEventListener(
        'visibilitychange',
        this._visibilityChangeHandler,
      );
      this._visibilityChangeHandler = undefined;
    }
  }

  private _setupObserver(): void {
    if (!this._isEnabled) {
      return;
    }

    try {
      const observer = new PerformanceObserver((list) => {
        if (!this._isEnabled) {
          return;
        }

        const maxQueueSize = Math.max(
          this._config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
          MIN_QUEUE_SIZE,
        );
        const entries = list.getEntries() as PerformanceResourceTiming[];
        const initiatorTypes = this._config.initiatorTypes;

        for (const entry of entries) {
          if (
            initiatorTypes !== undefined &&
            !initiatorTypes.includes(entry.initiatorType)
          ) {
            continue;
          }

          if (isUrlIgnored(entry.name, this._config.ignoreUrls)) {
            continue;
          }

          if (this._pendingEntries.length >= maxQueueSize) {
            this._flush();
          }
          this._pendingEntries.push(entry);
        }

        if (this._pendingEntries.length > 0) {
          this._scheduleProcessing();
        }
      });

      this._observer = observer;
      observer.observe({ type: 'resource', buffered: true });
    } catch {
      this._diag.warn(
        'PerformanceObserver not supported, resource timings will not be collected',
      );
    }
  }

  private _scheduleProcessing(): void {
    if (this._idleHandle !== undefined) {
      return;
    }

    const timeout = Math.max(
      this._config.forceProcessingAfter ?? DEFAULT_FORCE_PROCESSING_AFTER,
      MIN_FORCE_PROCESSING_AFTER,
    );
    this._idleHandle = requestIdleCallbackShim(
      (deadline) => this._processChunk(deadline),
      { timeout },
    );
  }

  private _processChunk(deadline: IdleDeadline): void {
    this._idleHandle = undefined;
    if (!this._isEnabled || this._pendingEntries.length === 0) {
      return;
    }

    const maxTime = Math.max(
      this._config.maxProcessingTime ?? DEFAULT_MAX_PROCESSING_TIME,
      MIN_PROCESSING_TIME,
    );
    const batchSize = Math.max(
      this._config.batchSize ?? DEFAULT_BATCH_SIZE,
      MIN_BATCH_SIZE,
    );
    const startTime = performance.now();

    let cursor = 0;
    try {
      for (let i = 0; i < batchSize; i++) {
        const entry = this._pendingEntries[cursor];
        if (entry === undefined) {
          break;
        }

        const elapsed = performance.now() - startTime;
        // timeRemaining() is not Baseline widely available (no Safari support),
        // compatibility is handled by idle-callback-shim.ts.
        // eslint-disable-next-line baseline-js/use-baseline
        if (elapsed >= maxTime || deadline.timeRemaining() < 1) {
          break;
        }

        cursor++;
        this._emitResource(entry);
      }
    } finally {
      this._pendingEntries.splice(0, cursor);
      if (this._pendingEntries.length > 0) {
        this._scheduleProcessing();
      }
    }
  }

  private _emitResource(entry: PerformanceResourceTiming): void {
    try {
      this.logger.emit({
        eventName: RESOURCE_TIMING_EVENT_NAME,
        severityNumber: SeverityNumber.INFO,
        attributes: {
          [ATTR_RESOURCE_URL]: entry.name,
          [ATTR_RESOURCE_INITIATOR_TYPE]: entry.initiatorType,
          [ATTR_RESOURCE_DURATION]: entry.duration,
          [ATTR_RESOURCE_FETCH_START]: entry.fetchStart,
          [ATTR_RESOURCE_DOMAIN_LOOKUP_START]: entry.domainLookupStart,
          [ATTR_RESOURCE_DOMAIN_LOOKUP_END]: entry.domainLookupEnd,
          [ATTR_RESOURCE_CONNECT_START]: entry.connectStart,
          [ATTR_RESOURCE_CONNECT_END]: entry.connectEnd,
          [ATTR_RESOURCE_SECURE_CONNECTION_START]: entry.secureConnectionStart,
          [ATTR_RESOURCE_REQUEST_START]: entry.requestStart,
          [ATTR_RESOURCE_RESPONSE_START]: entry.responseStart,
          [ATTR_RESOURCE_RESPONSE_END]: entry.responseEnd,
          [ATTR_RESOURCE_TRANSFER_SIZE]: entry.transferSize,
          [ATTR_RESOURCE_ENCODED_BODY_SIZE]: entry.encodedBodySize,
          [ATTR_RESOURCE_DECODED_BODY_SIZE]: entry.decodedBodySize,
          [ATTR_RESOURCE_REDIRECT_START]: entry.redirectStart,
          [ATTR_RESOURCE_REDIRECT_END]: entry.redirectEnd,
          [ATTR_RESOURCE_WORKER_START]: entry.workerStart,
          [ATTR_RESOURCE_NEXT_HOP_PROTOCOL]: entry.nextHopProtocol,
          // @ts-expect-error renderBlockingStatus is only available in Chromium as of March 2026
          [ATTR_RESOURCE_RENDER_BLOCKING_STATUS]: entry.renderBlockingStatus,
        },
      });
    } catch (error) {
      this._diag.error(
        `Failed to emit resource timing entry for "${entry.name}"`,
        error,
      );
    }
  }

  private _flush(): void {
    this._cancelScheduledProcessing();

    for (const entry of this._pendingEntries) {
      this._emitResource(entry);
    }
    this._pendingEntries = [];
  }

  private _cancelScheduledProcessing(): void {
    if (this._idleHandle !== undefined) {
      cancelIdleCallbackShim(this._idleHandle);
      this._idleHandle = undefined;
    }
  }
}
