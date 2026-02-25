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
  FCPMetricWithAttribution,
  INPMetricWithAttribution,
  LCPMetricWithAttribution,
  MetricWithAttribution,
  TTFBMetricWithAttribution,
} from 'web-vitals/attribution';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';
import {
  ATTR_WEB_VITAL_ATTRIBUTION_CACHE_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_CONNECTION_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_DNS_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_ELEMENT_RENDER_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_FIRST_BYTE_TO_FCP,
  ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET,
  ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE,
  ATTR_WEB_VITAL_ATTRIBUTION_LARGEST_SHIFT_TARGET,
  ATTR_WEB_VITAL_ATTRIBUTION_LARGEST_SHIFT_VALUE,
  ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE,
  ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME,
  ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_REQUEST_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_RESOURCE_LOAD_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_RESOURCE_LOAD_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_TARGET,
  ATTR_WEB_VITAL_ATTRIBUTION_TIME_TO_FIRST_BYTE,
  ATTR_WEB_VITAL_ATTRIBUTION_URL,
  ATTR_WEB_VITAL_ATTRIBUTION_WAITING_DURATION,
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
 *
 * Note: The `web-vitals` library does not support removing listeners once
 * registered. Calling `disable()` will stop emitting logs, but the underlying
 * listeners remain active. Calling `enable()` again will resume emission.
 */
export class WebVitalsInstrumentation extends InstrumentationBase<WebVitalsInstrumentationConfig> {
  // Using `declare` is required here: InstrumentationBase calls enable() during
  // construction, and standard field initialization would reset this flag after
  // super() returns, breaking the duplicate-registration guard.
  private declare _listenersRegistered: boolean;
  private declare _isEnabled: boolean;
  private _applyCustomLogRecordData?: (logRecord: LogRecord) => void;

  constructor(config: WebVitalsInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-web-vitals', '0.1.0', config);
    this._applyCustomLogRecordData = config.applyCustomLogRecordData;
  }

  protected override init() {
    return [];
  }

  /**
   * Checks if the browser environment supports the APIs required for web vitals.
   */
  private _isSupported(): boolean {
    return typeof PerformanceObserver !== 'undefined';
  }

  /**
   * Enables the instrumentation and registers web-vitals listeners.
   * Listeners are registered only once; subsequent calls resume emission.
   */
  override enable(): void {
    if (!this._isSupported()) {
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

    const trackingLevel = this.getConfig().trackingLevel ?? 'core';
    this._diag.debug(
      `Registering web vitals listeners (trackingLevel: ${trackingLevel})`,
    );

    onCLS((metric) => this._emitWebVital(metric));
    onINP((metric) => this._emitWebVital(metric));
    onLCP((metric) => this._emitWebVital(metric));

    if (trackingLevel === 'all') {
      onFCP((metric) => this._emitWebVital(metric));
      onTTFB((metric) => this._emitWebVital(metric));
    }
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
      if (attribution.largestShiftTime) {
        return performance.timeOrigin + attribution.largestShiftTime;
      }
    }
    if (metric.name === 'INP') {
      const { attribution } = metric as INPMetricWithAttribution;
      if (attribution.interactionTime) {
        return performance.timeOrigin + attribution.interactionTime;
      }
    }
    return undefined;
  }

  private _emitWebVital(metric: MetricWithAttribution): void {
    if (!this._isEnabled) {
      return;
    }
    const attributes: Attributes = {
      [ATTR_WEB_VITAL_NAME]: metric.name.toLowerCase(),
      [ATTR_WEB_VITAL_VALUE]: metric.value,
      [ATTR_WEB_VITAL_RATING]: metric.rating,
      [ATTR_WEB_VITAL_DELTA]: metric.delta,
      [ATTR_WEB_VITAL_ID]: metric.id,
      [ATTR_WEB_VITAL_NAVIGATION_TYPE]: metric.navigationType,
      ...this._extractAttribution(metric),
    };

    // Use attribution timing for accurate event timestamps when available
    const timestamp = this._getTimestampForMetric(metric);

    const logRecord: LogRecord = {
      eventName: WEB_VITAL_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      attributes,
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

  private _extractAttribution(metric: MetricWithAttribution): Attributes {
    switch (metric.name) {
      case 'CLS': {
        const { attribution } = metric as CLSMetricWithAttribution;
        return {
          ...(attribution.largestShiftTarget
            ? {
                [ATTR_WEB_VITAL_ATTRIBUTION_LARGEST_SHIFT_TARGET]:
                  attribution.largestShiftTarget,
              }
            : {}),
          [ATTR_WEB_VITAL_ATTRIBUTION_LARGEST_SHIFT_VALUE]:
            attribution.largestShiftValue,
          [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: attribution.loadState,
        };
      }
      case 'INP': {
        const { attribution } = metric as INPMetricWithAttribution;
        return {
          ...(attribution.interactionTarget
            ? {
                [ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET]:
                  attribution.interactionTarget,
              }
            : {}),
          [ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE]:
            attribution.interactionType,
          [ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY]: attribution.inputDelay,
          [ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION]:
            attribution.processingDuration,
          [ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY]:
            attribution.presentationDelay,
          [ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME]:
            attribution.nextPaintTime,
          [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: attribution.loadState,
        };
      }
      case 'LCP': {
        const { attribution } = metric as LCPMetricWithAttribution;
        return {
          ...(attribution.target
            ? { [ATTR_WEB_VITAL_ATTRIBUTION_TARGET]: attribution.target }
            : {}),
          ...(attribution.url
            ? { [ATTR_WEB_VITAL_ATTRIBUTION_URL]: attribution.url }
            : {}),
          [ATTR_WEB_VITAL_ATTRIBUTION_TIME_TO_FIRST_BYTE]:
            attribution.timeToFirstByte,
          [ATTR_WEB_VITAL_ATTRIBUTION_RESOURCE_LOAD_DELAY]:
            attribution.resourceLoadDelay,
          [ATTR_WEB_VITAL_ATTRIBUTION_RESOURCE_LOAD_DURATION]:
            attribution.resourceLoadDuration,
          [ATTR_WEB_VITAL_ATTRIBUTION_ELEMENT_RENDER_DELAY]:
            attribution.elementRenderDelay,
        };
      }
      case 'FCP': {
        const { attribution } = metric as FCPMetricWithAttribution;
        return {
          [ATTR_WEB_VITAL_ATTRIBUTION_TIME_TO_FIRST_BYTE]:
            attribution.timeToFirstByte,
          [ATTR_WEB_VITAL_ATTRIBUTION_FIRST_BYTE_TO_FCP]:
            attribution.firstByteToFCP,
          [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: attribution.loadState,
        };
      }
      case 'TTFB': {
        const { attribution } = metric as TTFBMetricWithAttribution;
        return {
          [ATTR_WEB_VITAL_ATTRIBUTION_WAITING_DURATION]:
            attribution.waitingDuration,
          [ATTR_WEB_VITAL_ATTRIBUTION_CACHE_DURATION]:
            attribution.cacheDuration,
          [ATTR_WEB_VITAL_ATTRIBUTION_DNS_DURATION]: attribution.dnsDuration,
          [ATTR_WEB_VITAL_ATTRIBUTION_CONNECTION_DURATION]:
            attribution.connectionDuration,
          [ATTR_WEB_VITAL_ATTRIBUTION_REQUEST_DURATION]:
            attribution.requestDuration,
        };
      }
      default:
        return {};
    }
  }
}
