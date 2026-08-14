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
  getXHRBodyLength,
  normalizeHttpRequestMethod,
} from '../utils/request.ts';
import { matchesUrl, parseUrl, serverPortFromUrl } from '../utils/url.ts';
import { ATTR_HTTP_REQUEST_BODY_SIZE } from './semconv.ts';
import type { XhrInstrumentationConfig } from './types.ts';

type XhrOpenFunction = typeof XMLHttpRequest.prototype.open;
type XhrSendFunction = typeof XMLHttpRequest.prototype.send;
type XhrEventName = 'abort' | 'timeout' | 'error' | 'load';

export class XhrInstrumentation extends InstrumentationBase<XhrInstrumentationConfig> {
  // Note: Intentionally *not* using `_enabled` as the field name to avoid
  // any possible confusion with the `_enabled` field used on the *Node.js*
  // InstrumentationBase class.
  // Also not initializing the fields to `false` because the base class
  // constructor already call `enable` modifying their values and it will
  // set the instrumentaitons in a base state (enabled, patched but with flags set to false)
  private declare _isEnabled: boolean;
  private declare _isXhrPatched: boolean;

  // To keep references to span/xhr tuples across XHR events
  private _xhrSpanMap: WeakMap<
    XMLHttpRequest,
    { span: Span; url: string; start: number }
  > = new WeakMap();

  constructor(config: XhrInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/xhr', version, config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._isEnabled) {
      return;
    }

    if (this._isXhrPatched) {
      this._diag.debug('XMLHttpRequest prototype already patched');
      this._isEnabled = true;
      return;
    }

