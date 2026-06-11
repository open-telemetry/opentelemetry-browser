/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span } from '@opentelemetry/api';
import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
import type {
  ReadableSpan,
  SpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';
import type { BrowserDocumentUrlProcessorConfig } from './types.ts';

/**
 * A LogRecordProcessor that stamps every log record with
 * `browser.document.url.full` set to `location.href` at emit time.
 *
 * Pass an instance in the `processors` array of your `LoggerProvider` config:
 *
 * ```ts
 * new LoggerProvider({
 *   processors: [
 *     new BrowserDocumentUrlLogProcessor(),
 *     new BatchLogRecordProcessor(exporter),
 *   ],
 * });
 * ```
 */
export class BrowserDocumentUrlLogProcessor implements LogRecordProcessor {
  private _enabled: boolean;

  constructor(config: BrowserDocumentUrlProcessorConfig = {}) {
    this._enabled = config.enabled ?? true;
  }

  enable(): void {
    this._enabled = true;
  }

  disable(): void {
    this._enabled = false;
  }

  onEmit(logRecord: SdkLogRecord, _context?: Context): void {
    if (this._enabled) {
      logRecord.setAttribute(ATTR_BROWSER_DOCUMENT_URL_FULL, location.href);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

/**
 * A SpanProcessor that stamps every span with `browser.document.url.full`
 * set to `location.href` at span start time.
 *
 * Pass an instance in the `spanProcessors` array of your tracer provider config:
 *
 * ```ts
 * new WebTracerProvider({
 *   spanProcessors: [
 *     new BrowserDocumentUrlSpanProcessor(),
 *     new BatchSpanProcessor(exporter),
 *   ],
 * });
 * ```
 */
export class BrowserDocumentUrlSpanProcessor implements SpanProcessor {
  private _enabled: boolean;

  constructor(config: BrowserDocumentUrlProcessorConfig = {}) {
    this._enabled = config.enabled ?? true;
  }

  enable(): void {
    this._enabled = true;
  }

  disable(): void {
    this._enabled = false;
  }

  onStart(span: Span, _parentContext: Context): void {
    if (this._enabled) {
      span.setAttribute(ATTR_BROWSER_DOCUMENT_URL_FULL, location.href);
    }
  }

  onEnd(_span: ReadableSpan): void {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
