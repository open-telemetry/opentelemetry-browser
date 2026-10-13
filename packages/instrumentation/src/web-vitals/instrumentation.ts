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
import { version } from '../../package.json' with { type: 'json' };
import {
  ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET,
  ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE,
  ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INTERSECTING_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_FUNCTION_NAME,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SUBPART,
  ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME,
  ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION,
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
  declare private _isEnabled: boolean;
  declare private _listenersRegistered: boolean;
  private _applyCustomLogRecordData?: (logRecord: LogRecord) => void;
  private _includeRawAttribution: boolean;

  constructor(config: WebVitalsInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/web-vitals', version, config);
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
    // Read from the config: this first runs inside super(), before fields are set.
    const opts = {
      reportAllChanges: this.getConfig().reportAllChanges ?? false,
    };
    // CLS is only supported in Chromium. See:
    // https://github.com/GoogleChrome/web-vitals?tab=readme-ov-file#browser-support
    onCLS((metric) => this._emitWebVital(metric), opts);
    onINP((metric) => this._emitWebVital(metric), opts);
    onLCP((metric) => this._emitWebVital(metric), opts);
    onFCP((metric) => this._emitWebVital(metric), opts);
    onTTFB((metric) => this._emitWebVital(metric), opts);
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

  private _getINPAttributionAttributes(
    attribution: INPMetricWithAttribution['attribution'],
  ): Attributes {
    const attributes: Attributes = {
      [ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY]: attribution.inputDelay,
      [ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION]:
        attribution.processingDuration,
      [ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY]:
        attribution.presentationDelay,
      [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: attribution.loadState,
    };

    if (attribution.interactionTarget !== undefined) {
      attributes[ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET] =
        attribution.interactionTarget;
    }
    if (attribution.interactionType !== undefined) {
      attributes[ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE] =
        attribution.interactionType;
    }
    if (attribution.nextPaintTime !== undefined) {
      attributes[ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME] =
        attribution.nextPaintTime;
    }

    const longestScript = attribution.longestScript;
    if (longestScript) {
      // web-vitals supplies this entry only when LoAF is supported.
      /* eslint-disable baseline-js/use-baseline */
      Object.assign(attributes, {
        [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER]:
          longestScript.entry.invoker,
        [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL]:
          longestScript.entry.sourceURL,
        [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_FUNCTION_NAME]:
          longestScript.entry.sourceFunctionName,
        [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_DURATION]:
          longestScript.entry.duration,
        [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SUBPART]:
          longestScript.subpart,
        [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INTERSECTING_DURATION]:
          longestScript.intersectingDuration,
      });
      /* eslint-enable baseline-js/use-baseline */
    }

    return attributes;
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

    if (this._includeRawAttribution && metric.name === 'INP') {
      Object.assign(
        attributes,
        this._getINPAttributionAttributes(metric.attribution),
      );
    }

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
