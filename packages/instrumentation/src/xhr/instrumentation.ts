/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes, Span, SpanStatus } from '@opentelemetry/api';
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
  // To keep track of the resources for posterior cleanup the context registry
  private _registeredResources: PerformanceResourceTiming[] = [];
  private _unregisterTimer: number | undefined;

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
        const method = args[0];
        const url = typeof args[1] === 'string' ? args[1] : args[1].toString();
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
          const { span, url } = spanDetails;

          if (instrumentation.getConfig().measureRequestSize && args?.[0]) {
            const bodyLength = getXHRBodyLength(args[0]);
            if (bodyLength) {
              span.setAttribute(ATTR_HTTP_REQUEST_BODY_SIZE, bodyLength);
            }
          }

          const onXhrEvent = (isError: boolean, errorType?: string) => {
            instrumentation._endSpan(this, isError, errorType);
          };

          context.with(trace.setSpan(context.active(), span), () => {
            this.addEventListener('abort', () => onXhrEvent(false));
            this.addEventListener('error', () => onXhrEvent(true, 'error'));
            this.addEventListener('load', () => onXhrEvent(false));
            this.addEventListener('timeout', () => onXhrEvent(true, 'timeout'));
            instrumentation._addHeaders(this, url);
          });
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

    attributes[ATTR_HTTP_REQUEST_METHOD] = normMethod;
    if (normMethod !== origMethod) {
      attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = origMethod;
    }
    attributes[ATTR_URL_FULL] = parsedUrl.toString();
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
  private _endSpan(xhr: XMLHttpRequest, isError: boolean, errorType?: string) {
    const spanDetails = this._xhrSpanMap.get(xhr);

    if (spanDetails) {
      const { span, url, start } = spanDetails;
      const { status } = xhr;

      this._xhrSpanMap.delete(xhr);
      this._applyAttributesAfterSend(span, xhr);
      if (isError) {
        const status = { code: SpanStatusCode.ERROR } as SpanStatus;
        if (errorType) {
          status.message = errorType;
          span.setAttribute(ATTR_ERROR_TYPE, errorType);
        }
        span.setStatus(status);
      } else if (status && status >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttribute(ATTR_ERROR_TYPE, String(status));
      }

      // Intentionally exclude status=0, because XHR uses 0 for before a
      // response is received and semconv says to only add the attribute if
      // received a response.
      if (status) {
        span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, status);
      }
      span.end();
      this._registerResource(span, {
        name: url,
        fetchStart: start,
        responseEnd: performance.now(),
      } as PerformanceResourceTiming);
    }
  }

  /**
   * Registers a resource and sets a timer for clearing the registry after a time bing idle
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
      if (this._registeredResources) {
        for (const res of this._registeredResources) {
          registry.unregister(res);
        }
      }
      this._registeredResources.length = 0;
      this._unregisterTimer = undefined;
    }, 1000);
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
  private _addHeaders(xhr: XMLHttpRequest, url: string) {
    // Propagate only if in request goes to same origin or is in the allow list
    const urlsToPropagate = this.getConfig().propagateTraceHeaderCorsUrls;
    const urlOrigin = parseUrl(url).origin;
    const sameOrigin = location.origin === urlOrigin;
    const shouldPropagate = sameOrigin || matchesUrl(url, urlsToPropagate);

    if (shouldPropagate) {
      propagation.inject(context.active(), xhr, {
        set: (x, k, v) => x.setRequestHeader(k, String(v)),
      });
    } else {
      const headers: Partial<Record<string, unknown>> = {};
      propagation.inject(context.active(), headers);
      if (Object.keys(headers).length > 0) {
        this._diag.debug('headers inject skipped due to CORS policy');
      }
    }
  }
}
