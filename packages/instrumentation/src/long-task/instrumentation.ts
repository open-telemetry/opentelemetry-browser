/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// The Long Tasks API is not Baseline and is currently unavailable in Safari.
// https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming
/* eslint-disable baseline-js/use-baseline */

import type { AnyValueMap, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import { version } from '../../package.json' with { type: 'json' };
import {
  ATTR_LONG_TASK_ATTRIBUTION,
  ATTR_LONG_TASK_DURATION,
  ATTR_LONG_TASK_ENTRY_TYPE,
  ATTR_LONG_TASK_NAME,
  LONG_TASK_EVENT_NAME,
} from './semconv.ts';
import type {
  LongTaskInstrumentationConfig,
  PerformanceLongTaskTiming,
} from './types.ts';

const LONG_TASK_ENTRY_TYPE = 'longtask';

/** Captures Long Tasks API performance entries as OpenTelemetry logs. */
export class LongTaskInstrumentation extends InstrumentationBase<LongTaskInstrumentationConfig> {
  private declare _isEnabled: boolean;
  private declare _observer?: PerformanceObserver;

  constructor(config: LongTaskInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/long-task', version, config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._observer || !this._isSupported()) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this._emitLongTask(entry as PerformanceLongTaskTiming);
      }
    });

    try {
      observer.observe({ type: LONG_TASK_ENTRY_TYPE, buffered: true });
      this._observer = observer;
      this._isEnabled = true;
    } catch (error) {
      observer.disconnect();
      this._diag.error('Failed to start long-task PerformanceObserver', error);
    }
  }

  override disable(): void {
    this._isEnabled = false;
    this._observer?.disconnect();
    this._observer = undefined;
  }

  private _isSupported(): boolean {
    if (
      typeof PerformanceObserver === 'undefined' ||
      !PerformanceObserver.supportedEntryTypes
    ) {
      this._diag.debug(
        'PerformanceObserver is not supported, long tasks will not be collected',
      );
      return false;
    }

    const supported =
      PerformanceObserver.supportedEntryTypes.includes(LONG_TASK_ENTRY_TYPE);
    if (!supported) {
      this._diag.debug(
        'Long Tasks API is not supported, long tasks will not be collected',
      );
    }
    return supported;
  }

  private _emitLongTask(entry: PerformanceLongTaskTiming): void {
    if (!this._isEnabled) {
      return;
    }

    const record: LogRecord = {
      eventName: LONG_TASK_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      timestamp: performance.timeOrigin + entry.startTime,
      attributes: {
        [ATTR_LONG_TASK_NAME]: entry.name,
        [ATTR_LONG_TASK_ENTRY_TYPE]: entry.entryType,
        [ATTR_LONG_TASK_DURATION]: entry.duration,
        ...(Array.isArray(entry.attribution) && entry.attribution.length > 0
          ? {
              [ATTR_LONG_TASK_ATTRIBUTION]: entry.attribution.map(
                (attribution): AnyValueMap => ({
                  name: attribution.name,
                  entry_type: attribution.entryType,
                  start_time: attribution.startTime,
                  duration: attribution.duration,
                  container_type: attribution.containerType,
                  container_src: attribution.containerSrc,
                  container_id: attribution.containerId,
                  container_name: attribution.containerName,
                }),
              ),
            }
          : {}),
      },
    };

    const hook = this.getConfig().applyCustomLogRecordData;
    if (hook) {
      safeExecuteInTheMiddle(
        () => hook(record),
        (error) => {
          if (error) {
            this._diag.error('applyCustomLogRecordData hook failed', error);
          }
        },
        true,
      );
    }

    safeExecuteInTheMiddle(
      () => this.logger.emit(record),
      (error) => {
        if (error) {
          this._diag.error('Failed to emit long-task log record', error);
        }
      },
      true,
    );
  }
}
