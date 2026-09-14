/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

// The Long Animation Frames API is not Baseline and is currently unavailable in
// Firefox and Safari.
// https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming
/* eslint-disable baseline-js/use-baseline */

import type { AnyValueMap, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import { version } from '../../package.json' with { type: 'json' };
import {
  ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION,
  ATTR_LONG_ANIMATION_FRAME_DURATION,
  ATTR_LONG_ANIMATION_FRAME_ENTRY_TYPE,
  ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP,
  ATTR_LONG_ANIMATION_FRAME_NAME,
  ATTR_LONG_ANIMATION_FRAME_RENDER_START,
  ATTR_LONG_ANIMATION_FRAME_SCRIPTS,
  ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START,
  LONG_ANIMATION_FRAME_EVENT_NAME,
} from './semconv.ts';
import type {
  LongAnimationFrameInstrumentationConfig,
  PerformanceLongAnimationFrameTiming,
} from './types.ts';

const LONG_ANIMATION_FRAME_ENTRY_TYPE = 'long-animation-frame';

/** Captures Long Animation Frames API performance entries as OpenTelemetry logs. */
export class LongAnimationFrameInstrumentation extends InstrumentationBase<LongAnimationFrameInstrumentationConfig> {
  private declare _isEnabled: boolean;
  private declare _observer?: PerformanceObserver;

  constructor(config: LongAnimationFrameInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/long-animation-frame',
      version,
      config,
    );
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
        this._emitLongAnimationFrame(
          entry as PerformanceLongAnimationFrameTiming,
        );
      }
    });

    try {
      observer.observe({
        type: LONG_ANIMATION_FRAME_ENTRY_TYPE,
        buffered: true,
      });
      this._observer = observer;
      this._isEnabled = true;
    } catch (error) {
      observer.disconnect();
      this._diag.error(
        'Failed to start long-animation-frame PerformanceObserver',
        error,
      );
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
        'PerformanceObserver is not supported, long animation frames will not be collected',
      );
      return false;
    }

    const supported = PerformanceObserver.supportedEntryTypes.includes(
      LONG_ANIMATION_FRAME_ENTRY_TYPE,
    );
    if (!supported) {
      this._diag.debug(
        'Long Animation Frames API is not supported, long animation frames will not be collected',
      );
    }
    return supported;
  }

  private _emitLongAnimationFrame(
    entry: PerformanceLongAnimationFrameTiming,
  ): void {
    if (!this._isEnabled) {
      return;
    }

    const record: LogRecord = {
      eventName: LONG_ANIMATION_FRAME_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      timestamp: performance.timeOrigin + entry.startTime,
      attributes: {
        [ATTR_LONG_ANIMATION_FRAME_NAME]: entry.name,
        [ATTR_LONG_ANIMATION_FRAME_ENTRY_TYPE]: entry.entryType,
        [ATTR_LONG_ANIMATION_FRAME_DURATION]: entry.duration,
        [ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION]: entry.blockingDuration,
        [ATTR_LONG_ANIMATION_FRAME_RENDER_START]: entry.renderStart,
        [ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START]:
          entry.styleAndLayoutStart,
        [ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP]:
          entry.firstUIEventTimestamp,
        ...(Array.isArray(entry.scripts) && entry.scripts.length > 0
          ? {
              [ATTR_LONG_ANIMATION_FRAME_SCRIPTS]: entry.scripts.map(
                (script): AnyValueMap => ({
                  name: script.name,
                  entry_type: script.entryType,
                  start_time: script.startTime,
                  duration: script.duration,
                  execution_start: script.executionStart,
                  invoker: script.invoker,
                  invoker_type: script.invokerType,
                  source_url: script.sourceURL,
                  source_function_name: script.sourceFunctionName,
                  source_char_position: script.sourceCharPosition,
                  pause_duration: script.pauseDuration,
                  forced_style_and_layout_duration:
                    script.forcedStyleAndLayoutDuration,
                  window_attribution: script.windowAttribution,
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
          this._diag.error(
            'Failed to emit long-animation-frame log record',
            error,
          );
        }
      },
      true,
    );
  }
}
