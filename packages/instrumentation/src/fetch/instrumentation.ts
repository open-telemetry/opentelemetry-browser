/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes, Context, Span } from '@opentelemetry/api';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_REQUEST_METHOD_ORIGINAL,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { version } from '../../package.json' with { type: 'json' };
import { getNetworkContextRegistry } from '../utils/NetworkContextRegistry.ts';
import {
  getFetchBodyLength,
  normalizeHttpRequestMethod,
} from '../utils/request.ts';
import { matchesUrl, parseUrl, serverPortFromUrl } from '../utils/url.ts';
import { ATTR_HTTP_REQUEST_BODY_SIZE } from './semconv.ts';
import type {
  FetchError,
  FetchInstrumentationConfig,
  FetchResponse,
} from './types.ts';

const hasBrowserPerformanceAPI = typeof PerformanceObserver !== 'undefined';

export class FetchInstrumentation extends InstrumentationBase<FetchInstrumentationConfig> {
  // Note: Intentionally *not* using `_enabled` as the field name to avoid
  // any possible confusion with the `_enabled` field used on the *Node.js*
  // InstrumentationBase class.
  // Also not initializing the fields to `false` because the base class
  // constructor already call `enable` modifying their values and it will
  // set the instrumentations in a base state (enabled, patched but with flags set to false)
  private declare _isEnabled: boolean;
  private declare _isFetchPatched: boolean;

  // To keep track of the resources for posterior cleanup the context registry
  private _registeredResources: PerformanceResourceTiming[] = [];
  private _unregisterTimer: number | undefined;

  constructor(config: FetchInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/fetch', version, config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (!hasBrowserPerformanceAPI) {
      this._diag.warn(
        'this instrumentation is intended for web usage only, it does not instrument server-side fetch()',
      );
      return;
    }

    if (this._isEnabled) {
      return;
    }

    if (this._isFetchPatched) {
      this._diag.debug('fetch constructor already patched');
      this._isEnabled = true;
      return;
    }

    try {
      // `_wrap` throws if a third-party script has locked globalThis.fetch via
      // Object.defineProperty(window, 'fetch', { writable: false, ... }).
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
    if (!hasBrowserPerformanceAPI) {
      return;
    }
    if (!this._isEnabled) {
      return;
    }
    this._isEnabled = false;
  }

  /**
   * Patches the constructor of fetch
   */
  private _patchConstructor(): (original: typeof fetch) => typeof fetch {
    return (original) => {
      const instrumentation = this;

      return function patchConstructor(
        this: typeof globalThis,
        ...args: Parameters<typeof fetch>
      ): Promise<Response> {
        if (!instrumentation._isEnabled) {
          return original.apply(this, args);
        }
        const instrConfig = instrumentation.getConfig();

        const url = parseUrl(
          args[0] instanceof Request ? args[0].url : String(args[0]),
        ).href;

        const shouldIgnoreUrl = matchesUrl(url, instrConfig.ignoreUrls);
        if (shouldIgnoreUrl) {
          return original.apply(this, args);
        }

        // Per the Fetch spec, when fetch() is called with a Request object
        // and a separate init object, the init properties override the
        // Request's properties. Merge them into a new Request so that
        // downstream consumers (hooks, header injection, the actual fetch
        // call) see the correct final values.
        // See: https://developer.mozilla.org/en-US/docs/Web/API/Request/Request#parameters
        let options: Request | RequestInit;
        if (args[0] instanceof Request) {
          options = args[1] != null ? new Request(args[0], args[1]) : args[0];
        } else {
          options = args[1] || {};
        }

        const createdSpan = instrumentation._createSpan(url, options);
        if (instrConfig.measureRequestSize) {
          getFetchBodyLength(...args)
            .then((bodyLength) => {
              if (typeof bodyLength === 'number') {
                createdSpan.setAttribute(
                  ATTR_HTTP_REQUEST_BODY_SIZE,
                  bodyLength,
                );
              }
            })
            .catch((error) => {
              instrumentation._diag.warn('getFetchBodyLength', error);
            });
        }

        function endSpanOnError(span: Span, error: FetchError) {
          instrumentation._applyAttributesAfterFetch(span, options, error);
          instrumentation._endSpan(span, {
            status: error.status || 0,
            statusText: error.message,
          });
        }

        function endSpanOnSuccess(span: Span, response: Response) {
          instrumentation._applyAttributesAfterFetch(span, options, response);
          if (response.status >= 200 && response.status < 400) {
            instrumentation._endSpan(span, response);
          } else {
            instrumentation._endSpan(span, {
              status: response.status,
              statusText: response.statusText,
            });
          }
        }

        function onSuccess(span: Span, response: Response): Response {
          try {
            // Clone the response and eagerly consume the clone to detect
            // when the body transfer completes.  The original response is
            // returned to the caller untouched so that it passes internal
            // brand-checks required by APIs such as
            // WebAssembly.compileStreaming.
            // It consumes the entire body even if the user cancels reading it
            // from the original response. But it does work with `AbortController.abort()`
            // because it aborts the underlying fetch cancelling the original and clone streams
            // ref: https://github.com/open-telemetry/opentelemetry-js/pull/6521
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
                  (error) => {
                    endSpanOnError(span, error);
                  },
                );
              };
              read();
            } else {
              // some older browsers don't have .body implemented
              endSpanOnSuccess(span, response);
            }
          } catch (error) {
            // Setup failed (e.g. clone() or getReader() threw).
            // End the span and clean up so _tasksCount doesn't leak.
            instrumentation._diag.error(
              'Failed to read fetch response body',
              error,
            );
            instrumentation._endSpan(span, {
              status: 0,
            });
          }
          return response;
        }

