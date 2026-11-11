/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AnyValueMap, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '@opentelemetry/browser-api';
import { defaultSanitizeUrl } from '#utils';
import { version } from '../../package.json' with { type: 'json' };
import {
  ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION,
  ATTR_LONG_ANIMATION_FRAME_DURATION,
  ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP,
  ATTR_LONG_ANIMATION_FRAME_RENDER_START,
  ATTR_LONG_ANIMATION_FRAME_SCRIPTS,
  ATTR_LONG_ANIMATION_FRAME_START_TIME,
  ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START,
  LONG_ANIMATION_FRAME_EVENT_NAME,
} from './semconv.ts';
import type {
  LongAnimationFrameEntry,
  LongAnimationFrameInstrumentationConfig,
} from './types.ts';

const LONG_ANIMATION_FRAME_ENTRY_TYPE = 'long-animation-frame';

/**
 * `invoker` is the invoking script's source URL only for these entry types. For
 * the others it is a selector-like string — `DOMWindow.onclick`,
 * `BUTTON#cart.onclick`, `IMG[src=...].onload` — which a sanitizer that parses
 * its argument rejects.
 * https://developer.mozilla.org/en-US/docs/Web/API/PerformanceScriptTiming/invoker
 */
const URL_VALUED_INVOKER_TYPES: ReadonlySet<string> = new Set([
  'classic-script',
  'module-script',
]);

/**
 * Builds the attributes of a script entry. Only URL-valued `invoker` fields are
 * handed to `sanitizeUrl`; the selector-like ones and an unresolved
 * `source_url` are written as the browser reports them.
 */
function scriptAttributes(
  script: LongAnimationFrameEntry['scripts'][number],
  sanitize: (url: string) => string,
): AnyValueMap {
  return {
    start_time: script.startTime,
    duration: script.duration,
    execution_start: script.executionStart,
    invoker: URL_VALUED_INVOKER_TYPES.has(script.invokerType)
      ? sanitize(script.invoker)
      : script.invoker,
    invoker_type: script.invokerType,
    source_url: script.sourceURL
      ? sanitize(script.sourceURL)
      : script.sourceURL,
    source_function_name: script.sourceFunctionName,
    source_char_position: script.sourceCharPosition,
    pause_duration: script.pauseDuration,
    forced_style_and_layout_duration: script.forcedStyleAndLayoutDuration,
    window_attribution: script.windowAttribution,
  };
}

/** Captures Long Animation Frames API performance entries as OpenTelemetry logs. */
export class LongAnimationFrameInstrumentation extends InstrumentationBase<LongAnimationFrameInstrumentationConfig> {
  private _observer: PerformanceObserver | undefined;
  private _hasReplayedBufferedEntries = false;

  constructor(config: LongAnimationFrameInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/long-animation-frame',
      version,
      // Unlike `url.full` for navigation, fetch and xhr, the URL-bearing fields
      // here sit inside the `scripts` array, where a page token is easy to miss,
      // so sanitization is on by default. Pass `sanitizeUrl: undefined` to emit
      // both fields exactly as the browser reports them.
      { sanitizeUrl: defaultSanitizeUrl, ...config },
    );
  }

  protected override _init(): void {
    // The API is not Baseline — Firefox and Safari do not implement it — so a
    // browser without the entry type fails init instead of observing silently.
    if (
      !PerformanceObserver.supportedEntryTypes.includes(
        LONG_ANIMATION_FRAME_ENTRY_TYPE,
      )
    ) {
      throw new Error(
        `PerformanceObserver does not support the "${LONG_ANIMATION_FRAME_ENTRY_TYPE}" entry type in this browser.`,
      );
    }
  }

  protected override _onEnable(): void {
    if (this._observer) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Building the record can throw — a `sanitizeUrl` hook that rejects its
        // argument, for example. Contain the failure to the entry itself so it
        // cannot skip the frames that follow it in the same callback.
        this._safeExecute('Failed to process long-animation-frame entry', () =>
          this._emitLongAnimationFrame(entry as LongAnimationFrameEntry),
        );
      }
    });

    // Deliberately not wrapped in a try/catch: if `observe()` throws, the
    // throw reaches the base class, which rolls the instrumentation back to
    // `disabled` and logs the cause. Swallowing it here would leave the base
    // in `enabled` with no observer, so a later `enable()` would do nothing.
    observer.observe({
      type: LONG_ANIMATION_FRAME_ENTRY_TYPE,
      // The browser's long animation frame buffer is replayed once, on the
      // first enable. Disabling and re-enabling resumes live observation
      // instead of re-emitting frames that were already logged.
      buffered: !this._hasReplayedBufferedEntries,
    });
    this._observer = observer;
    // Set only after a successful observe, so a failed first enable keeps the
    // replay pending for the next attempt.
    this._hasReplayedBufferedEntries = true;
  }

  protected override _onDisable(): void {
    this._observer?.disconnect();
    this._observer = undefined;
  }

  private _emitLongAnimationFrame(entry: LongAnimationFrameEntry): void {
    if (!this.isEnabled()) {
      return;
    }

    // `invoker` and `source_url` are written as the browser reports them, except
    // that real URLs go through `sanitizeUrl`: for an inline script, that URL is
    // the page URL including its query string. `invoker` is a selector-like
    // string for every entry type except `classic-script` and `module-script`,
    // and `sourceURL` is an empty string when the browser could not resolve it —
    // a sanitizer that parses its argument (`new URL(url)`, the obvious
    // implementation) would throw on either, so neither is handed to it.
    const { sanitizeUrl } = this._config;
    const sanitize = (url: string): string =>
      sanitizeUrl && typeof url === 'string' ? sanitizeUrl(url) : url;

    const scripts = Array.isArray(entry.scripts) ? entry.scripts : [];

    const record: LogRecord = {
      eventName: LONG_ANIMATION_FRAME_EVENT_NAME,
      severityNumber: SeverityNumber.INFO,
      timestamp: performance.timeOrigin + entry.startTime,
      attributes: {
        [ATTR_LONG_ANIMATION_FRAME_START_TIME]: entry.startTime,
        [ATTR_LONG_ANIMATION_FRAME_DURATION]: entry.duration,
        [ATTR_LONG_ANIMATION_FRAME_BLOCKING_DURATION]: entry.blockingDuration,
        // The spec's getters return 0 when the frame has no such value (no
        // rendering cycle, no style and layout, no UI event). A 0 would read as
        // a real time at the time origin, so the attribute is omitted instead.
        ...(entry.renderStart > 0
          ? { [ATTR_LONG_ANIMATION_FRAME_RENDER_START]: entry.renderStart }
          : {}),
        ...(entry.styleAndLayoutStart > 0
          ? {
              [ATTR_LONG_ANIMATION_FRAME_STYLE_AND_LAYOUT_START]:
                entry.styleAndLayoutStart,
            }
          : {}),
        ...(entry.firstUIEventTimestamp > 0
          ? {
              [ATTR_LONG_ANIMATION_FRAME_FIRST_UI_EVENT_TIMESTAMP]:
                entry.firstUIEventTimestamp,
            }
          : {}),
        ...(scripts.length > 0
          ? {
              [ATTR_LONG_ANIMATION_FRAME_SCRIPTS]: scripts.map((script) =>
                scriptAttributes(script, sanitize),
              ),
            }
          : {}),
      },
    };

    this._safeExecute('Failed to emit long-animation-frame log record', () =>
      this.logger.emit(record),
    );
  }
}
