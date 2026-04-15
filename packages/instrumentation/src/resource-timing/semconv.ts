/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 *
 * Timing attributes follow the unified HTTP client network timing conventions
 * from https://github.com/open-telemetry/semantic-conventions/issues/3385
 *
 * The constants are exported under two names:
 *   1. The canonical semconv name (e.g. ATTR_HTTP_CALL_START_TIME)
 *   2. A descriptive alias that maps to the PerformanceResourceTiming API
 *      field (e.g. ATTR_RESOURCE_FETCH_START) — used in instrumentation code
 *      for readability.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

/**
 * Event name for resource timing
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const RESOURCE_TIMING_EVENT_NAME = 'browser.resource_timing';

// ---------------------------------------------------------------------------
// Timing attributes (unified HTTP client network timing conventions)
//
// `http.call.start_time` is an absolute timestamp (ms since epoch).
// All other timing attributes are deltas from `http.call.start_time`.
// Browser API values of 0 mean the phase did not occur — the attribute
// SHOULD be omitted.
// ---------------------------------------------------------------------------

/**
 * Absolute timestamp (ms since epoch) when the resource fetch started.
 * Maps to: performance.timeOrigin + PerformanceResourceTiming.fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_CALL_START_TIME = 'http.call.start_time';
export const ATTR_RESOURCE_FETCH_START = ATTR_HTTP_CALL_START_TIME;

/**
 * Delta (ms) from http.call.start_time to when the response finished.
 * Maps to: PerformanceResourceTiming.responseEnd - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_CALL_END_TIME = 'http.call.end_time';
export const ATTR_RESOURCE_RESPONSE_END = ATTR_HTTP_CALL_END_TIME;

/**
 * Total duration of the resource load (in milliseconds).
 * Maps to: PerformanceResourceTiming.duration
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_CALL_DURATION = 'http.call.duration';
export const ATTR_RESOURCE_DURATION = ATTR_HTTP_CALL_DURATION;

/**
 * Delta (ms) from http.call.start_time to redirect start.
 * Omit if 0 (no redirect). Browser only.
 * Maps to: PerformanceResourceTiming.redirectStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_REDIRECT_START_TIME = 'http.redirect.start_time';
export const ATTR_RESOURCE_REDIRECT_START = ATTR_HTTP_REDIRECT_START_TIME;

/**
 * Delta (ms) from http.call.start_time to redirect end.
 * Omit if 0 (no redirect). Browser only.
 * Maps to: PerformanceResourceTiming.redirectEnd - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_REDIRECT_END_TIME = 'http.redirect.end_time';
export const ATTR_RESOURCE_REDIRECT_END = ATTR_HTTP_REDIRECT_END_TIME;

/**
 * Delta (ms) from http.call.start_time to domain lookup start.
 * Omit if 0 (reused connection).
 * Maps to: PerformanceResourceTiming.domainLookupStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_DNS_START_TIME = 'http.dns.start_time';
export const ATTR_RESOURCE_DOMAIN_LOOKUP_START = ATTR_HTTP_DNS_START_TIME;

/**
 * Delta (ms) from http.call.start_time to domain lookup end.
 * Maps to: PerformanceResourceTiming.domainLookupEnd - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_DNS_END_TIME = 'http.dns.end_time';
export const ATTR_RESOURCE_DOMAIN_LOOKUP_END = ATTR_HTTP_DNS_END_TIME;

/**
 * Delta (ms) from http.call.start_time to connection start.
 * Maps to: PerformanceResourceTiming.connectStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_CONNECT_START_TIME = 'http.connect.start_time';
export const ATTR_RESOURCE_CONNECT_START = ATTR_HTTP_CONNECT_START_TIME;

/**
 * Delta (ms) from http.call.start_time to connection end.
 * Maps to: PerformanceResourceTiming.connectEnd - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_CONNECT_END_TIME = 'http.connect.end_time';
export const ATTR_RESOURCE_CONNECT_END = ATTR_HTTP_CONNECT_END_TIME;

/**
 * Delta (ms) from http.call.start_time to secure connection start.
 * HTTPS only, omit if 0.
 * Maps to: PerformanceResourceTiming.secureConnectionStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_SECURE_CONNECT_START_TIME =
  'http.secure_connect.start_time';
export const ATTR_RESOURCE_SECURE_CONNECTION_START =
  ATTR_HTTP_SECURE_CONNECT_START_TIME;

/**
 * Delta (ms) from http.call.start_time to request start.
 * Maps to: PerformanceResourceTiming.requestStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_REQUEST_HEADERS_START_TIME =
  'http.request.headers.start_time';
export const ATTR_RESOURCE_REQUEST_START = ATTR_HTTP_REQUEST_HEADERS_START_TIME;

/**
 * Delta (ms) from http.call.start_time to response start (first byte / TTFB).
 * Maps to: PerformanceResourceTiming.responseStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_RESPONSE_HEADERS_START_TIME =
  'http.response.headers.start_time';
export const ATTR_RESOURCE_RESPONSE_START =
  ATTR_HTTP_RESPONSE_HEADERS_START_TIME;

/**
 * Delta (ms) from http.call.start_time to service worker start.
 * Omit if 0 (no service worker). Browser only.
 * Maps to: PerformanceResourceTiming.workerStart - fetchStart
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_WORKER_START_TIME = 'http.worker.start_time';
export const ATTR_RESOURCE_WORKER_START = ATTR_HTTP_WORKER_START_TIME;

// ---------------------------------------------------------------------------
// Size attributes
// ---------------------------------------------------------------------------

/**
 * Transfer size in bytes (including headers).
 * Maps to: PerformanceResourceTiming.transferSize
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_RESPONSE_SIZE = 'http.response.size';
export const ATTR_RESOURCE_TRANSFER_SIZE = ATTR_HTTP_RESPONSE_SIZE;

/**
 * Encoded body size in bytes (compressed / as transferred over the network).
 * Maps to: PerformanceResourceTiming.encodedBodySize
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_RESPONSE_BODY_ENCODED_SIZE =
  'http.response.body.encoded_size';
export const ATTR_RESOURCE_ENCODED_BODY_SIZE =
  ATTR_HTTP_RESPONSE_BODY_ENCODED_SIZE;

/**
 * Decoded body size in bytes (uncompressed / after content decoding).
 * Maps to: PerformanceResourceTiming.decodedBodySize
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_RESPONSE_BODY_DECODED_SIZE =
  'http.response.body.decoded_size';
export const ATTR_RESOURCE_DECODED_BODY_SIZE =
  ATTR_HTTP_RESPONSE_BODY_DECODED_SIZE;

// ---------------------------------------------------------------------------
// Resource metadata attributes
// ---------------------------------------------------------------------------

/**
 * The full URL of the resource.
 * Maps to: PerformanceResourceTiming.name
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_URL_FULL = 'url.full';
export const ATTR_RESOURCE_URL = ATTR_URL_FULL;

/**
 * Network protocol name (e.g. "h2", "http").
 * Parsed from: PerformanceResourceTiming.nextHopProtocol
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NETWORK_PROTOCOL_NAME = 'network.protocol.name';

/**
 * Network protocol version (e.g. "1.1", "2").
 * Parsed from: PerformanceResourceTiming.nextHopProtocol
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NETWORK_PROTOCOL_VERSION = 'network.protocol.version';

/**
 * The type of resource (script, stylesheet, img, xmlhttprequest, fetch, etc.)
 * Browser-specific attribute.
 * Maps to: PerformanceResourceTiming.initiatorType
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_INITIATOR_TYPE = 'browser.resource.initiator_type';

/**
 * Content type of the response.
 * Maps to: PerformanceResourceTiming.contentType
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_HTTP_RESPONSE_HEADER_CONTENT_TYPE =
  'http.response.header.content-type';
export const ATTR_RESOURCE_CONTENT_TYPE = ATTR_HTTP_RESPONSE_HEADER_CONTENT_TYPE;

/**
 * Render blocking status (blocking, non-blocking).
 * Browser-specific attribute. Chromium only as of March 2026.
 * Maps to: PerformanceResourceTiming.renderBlockingStatus
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_RENDER_BLOCKING_STATUS =
  'browser.resource.render_blocking_status';
