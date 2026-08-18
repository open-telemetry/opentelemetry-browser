/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogAttributes, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { createPerformanceObserver } from '#utils';
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
  // Use `declare` to prevent JS class field initializers from running after
  // super(), which would reset values set by the enable() call that
  // InstrumentationBase makes during its constructor.
  private declare _observer: PerformanceObserver | null;
  private declare _isEnabled: boolean;
  private declare _hasObserved: boolean;

  constructor(config: ElementTimingInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/element-timing',
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

    const observer = createPerformanceObserver<PerformanceElementTiming>(
      'element',
      (entry) => {
        if (!this._isEnabled) {
          return;
        }
        this._emitElementTiming(entry);
      },
      // Replay the timeline only on the first successful enable. Re-enabling
      // with `buffered` would re-deliver every entry already emitted before
      // disable(), duplicating them.
      { diag: this._diag, buffered: !this._hasObserved },
    );

    if (!observer) {
      return;
    }

    this._isEnabled = true;
    this._hasObserved = true;
    this._observer = observer;
  }

  override disable(): void {
    this._isEnabled = false;
    this._observer?.disconnect();
    this._observer = null;
  }

  private _emitElementTiming(entry: PerformanceElementTiming): void {
    try {
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
        severityNumber: SeverityNumber.INFO,
        attributes,
      };
      this.logger.emit(logRecord);
    } catch (error) {
      this._diag.error(
        `Failed to emit element timing entry for "${entry.identifier}"`,
        error,
      );
    }
  }
}
