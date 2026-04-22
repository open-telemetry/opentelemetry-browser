/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span, TracerProvider } from '@opentelemetry/api';
import type { LoggerProvider } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
import { version } from '../../package.json' with { type: 'json' };
import { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';
import type { BrowserDocumentUrlInstrumentationConfig } from './types.ts';

/**
 * Duck-typed interface for TracerProviders that support adding span processors
 * at runtime (SDK v1.x `BasicTracerProvider` had a public `addSpanProcessor`
 * method; v2.x removed it).
 */
interface TracerProviderV1 {
  addSpanProcessor?(processor: SpanProcessorLike): void;
}

/**
 * Duck-typed interface for SDK v2.x `BasicTracerProvider`, which stores
 * processors inside `_activeSpanProcessor` (a `MultiSpanProcessor` whose
 * `_spanProcessors` array is iterated on every `onStart` call).
 */
interface TracerProviderV2 {
  _activeSpanProcessor?: {
    _spanProcessors?: SpanProcessorLike[];
  };
}

/**
 * Duck-typed interface for TracerProvider proxies that wrap a delegate
 * (e.g. `ProxyTracerProvider` from `@opentelemetry/api`).
 */
interface TracerProviderProxy {
  getDelegate?(): unknown;
}

/**
 * Minimal span-processor shape. Avoids a hard dependency on
 * `@opentelemetry/sdk-trace-base`.
 */
interface SpanProcessorLike {
  onStart(span: Span, parentContext: Context): void;
  onEnd(span: unknown): void;
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

/**
 * Duck-typed interface for the internal shared state of
 * `@opentelemetry/sdk-logs` `LoggerProvider`, which stores the list of
 * registered processors that is shared with `MultiLogRecordProcessor`.
 */
interface LoggerProviderSharedState {
  registeredLogRecordProcessors: LogRecordProcessor[];
}

interface LoggerProviderWithSharedState {
  _sharedState?: LoggerProviderSharedState;
}

/**
 * Instrumentation that stamps every OTel span and every OTel log record /
 * event with a `browser.document.url.full` attribute derived from
 * `location.href` at the moment the span/record is created.
 *
 * Registration works in two complementary ways:
 *
 * **Automatic injection** — when the instrumentation is passed to
 * `registerInstrumentations()`, it uses duck-typing to inject itself into the
 * active `LoggerProvider`'s processor list and calls `addSpanProcessor()` on
 * the active `TracerProvider` (if available). This covers the common
 * single-call setup.
 *
 * **Explicit registration** — the instrumentation also implements
 * `LogRecordProcessor`, so it can be passed directly in the `processors`
 * array of `LoggerProvider` constructor config. This is the recommended
 * approach when you need fine-grained control over processor ordering.
 */
export class BrowserDocumentUrlInstrumentation
  extends InstrumentationBase<BrowserDocumentUrlInstrumentationConfig>
  implements LogRecordProcessor, SpanProcessorLike
{
  // Use `declare` to prevent JS class field initializers from running after
  // super(), which would reset values set by the enable() call that
  // InstrumentationBase makes during its constructor.
  private declare _isEnabled: boolean;

  constructor(config: BrowserDocumentUrlInstrumentationConfig = {}) {
    super(
      '@opentelemetry/browser-instrumentation/browser-document-url',
      version,
      config,
    );
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    this._isEnabled = true;
  }

  override disable(): void {
    this._isEnabled = false;
  }

  /**
   * Called by `registerInstrumentations()` with the active logger provider.
   *
   * Attempts to inject `this` into the provider's processor list so that ALL
   * log records — not just those emitted through `this.logger` — receive the
   * `browser.document.url.full` attribute.
   *
   * The injection relies on an implementation detail of
   * `@opentelemetry/sdk-logs` `LoggerProvider`: its `_sharedState` exposes
   * `registeredLogRecordProcessors`, which is the same array referenced by the
   * internal `MultiLogRecordProcessor`. Pushing to that array is therefore
   * picked up by all subsequent `onEmit` calls without requiring the provider
   * to be re-created.
   *
   * An `includes` guard prevents double-registration when the instrumentation
   * is also passed explicitly in the `processors` config array.
   */
  override setLoggerProvider(loggerProvider: LoggerProvider): void {
    super.setLoggerProvider(loggerProvider);

    const sharedState = (
      loggerProvider as unknown as LoggerProviderWithSharedState
    )._sharedState;
    if (!sharedState) {
      this._diag.warn(
        'BrowserDocumentUrlInstrumentation: LoggerProvider does not expose ' +
          '_sharedState. Pass this instrumentation explicitly in the ' +
          '`processors` array of your LoggerProvider config to ensure ' +
          'browser.document.url.full is set on all log records.',
      );
      return;
    }

    if (!sharedState.registeredLogRecordProcessors.includes(this)) {
      sharedState.registeredLogRecordProcessors.push(this);
    }
  }

  /**
   * Called by `registerInstrumentations()` with the active tracer provider.
   *
   * Unwraps `ProxyTracerProvider` (which `@opentelemetry/api` uses as the
   * global provider) to reach the real SDK provider, then injects `this` as a
   * span processor using whichever hook is available:
   *
   * - SDK v1.x: `addSpanProcessor()` (public method, removed in v2).
   * - SDK v2.x: push directly into `_activeSpanProcessor._spanProcessors`,
   *   the array that `MultiSpanProcessor.onStart` iterates at call time.
   */
  override setTracerProvider(tracerProvider: TracerProvider): void {
    super.setTracerProvider(tracerProvider);

    // Unwrap ProxyTracerProvider → real SDK provider
    let realProvider: unknown = tracerProvider;
    const asProxy = tracerProvider as TracerProviderProxy;
    if (typeof asProxy.getDelegate === 'function') {
      realProvider = asProxy.getDelegate();
    }

    // SDK v1.x path
    const asV1 = realProvider as TracerProviderV1;
    if (typeof asV1.addSpanProcessor === 'function') {
      asV1.addSpanProcessor(this);
      return;
    }

    // SDK v2.x path — inject into MultiSpanProcessor's processor list
    const asV2 = realProvider as TracerProviderV2;
    const spanProcessors = asV2._activeSpanProcessor?._spanProcessors;
    if (spanProcessors && !spanProcessors.includes(this)) {
      spanProcessors.push(this);
      return;
    }

    this._diag.debug(
      'BrowserDocumentUrlInstrumentation: TracerProvider does not support ' +
        'span processor injection — span attribute will not be set automatically.',
    );
  }

  // -------------------------------------------------------------------------
  // LogRecordProcessor implementation
  // -------------------------------------------------------------------------

  /**
   * Sets `browser.document.url.full` on every emitted log record while the
   * instrumentation is enabled.
   */
  onEmit(logRecord: SdkLogRecord, _context?: Context): void {
    if (!this._isEnabled) {
      return;
    }
    logRecord.setAttribute(ATTR_BROWSER_DOCUMENT_URL_FULL, location.href);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  // -------------------------------------------------------------------------
  // SpanProcessor implementation
  // -------------------------------------------------------------------------

  /**
   * Sets `browser.document.url.full` on every started span while the
   * instrumentation is enabled.
   */
  onStart(span: Span, _parentContext: Context): void {
    if (!this._isEnabled) {
      return;
    }
    span.setAttribute(ATTR_BROWSER_DOCUMENT_URL_FULL, location.href);
  }

  onEnd(_span: unknown): void {
    // no-op — we only need to set attributes at span start
  }
}
