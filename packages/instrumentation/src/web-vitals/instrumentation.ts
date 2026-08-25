/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';
import type { LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import type {
  CLSMetricWithAttribution,
  INPMetricWithAttribution,
  MetricWithAttribution,
} from 'web-vitals/attribution';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';
import { InstrumentationBase } from '#instrumentation-base';
import { assertPerformanceObserver } from '#utils';
import { version } from '../../package.json' with { type: 'json' };
import { toError } from '../utils/toError.ts';
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
  private _hasSubscribed = false;

  constructor(config: WebVitalsInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/web-vitals', version, config);
  }

  protected override _init(): void {
    assertPerformanceObserver();
  }

  // Subscribes on the first enable, not in `_init()`: the library reports some
  // metrics only once, so a subscription made while nothing is emitted loses them.
  protected override _onEnable(): void {
    if (this._hasSubscribed) {
      return;
    }
    this._diag.debug('Registering listeners');
    // CLS is only supported in Chromium. See:
    // https://github.com/GoogleChrome/web-vitals?tab=readme-ov-file#browser-support
    const subscribers = [
      ['CLS', onCLS],
      ['INP', onINP],
      ['LCP', onLCP],
      ['FCP', onFCP],
      ['TTFB', onTTFB],
    ] as const;
    for (const [name, subscribe] of subscribers) {
      // Not retried: web-vitals cannot unsubscribe, so a retry would double
      // the metrics that did subscribe.
      try {
        subscribe((metric: MetricWithAttribution) =>
          this._emitWebVital(metric),
        );
      } catch (err) {
        this._diag.warn(`could not subscribe to ${name}`, toError(err));
      }
    }
    this._hasSubscribed = true;
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
    if (!this.isEnabled()) {
      return;
    }
    // A throw here would surface from the library's observer as a page error.
    this._runHook('failed to record a web vital', () =>
      this._recordWebVital(metric),
    );
  }

  private _recordWebVital(metric: MetricWithAttribution): void {
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
    const { applyCustomLogRecordData, includeRawAttribution } =
      this.getConfig();

    const logRecord: LogRecord = {
      eventName: WEB_VITAL_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      attributes,
      ...(includeRawAttribution
        ? { body: JSON.stringify(metric.attribution) }
        : {}),
      ...(timestamp !== undefined ? { timestamp } : {}),
    };

    if (applyCustomLogRecordData) {
      this._runHook('applyCustomLogRecordData hook failed', () =>
        applyCustomLogRecordData(logRecord),
      );
    }

    this.logger.emit(logRecord);
  }
}
