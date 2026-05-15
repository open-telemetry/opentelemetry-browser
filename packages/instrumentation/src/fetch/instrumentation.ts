/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes, Span } from '@opentelemetry/api';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import { version } from '../../package.json' with { type: 'json' };
import {
  millisToHrTime,
  perfNowToAbsoluteHrTime,
} from '../utils/hrtime/index.ts';
import { getFetchBodyLength } from '../utils/http/getFetchBodyLength.ts';
import { normalizeHttpRequestMethod } from '../utils/http/normalizeHttpRequestMethod.ts';
import {
  getNetworkEventsAttributesFromResourceTiming,
  getResource,
} from '../utils/performance/index.ts';
import {
  isUrlIgnored,
  parseUrl,
  serverPortFromUrl,
  shouldPropagateTraceHeaders,
} from '../utils/url/index.ts';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_BODY_SIZE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_REQUEST_METHOD_ORIGINAL,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from './semconv.ts';
import type {
  FetchError,
  FetchInstrumentationConfig,
  FetchResponse,
  SpanData,
} from './types.ts';

// Wait for PerformanceObserver to collect resource timing info after the
// response body is read — the "load" event fires before the observer does.
const OBSERVER_WAIT_TIME_MS = 300;

export class FetchInstrumentation extends InstrumentationBase<FetchInstrumentationConfig> {
  readonly component = 'fetch';
  moduleName = this.component;

  private _usedResources = new WeakSet<PerformanceResourceTiming>();
  private _tasksCount = 0;

  // `declare` prevents JS class field initializers from resetting these after
  // the base class constructor calls enable().
  private declare _isEnabled: boolean;
  private declare _isFetchPatched: boolean;

  constructor(config: FetchInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/fetch', version, config);
  }

  protected override init() {
    return [];
  }

  private _addChildSpan(
    span: Span,
    corsPreFlight: PerformanceResourceTiming,
  ): void {
    const startTime = perfNowToAbsoluteHrTime(corsPreFlight.fetchStart);
    const childSpan = this.tracer.startSpan(
      'CORS Preflight',
      { startTime },
      trace.setSpan(context.active(), span),
    );
    if (
      !this.getConfig().ignoreNetworkEvents &&
      corsPreFlight.startTime !== 0
    ) {
      this.logger.emit({
        eventName: 'browser.fetch.cors_preflight_resource_timings',
        context: trace.setSpan(context.active(), childSpan),
        severityNumber: SeverityNumber.INFO,
        attributes: getNetworkEventsAttributesFromResourceTiming(corsPreFlight),
      });
    }
    childSpan.end(perfNowToAbsoluteHrTime(corsPreFlight.responseEnd));
  }