        function onError(span: Span, error: FetchError): never {
          try {
            endSpanOnError(span, error);
          } catch (e: unknown) {
            // endSpanOnError failed — fall back to ending the span
            // directly so _tasksCount doesn't leak.
            instrumentation._diag.error('Failed to end span on fetch error', e);
            instrumentation._endSpan(span, {
              status: error.status || 0,
            });
          }
          throw error;
        }

        const fetchContext = trace.setSpan(context.active(), createdSpan);
        return context.with(fetchContext, () => {
          const fetchUrl = url;
          const fetchStart = performance.now();

          // Call request hook before injection so hooks cannot tamper with propagation headers.
          // Also, this means the hook will see `options.headers` in the same type as passed in,
          // rather than as a `Headers` instance set by `_addHeaders()`.
          instrumentation._callRequestHook(createdSpan, options);
          instrumentation._addHeaders(options, url, fetchContext);

          return original
            .apply(
              globalThis,
              options instanceof Request ? [options] : [url, options],
            )
            .then(
              onSuccess.bind(globalThis, createdSpan),
              onError.bind(globalThis, createdSpan),
            )
            .finally(() => {
              // Set the context for other instrumentations (like resource-timing) to pick it up
              const responseEnd = performance.now();
              const resource = {
                name: fetchUrl,
                fetchStart,
                responseEnd,
              } as PerformanceResourceTiming;
              instrumentation._registerResource(createdSpan, resource);
            });
        });
      };
    };
  }

  /**
   * Registers a resource and sets a timer for clearing the registry after a time being idle
   */
  private _registerResource(span: Span, resource: PerformanceResourceTiming) {
    const registry = getNetworkContextRegistry();
    const data = {
      key: resource.name,
      startPerfNow: resource.fetchStart,
      endPerfNow: resource.responseEnd,
    };

    // Add to the registry and keep a reference
    registry.register(span, data);
    this._registeredResources.push(resource);

    // Cancel any pending clear task and schedule
    if (typeof this._unregisterTimer === 'number') {
      clearTimeout(this._unregisterTimer);
    }
    this._unregisterTimer = setTimeout(() => {
      for (const res of this._registeredResources) {
        registry.unregister(res);
      }
      this._registeredResources.length = 0;
      this._unregisterTimer = undefined;
    }, 1000);
  }

  /**
   * Creates a new span
   */
  private _createSpan(
    url: string,
    options: Partial<Request | RequestInit> = {},
  ): Span {
    const attributes = {} as Attributes;
    const parsedUrl = parseUrl(url);
    const origMethod = options.method;
    const normMethod = normalizeHttpRequestMethod(options.method || 'GET');
    const serverPort = serverPortFromUrl(parsedUrl);
    const name = normMethod;

    attributes[ATTR_HTTP_REQUEST_METHOD] = normMethod;
    attributes[ATTR_URL_FULL] = url;
    attributes[ATTR_SERVER_ADDRESS] = parsedUrl.hostname;
    if (serverPort) {
      attributes[ATTR_SERVER_PORT] = serverPort;
    }
    if (origMethod && origMethod !== normMethod) {
      attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = origMethod;
    }

    return this.tracer.startSpan(name, {
      kind: SpanKind.CLIENT,
      attributes,
    });
  }

  /**
   * Finish span, add attributes, etc.
   */
  private _endSpan(span: Span, response: FetchResponse) {
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);
    // https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status
    if (response.status >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttribute(ATTR_ERROR_TYPE, String(response.status));
    }
    span.end();
  }

  private _applyAttributesAfterFetch(
    span: Span,
    request: Request | RequestInit,
    result: Response | FetchError,
  ) {
    const applyCustomAttributesOnSpan =
      this.getConfig().applyCustomAttributesOnSpan;
    if (applyCustomAttributesOnSpan) {
      safeExecuteInTheMiddle(
        () => applyCustomAttributesOnSpan(span, request, result),
        (error) => {
          if (!error) {
            return;
          }
          this._diag.error('applyCustomAttributesOnSpan', error);
        },
        true,
      );
    }
  }

  /**
   * Calls the request hook if defined
   */
  private _callRequestHook(span: Span, request: Request | RequestInit) {
    const requestHook = this.getConfig().requestHook;

    if (requestHook) {
      safeExecuteInTheMiddle(
        () => requestHook(span, request),
        (error) => {
          if (error) {
            this._diag.error('requestHook', error);
          }
        },
        true,
      );
    }
  }

  /**
   * Add headers for the request and the given context if apply
   */
  private _addHeaders(
    options: Request | RequestInit,
    url: string,
    ctx: Context,
  ): void {
    // Propagate only if in request goes to same origin or is in the allow list
    const urlsToPropagate = this.getConfig().propagateTraceHeaderCorsUrls;
    const urlOrigin = parseUrl(url).origin;
    const sameOrigin = location.origin === urlOrigin;
    const shouldPropagate = sameOrigin || matchesUrl(url, urlsToPropagate);

    if (shouldPropagate) {
      if (options instanceof Request) {
        // This mutates `Request.headers` in-place, because it is read-only
        // (per https://developer.mozilla.org/en-US/docs/Web/API/Request/headers),
        // so we cannot (easily) replace it.
        propagation.inject(ctx, options.headers, {
          set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
        });
      } else {
        // Otherwise, create a new Headers to avoid mutating the caller's
        // possibly re-used headers.
        const headers = new Headers(options.headers);
        propagation.inject(ctx, headers, {
          set: (h, k, v) => h.set(k, typeof v === 'string' ? v : String(v)),
        });
        options.headers = headers;
      }
    } else {
      const headers: Partial<Record<string, unknown>> = {};
      propagation.inject(ctx, headers);
      if (Object.keys(headers).length > 0) {
        this._diag.debug('headers inject skipped due to CORS policy');
      }
    }
  }
}