    try {
      // `_wrap` throws if a third-party script has locked globalThis.fetch via
      // Object.defineProperty(XMLHttpRequest.prototype, 'open', { writable: false, ... }).
      this._wrap(XMLHttpRequest.prototype, 'open', this._patchOpen());
      this._wrap(XMLHttpRequest.prototype, 'send', this._patchSend());
      this._isXhrPatched = true;
      this._isEnabled = true;
    } catch (err) {
      // make sure there is no wrapped functions
      this._unwrap(XMLHttpRequest.prototype, 'open');
      this._unwrap(XMLHttpRequest.prototype, 'send');
      this._diag.warn(
        'Failed to patch XMLHttpRequest.prototype methods; instrumentation will not be enabled. ' +
          'Another script may have locked XMLHttpRequest.prototype methods via Object.defineProperty.',
        err,
      );
    }
  }

  override disable(): void {
    if (!this._isEnabled) {
      return;
    }
    this._isEnabled = false;
  }

  /**
   * Patches the constructor of fetch
   */
  private _patchOpen(): (original: XhrOpenFunction) => XhrOpenFunction {
    return (original) => {
      const instrumentation = this;

      return function patchedOpen(
        this: XMLHttpRequest,
        ...args: Parameters<XhrOpenFunction>
      ): ReturnType<XhrOpenFunction> {
        if (!instrumentation._isEnabled) {
          return original.apply(this, args);
        }
        try {
          const method = args[0];
          const url =
            typeof args[1] === 'string' ? args[1] : args[1].toString();
          const shouldIgnoreUrl = matchesUrl(
            url,
            instrumentation.getConfig().ignoreUrls,
          );
          if (shouldIgnoreUrl) {
            return original.apply(this, args);
          }

          const span = instrumentation._createSpan(url, method);
          instrumentation._xhrSpanMap.set(this, {
            span,
            url,
            start: performance.now(),
          });
        } catch (e: unknown) {
          instrumentation._diag.error(
            'Failed to instrument XmlHttpRequest.open',
            e,
          );
        }
        return original.apply(this, args);
      } as XhrOpenFunction;
    };
  }

  /**
   * Patches the constructor of fetch
   */
  private _patchSend(): (original: XhrSendFunction) => XhrSendFunction {
    return (original) => {
      const instrumentation = this;

      return function patchedSend(
        this: XMLHttpRequest,
        ...args: Parameters<XhrSendFunction>
      ): ReturnType<XhrSendFunction> {
        if (!instrumentation._isEnabled) {
          return original.apply(this, args);
        }

        const spanDetails = instrumentation._xhrSpanMap.get(this);
        if (spanDetails) {
          try {
            const { span, url } = spanDetails;

            if (instrumentation.getConfig().measureRequestSize && args?.[0]) {
              const bodyLength = getXHRBodyLength(args[0]);
              if (bodyLength) {
                span.setAttribute(ATTR_HTTP_REQUEST_BODY_SIZE, bodyLength);
              }
            }

            const onXhrEvent = (eventName: XhrEventName) => {
              instrumentation._endSpan(this, eventName);
            };

            const xhrContext = trace.setSpan(context.active(), span);
            context.with(xhrContext, () => {
              this.addEventListener('abort', () => onXhrEvent('abort'));
              this.addEventListener('error', () => onXhrEvent('error'));
              this.addEventListener('timeout', () => onXhrEvent('timeout'));
              this.addEventListener('load', () => onXhrEvent('load'));
              instrumentation._addHeaders(this, url, xhrContext);
            });
          } catch (e: unknown) {
            // failed to instrument request, remove span
            instrumentation._diag.error(
              'Failed to instrument fetch request',
              e,
            );
            instrumentation._xhrSpanMap.delete(this);
          }
        }
        return original.apply(this, args);
      } as XhrSendFunction;
    };
  }

  /**
   * Creates a new span when method "open" is called
   */
  private _createSpan(url: string, method: string): Span {
    const parsedUrl = parseUrl(url);
    const origMethod = method;
    const normMethod = normalizeHttpRequestMethod(method);
    const attributes = {} as Attributes;
    const { sanitizeUrl } = this.getConfig();

    attributes[ATTR_HTTP_REQUEST_METHOD] = normMethod;
    if (normMethod !== origMethod) {
      attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = origMethod;
    }
    attributes[ATTR_URL_FULL] = sanitizeUrl ? sanitizeUrl(url) : url;
    attributes[ATTR_SERVER_ADDRESS] = parsedUrl.hostname;
    const serverPort = serverPortFromUrl(parsedUrl);
    if (serverPort) {
      attributes[ATTR_SERVER_PORT] = serverPort;
    }

    return this.tracer.startSpan(normMethod, {
      kind: SpanKind.CLIENT,
      attributes,
    });
  }

  /**
   * Finish span, add attributes, network events etc.
   */
  private _endSpan(xhr: XMLHttpRequest, eventName: XhrEventName) {
    const spanDetails = this._xhrSpanMap.get(xhr);

    if (spanDetails) {
      const { span, url, start } = spanDetails;

      // Status code only has a meaningful value if request got a response
      if (eventName === 'load') {
        span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, xhr.status);
      }

      if (eventName !== 'abort') {
        // https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status
        // 1xx/2xx/3xx MUST be left unset UNLESS there was another error (e.g. a
        // network error receiving the response body)
        const isErrorStatus =
          xhr.status >= 400 || eventName === 'error' || eventName === 'timeout';

        if (isErrorStatus) {
          span.setStatus({ code: SpanStatusCode.ERROR });
          const errorType =
            xhr.status >= 400
              ? String(xhr.status)
              : eventName === 'error'
                ? 'Error'
                : 'TimeoutError';
          span.setAttribute(ATTR_ERROR_TYPE, errorType);
        }
      }

      this._xhrSpanMap.delete(xhr);
      this._applyAttributesAfterSend(span, xhr);
      span.end();

      getNetworkContextRegistry().register(span, {
        key: url,
        startPerfNow: start,
        endPerfNow: performance.now(),
      });
    }
  }

  /**
   * Runs the user provided `applyCustomAttributesOnSpan` function
   */
  private _applyAttributesAfterSend(span: Span, xhr: XMLHttpRequest) {
    const applyCustomAttributesOnSpan =
      this.getConfig().applyCustomAttributesOnSpan;
    if (applyCustomAttributesOnSpan) {
      safeExecuteInTheMiddle(
        () => applyCustomAttributesOnSpan(span, xhr),
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
   * Adds custom headers to XMLHttpRequest
   */
  private _addHeaders(xhr: XMLHttpRequest, url: string, ctx: Context) {
    // Propagate only if in request goes to same origin or is in the allow list
    const urlsToPropagate = this.getConfig().propagateTraceHeaderCorsUrls;
    const urlOrigin = parseUrl(url).origin;
    const sameOrigin = location.origin === urlOrigin;
    const shouldPropagate = sameOrigin || matchesUrl(url, urlsToPropagate);

    if (shouldPropagate) {
      propagation.inject(ctx, xhr, {
        set: (x, k, v) => {
          x.setRequestHeader(k, typeof v === 'string' ? v : String(v));
        },
      });
    } else {
      const headers: Partial<Record<string, unknown>> = {};
      propagation.inject(ctx, headers);
      propagation.inject(ctx, headers, {
        set: (h, k, v) => {
          h[k] = v;
        },
      });
      if (Object.keys(headers).length > 0) {
        this._diag.debug('headers inject skipped due to CORS policy');
      }
    }
  }
}
