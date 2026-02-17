/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
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
const DEFAULT_IDLE_TIMEOUT = 1000;
const DEFAULT_MAX_PROCESSING_TIME = 50;
const DEFAULT_MAX_QUEUE_SIZE = 1000;

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
  private _idleCallbackId?: number;
  private _isEnabled = false;

  constructor(config: ResourceTimingInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-resource-timing', '0.1.0', config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._isEnabled) return;
    this._isEnabled = true;

    if (document.readyState === 'complete') {
      this._setupObserver();
    } else {
      window.addEventListener('load', () => this._setupObserver(), {
        once: true,
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._flush();
    });
  }

  override disable(): void {
    this._isEnabled = false;
    this._observer?.disconnect();
    this._observer = undefined;
    this._cancelScheduledProcessing();
    this._pendingEntries = [];
  }

  private _setupObserver(): void {
    if (!this._isEnabled || !('PerformanceObserver' in window)) return;

    try {
      this._observer = new PerformanceObserver((list) => {
        if (!this._isEnabled) return;

        const maxQueueSize =
          this._config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
        const entries = list.getEntries() as PerformanceResourceTiming[];

        // Add entries to queue
        for (const entry of entries) {
          // Queue full - flush immediately to prevent memory issues
          if (this._pendingEntries.length >= maxQueueSize) {
            this._flush();
          }
          this._pendingEntries.push(entry);
        }

        // Schedule idle processing
        if (this._pendingEntries.length > 0) {
          this._scheduleProcessing();
        }
      });

      this._observer.observe({ type: 'resource', buffered: true });
    } catch {
      // Graceful degradation
    }
  }

  private _scheduleProcessing(): void {
    if (this._idleCallbackId !== undefined) return;

    const idleTimeout = this._config.idleTimeout ?? DEFAULT_IDLE_TIMEOUT;

    if (this._hasIdleCallback()) {
      // eslint-disable-next-line baseline-js/use-baseline
      this._idleCallbackId = window.requestIdleCallback(
        (deadline) => this._processChunk(deadline),
        { timeout: idleTimeout }
      );
    } else {
      // Safari fallback
      this._idleCallbackId = window.requestAnimationFrame(() =>
        setTimeout(() => this._processChunk(), 1)
      ) as unknown as number;
    }
  }

  private _processChunk(deadline?: IdleDeadline): void {
    this._idleCallbackId = undefined;
    if (!this._isEnabled || this._pendingEntries.length === 0) return;

    const maxTime = this._config.maxProcessingTime ?? DEFAULT_MAX_PROCESSING_TIME;
    const batchSize = this._config.batchSize ?? DEFAULT_BATCH_SIZE;
    const startTime = performance.now();

    // Process entries while we have time and haven't hit batch limit
    for (let i = 0; i < batchSize && this._pendingEntries.length > 0; i++) {
      // Check time budget
      const elapsed = performance.now() - startTime;
      const timeLeft = deadline?.timeRemaining() ?? maxTime;
      if (elapsed >= maxTime || timeLeft < 1) break;

      // Emit resource
      const entry = this._pendingEntries.shift();
      if (entry) this._emitResource(entry);
    }

    // Schedule next chunk if needed
    if (this._pendingEntries.length > 0) this._scheduleProcessing();
  }

  private _emitResource(entry: PerformanceResourceTiming): void {
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
        [ATTR_RESOURCE_RENDER_BLOCKING_STATUS]: (
          entry as PerformanceResourceTiming & {
            renderBlockingStatus?: string;
          }
        ).renderBlockingStatus,
      },
    });
  }

  private _flush(): void {
    this._cancelScheduledProcessing();

    // Emit all pending entries
    while (this._pendingEntries.length > 0) {
      const entry = this._pendingEntries.shift();
      if (entry) this._emitResource(entry);
    }
  }

  private _cancelScheduledProcessing(): void {
    if (this._idleCallbackId === undefined) return;

    if (this._hasIdleCallback()) {
      // eslint-disable-next-line baseline-js/use-baseline
      window.cancelIdleCallback(this._idleCallbackId);
    } else {
      window.cancelAnimationFrame(this._idleCallbackId);
    }
    this._idleCallbackId = undefined;
  }

  private _hasIdleCallback(): boolean {
    // eslint-disable-next-line baseline-js/use-baseline
    return typeof window.requestIdleCallback === 'function';
  }
}
