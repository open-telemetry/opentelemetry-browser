/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api-logs';
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

    this._isEnabled = true;

    this._observer = createPerformanceObserver<PerformanceElementTiming>(
      'element',
      (entry) => {
        if (!this._isEnabled) {
          return;
        }
        this._emitElementTiming(entry);
      },
      { diag: this._diag },
    );
  }

  override disable(): void {
    this._isEnabled = false;
    this._observer?.disconnect();
    this._observer = null;
  }

  private _emitElementTiming(entry: PerformanceElementTiming): void {
    try {
      const logRecord: LogRecord = {
        eventName: ELEMENT_TIMING_EVENT_NAME,
        severityNumber: SeverityNumber.INFO,
        attributes: {
          [ATTR_ELEMENT_TIMING_IDENTIFIER]: entry.identifier,
          [ATTR_ELEMENT_TIMING_ELEMENT]: entry.element?.tagName?.toLowerCase(),
          [ATTR_ELEMENT_TIMING_RENDER_TIME]: entry.renderTime,
          [ATTR_ELEMENT_TIMING_LOAD_TIME]: entry.loadTime,
          [ATTR_ELEMENT_TIMING_START_TIME]: entry.startTime,
          [ATTR_ELEMENT_TIMING_URL]: entry.url,
          [ATTR_ELEMENT_TIMING_NATURAL_WIDTH]: entry.naturalWidth,
          [ATTR_ELEMENT_TIMING_NATURAL_HEIGHT]: entry.naturalHeight,
        },
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