  private _addFinalSpanAttributes(span: Span, response: FetchResponse): void {
    const parsedUrl = parseUrl(response.url);
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);
    span.setAttribute(ATTR_SERVER_ADDRESS, parsedUrl.hostname);
    const port = serverPortFromUrl(parsedUrl);
    if (port) {
      span.setAttribute(ATTR_SERVER_PORT, port);
    }
  }

  private _addHeaders(options: Request | RequestInit, spanUrl: string): void {
    if (
      !shouldPropagateTraceHeaders(
        spanUrl,
        this.getConfig().propagateTraceHeaderCorsUrls,
      )
    ) {
      const headers: Partial<Record<string, unknown>> = {};
      propagation.inject(context.active(), headers);
      if (Object.keys(headers).length > 0) {
        this._diag.debug('headers inject skipped due to CORS policy');
      }
      return;
    }

    if (options instanceof Request) {
      propagation.inject(context.active(), options.headers, {
        set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
      });
    } else {
      const headers = new Headers(options.headers);
      propagation.inject(context.active(), headers, {
        set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
      });
      options.headers = headers;
    }
  }

  private _clearResources(): void {
    if (this._tasksCount === 0 && this.getConfig().clearTimingResources) {
      performance.clearResourceTimings();
      this._usedResources = new WeakSet<PerformanceResourceTiming>();
    }
  }

  private _createSpan(
    url: string,
    options: Partial<Request | RequestInit> = {},
  ): Span | undefined {
    if (isUrlIgnored(url, this.getConfig().ignoreUrls)) {
      this._diag.debug('ignoring span as url matches ignored url');
      return;
    }

    const origMethod = options.method;
    const normMethod = normalizeHttpRequestMethod(options.method ?? 'GET');
    const attributes: Attributes = {
      [ATTR_HTTP_REQUEST_METHOD]: normMethod,
      [ATTR_URL_FULL]: url,
    };
    if (normMethod !== origMethod) {
      attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = origMethod;
    }

    return this.tracer.startSpan(normMethod, {
      kind: SpanKind.CLIENT,
      attributes,
    });
  }

  private _findResourceAndAddNetworkEvents(
    span: Span,
    spanData: SpanData,
    spanEndPerfNow: number,
  ): void {
    let resources: PerformanceResourceTiming[] = spanData.entries;
    if (!resources.length) {
      if (!performance.getEntriesByType) {
        return;
      }
      resources = performance.getEntriesByType(
        'resource',
      ) as PerformanceResourceTiming[];
    }

    const resource = getResource(
      spanData.spanUrl,
      spanData.startPerfNow,
      spanEndPerfNow,
      resources,
      this._usedResources,
      'fetch',
    );

    if (resource.mainRequest) {
      this._markResourceAsUsed(resource.mainRequest);
      if (resource.corsPreFlightRequest) {
        this._addChildSpan(span, resource.corsPreFlightRequest);
        this._markResourceAsUsed(resource.corsPreFlightRequest);
      }
      if (
        !this.getConfig().ignoreNetworkEvents &&
        resource.mainRequest.startTime !== 0
      ) {
        this.logger.emit({
          eventName: 'browser.fetch.resource_timings',
          context: trace.setSpan(context.active(), span),
          severityNumber: SeverityNumber.INFO,
          attributes: getNetworkEventsAttributesFromResourceTiming(
            resource.mainRequest,
          ),
        });
      }
    }
  }

  private _markResourceAsUsed(resource: PerformanceResourceTiming): void {
    this._usedResources.add(resource);
  }

  private _endSpan(
    span: Span,
    spanData: SpanData,
    response: FetchResponse,
  ): void {
    const endTime = millisToHrTime(Date.now());
    const endPerfNow = performance.now();

    this._addFinalSpanAttributes(span, response);

    if (response.status >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute(ATTR_ERROR_TYPE, String(response.status));
    }

    setTimeout(() => {
      spanData.observer?.disconnect();
      this._findResourceAndAddNetworkEvents(span, spanData, endPerfNow);
      this._tasksCount--;
      this._clearResources();
      span.end(endTime);
    }, OBSERVER_WAIT_TIME_MS);
  }

  private _patchConstructor(): (original: typeof fetch) => typeof fetch {
    return (original) => {
      const plugin = this;

      return function patchedFetch(
        this: typeof globalThis,
        ...args: Parameters<typeof fetch>
      ): Promise<Response> {
        if (!plugin._isEnabled) {
          return original.apply(this, args);
        }

        const url = parseUrl(
          args[0] instanceof Request ? args[0].url : String(args[0]),
        ).href;

        // Merge Request + init so downstream code sees the final values.
        let options: Request | RequestInit;
        if (args[0] instanceof Request) {
          options = args[1] != null ? new Request(args[0], args[1]) : args[0];
        } else {
          options = args[1] ?? {};
        }

        const createdSpan = plugin._createSpan(url, options);
        if (!createdSpan) {
          return original.apply(this, args);
        }

        const spanData = plugin._prepareSpanData(url);

        if (plugin.getConfig().measureRequestSize) {
          getFetchBodyLength(...args)
            .then((bodyLength) => {
              if (bodyLength != null) {
                createdSpan.setAttribute(
                  ATTR_HTTP_REQUEST_BODY_SIZE,
                  bodyLength,
                );
              }
            })
            .catch((err) => {
              plugin._diag.warn('getFetchBodyLength', err);
            });
        }

        function endSpanOnError(span: Span, error: FetchError): void {
          plugin._applyAttributesAfterFetch(span, options, error);
          plugin._endSpan(span, spanData, {
            status: error.status ?? 0,
            statusText: error.message,
            url,
          });
        }

        function endSpanOnSuccess(span: Span, response: Response): void {
          plugin._applyAttributesAfterFetch(span, options, response);
          if (response.status >= 200 && response.status < 400) {
            plugin._endSpan(span, spanData, response);
          } else {
            plugin._endSpan(span, spanData, {
              status: response.status,
              statusText: response.statusText,
              url,
            });
          }
        }

        function onSuccess(span: Span, response: Response): Response {
          try {
            const resClone = response.clone();
            const body = resClone.body;
            if (body) {
              const reader = body.getReader();
              const read = (): void => {
                reader.read().then(
                  ({ done }) => {
                    if (done) {
                      endSpanOnSuccess(span, response);
                    } else {
                      read();
                    }
                  },
                  (error: FetchError) => endSpanOnError(span, error),
                );
              };
              read();
            } else {
              endSpanOnSuccess(span, response);
            }
          } catch (error) {
            plugin._diag.error('Failed to read fetch response body', error);
            plugin._endSpan(span, spanData, { status: 0, url });
          }
          return response;
        }

        function onError(span: Span, error: FetchError): never {
          try {
            endSpanOnError(span, error);
          } catch (e) {
            plugin._diag.error('Failed to end span on fetch error', e);
            plugin._endSpan(span, spanData, { status: error.status ?? 0, url });
          }

          throw error;
        }

        return context.with(
          trace.setSpan(context.active(), createdSpan),
          () => {
            plugin._callRequestHook(createdSpan, options);
            plugin._addHeaders(options, url);
            plugin._tasksCount++;
            return original
              .apply(
                globalThis,
                options instanceof Request ? [options] : [url, options],
              )
              .then(
                (response: Response) => onSuccess(createdSpan, response),
                (error: FetchError) => onError(createdSpan, error),
              );
          },
        );
      };
    };
  }

  private _applyAttributesAfterFetch(
    span: Span,
    request: Request | RequestInit,
    result: Response | FetchError,
  ): void {
    const hook = this.getConfig().applyCustomAttributesOnSpan;
    if (!hook) {
      return;
    }
    safeExecuteInTheMiddle(
      () => hook(span, request, result),
      (error) => {
        if (error) {
          this._diag.error('applyCustomAttributesOnSpan', error);
        }
      },
      true,
    );
  }

  private _callRequestHook(span: Span, request: Request | RequestInit): void {
    const hook = this.getConfig().requestHook;
    if (!hook) {
      return;
    }
    safeExecuteInTheMiddle(
      () => hook(span, request),
      (error) => {
        if (error) {
          this._diag.error('requestHook', error);
        }
      },
      true,
    );
  }

  private _prepareSpanData(spanUrl: string): SpanData {
    const startPerfNow = performance.now();
    const entries: PerformanceResourceTiming[] = [];

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        if (entry.initiatorType === 'fetch' && entry.name === spanUrl) {
          entries.push(entry);
        }
      }
    });
    observer.observe({ entryTypes: ['resource'] });

    return { entries, observer, spanUrl, startPerfNow };
  }

  override enable(): void {
    if (this._isEnabled) {
      return;
    }

    if (this._isFetchPatched) {
      this._diag.debug('fetch constructor already patched');
      this._isEnabled = true;
      return;
    }

    try {
      this._wrap(globalThis, 'fetch', this._patchConstructor());
      this._isFetchPatched = true;
      this._isEnabled = true;
    } catch (err) {
      this._diag.warn(
        'Failed to patch globalThis.fetch; instrumentation will not be enabled. ' +
          'Another script may have locked globalThis.fetch via Object.defineProperty.',
        err,
      );
    }
  }

  override disable(): void {
    if (!this._isEnabled) {
      return;
    }
    this._isEnabled = false;
    this._usedResources = new WeakSet<PerformanceResourceTiming>();
  }
}
