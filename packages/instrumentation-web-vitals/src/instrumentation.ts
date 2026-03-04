/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';
import type { LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import type {
  CLSMetricWithAttribution,
  INPMetricWithAttribution,
  MetricWithAttribution,
} from 'web-vitals/attribution';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';
import {
  ATTR_WEB_VITAL_DELTA,
  ATTR_WEB_VITAL_ID,
  ATTR_WEB_VITAL_NAME,
  ATTR_WEB_VITAL_NAVIGATION_TYPE,
  ATTR_WEB_VITAL_RATING,
  ATTR_WEB_VITAL_VALUE,
  WEB_VITAL_EVENT_NAME,
} from './semconv.ts';
import type { WebVitalsInstrumentationConfig } from './types.ts';

/**
 * Instrumentation for Core Web Vitals using the `web-vitals` library.
 * https://github.com/GoogleChrome/web-vitals
 *
 * Note: The `web-vitals` library does not support removing listeners once
 * registered. Calling `disable()` will stop emitting logs, but the underlying
 * listeners remain active. Calling `enable()` again will resume emission.
 */
export class WebVitalsInstrumentation extends InstrumentationBase<WebVitalsInstrumentationConfig> {
  // Using `declare` is required here: InstrumentationBase calls enable() during
  // construction, and standard field initialization would reset this flag after
  // super() returns, breaking the duplicate-registration guard.
  private declare _isEnabled: boolean;
  private declare _listenersRegistered: boolean;
  private _applyCustomLogRecordData?: (logRecord: LogRecord) => void;
  private _includeRawAttribution: boolean;

  constructor(config: WebVitalsInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-web-vitals', '0.1.0', config);
    this._applyCustomLogRecordData = config.applyCustomLogRecordData;
    this._includeRawAttribution = config.includeRawAttribution ?? false;
  }

  protected override init() {
    return [];
  }

  /**
   * Enables the instrumentation and registers web-vitals listeners.
   * Listeners are registered only once. If disabled, subsequent calls resume emission.
   */
  override enable(): void {
    if (typeof PerformanceObserver === 'undefined') {
      this._diag.debug(
        'PerformanceObserver not supported, web vitals will not be collected',
      );
      return;
    }

    this._isEnabled = true;

    if (this._listenersRegistered) {
      this._diag.debug('Listeners already registered, resuming emission');
      return;
    }

    this._listenersRegistered = true;
    this._diag.debug(`Registering listeners`);
    // CLS is only supported in Chromium. See:
    // https://github.com/GoogleChrome/web-vitals?tab=readme-ov-file#browser-support
    onCLS((metric) => this._emitWebVital(metric));
    onINP((metric) => this._emitWebVital(metric));
    onLCP((metric) => this._emitWebVital(metric));
    onFCP((metric) => this._emitWebVital(metric));
    onTTFB((metric) => this._emitWebVital(metric));
  }

  /**
   * Disables the instrumentation, pausing log emission.
   * Listeners remain active due to web-vitals library limitations.
   */
  override disable(): void {
    this._isEnabled = false;
    this._diag.debug('Instrumentation disabled, pausing emission');
  }

  /**
   * Gets the timestamp for a metric based on attribution timing.
   * Returns undefined to let OTel use the current time for metrics without
   * specific timing information.
   */
  private _getTimestampForMetric(
    metric: MetricWithAttribution,
  ): number | undefined {
    if (metric.name === 'CLS') {
      const { attribution } = metric as CLSMetricWithAttribution;
      if (attribution.largestShiftTime !== undefined) {
        return attribution.largestShiftTime;
      }
      return undefined;
    }
    if (metric.name === 'INP') {
      const { attribution } = metric as INPMetricWithAttribution;
      return attribution.interactionTime;
    }
    // FCP, LCP, TTFB: metric.value is already DOMHighResTimeStamp of the event
    return metric.value;
  }

  private _emitWebVital(metric: MetricWithAttribution): void {
    if (!this._isEnabled) {
      return;
    }
    const attributes: Attributes = {
      [ATTR_WEB_VITAL_NAME]: metric.name.toLowerCase(),
      [ATTR_WEB_VITAL_VALUE]: metric.value,
      // `delta` equals `value` on the first emission; subsequent emissions report only the change
      [ATTR_WEB_VITAL_DELTA]: metric.delta,
      [ATTR_WEB_VITAL_RATING]: metric.rating,
      [ATTR_WEB_VITAL_ID]: metric.id,
      [ATTR_WEB_VITAL_NAVIGATION_TYPE]: metric.navigationType,
    };

    const timestamp = this._getTimestampForMetric(metric);

    const logRecord: LogRecord = {
      eventName: WEB_VITAL_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      attributes,
      ...(this._includeRawAttribution
        ? { body: JSON.stringify(metric.attribution) }
        : {}),
      ...(timestamp !== undefined ? { timestamp } : {}),
    };

    if (this._applyCustomLogRecordData) {
      safeExecuteInTheMiddle(
        () => this._applyCustomLogRecordData?.(logRecord),
        (error) => {
          if (error) {
            this._diag.error('applyCustomLogRecordData hook failed', error);
          }
        },
        true,
      );
    }

    this.logger.emit(logRecord);
  }
}
