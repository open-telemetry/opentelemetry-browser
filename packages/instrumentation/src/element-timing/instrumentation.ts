/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogAttributes, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '#instrumentation-base';
import { version } from '../../package.json' with { type: 'json' };
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
import type {
  ElementTimingInstrumentationConfig,
  PerformanceElementTiming,
} from './types.ts';

/**
 * OpenTelemetry instrumentation for the Element Timing API in browser applications.
 *
 * Captures render/load timing for elements marked with the `elementtiming`
 * attribute using PerformanceObserver.
 */
export class ElementTimingInstrumentation extends InstrumentationBase<ElementTimingInstrumentationConfig> {
  private _observer: PerformanceObserver | undefined;
  // The buffer still holds entries that were already reported. Replaying it
  // on a later enable would emit them again.
  private _hasReplayedBuffer = false;

  constructor(config: ElementTimingInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/element-timing',
      version,
      config,
    );
  }

  protected override _init(): void {
    if (!PerformanceObserver.supportedEntryTypes.includes('element')) {
      throw new Error(
        'PerformanceObserver does not support the "element" entry type in this browser.',
      );
    }
  }

  protected override _onEnable(): void {
    const observer = new PerformanceObserver((list) => {
      // A callback queued before disconnect() can still run after disable().
      if (!this.isEnabled()) {
        return;
      }

      for (const entry of list.getEntries() as PerformanceElementTiming[]) {
        this._safeExecute(
          `Failed to emit element timing entry for "${entry.identifier}"`,
          () => this._emitElementTiming(entry),
        );
      }
    });

    observer.observe({
      type: 'element',
      buffered: !this._hasReplayedBuffer,
    });
    this._observer = observer;
    this._hasReplayedBuffer = true;
  }

  protected override _onDisable(): void {
    this._observer?.disconnect();
    this._observer = undefined;
  }

  private _emitElementTiming(entry: PerformanceElementTiming): void {
    const attributes: LogAttributes = {
      [ATTR_ELEMENT_TIMING_IDENTIFIER]: entry.identifier,
      [ATTR_ELEMENT_TIMING_ELEMENT]: entry.element?.tagName?.toLowerCase(),
      [ATTR_ELEMENT_TIMING_RENDER_TIME]: entry.renderTime,
      [ATTR_ELEMENT_TIMING_START_TIME]: entry.startTime,
    };

    if (entry.name === 'image-paint') {
      attributes[ATTR_ELEMENT_TIMING_LOAD_TIME] = entry.loadTime;
      attributes[ATTR_ELEMENT_TIMING_URL] = entry.url;
      attributes[ATTR_ELEMENT_TIMING_NATURAL_WIDTH] = entry.naturalWidth;
      attributes[ATTR_ELEMENT_TIMING_NATURAL_HEIGHT] = entry.naturalHeight;
    }

    const logRecord: LogRecord = {
      eventName: ELEMENT_TIMING_EVENT_NAME,
      timestamp: entry.startTime,
      severityNumber: SeverityNumber.INFO,
      attributes,
    };
    this.logger.emit(logRecord);
  }
}
