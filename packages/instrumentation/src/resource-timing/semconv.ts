/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

/**
 * Event name for resource timing
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const RESOURCE_TIMING_EVENT_NAME = 'browser.resource_timing';

// Resource timing attributes

/**
 * The URL of the resource
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_URL = 'url.full';

/**
 * The type of resource (script, stylesheet, img, xmlhttprequest, fetch, etc.)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_INITIATOR_TYPE =
  'browser.resource_timing.initiator_type';

/**
 * Total duration of the resource load (in milliseconds)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_DURATION = 'browser.resource_timing.duration';

/**
 * Start time of the resource fetch (relative to navigation start)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_FETCH_START = 'browser.resource_timing.fetch_start';

/**
 * Domain lookup start time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_DOMAIN_LOOKUP_START =
  'browser.resource_timing.domain_lookup_start';

/**
 * Domain lookup end time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_DOMAIN_LOOKUP_END =
  'browser.resource_timing.domain_lookup_end';

/**
 * Connection start time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_CONNECT_START =
  'browser.resource_timing.connect_start';

/**
 * Connection end time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_CONNECT_END = 'browser.resource_timing.connect_end';

/**
 * Secure connection start time (HTTPS)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_SECURE_CONNECTION_START =
  'browser.resource_timing.secure_connection_start';

/**
 * Request start time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_REQUEST_START =
  'browser.resource_timing.request_start';

/**
 * Response start time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_RESPONSE_START =
  'browser.resource_timing.response_start';

/**
 * Response end time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_RESPONSE_END =
  'browser.resource_timing.response_end';

/**
 * Transfer size in bytes (including headers)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_TRANSFER_SIZE =
  'browser.resource_timing.transfer_size';

/**
 * Encoded body size in bytes (compressed)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_ENCODED_BODY_SIZE =
  'browser.resource_timing.encoded_body_size';

/**
 * Decoded body size in bytes (uncompressed)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_DECODED_BODY_SIZE =
  'browser.resource_timing.decoded_body_size';

/**
 * Redirect start time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_REDIRECT_START =
  'browser.resource_timing.redirect_start';

/**
 * Redirect end time
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_REDIRECT_END =
  'browser.resource_timing.redirect_end';

/**
 * Worker start time (for Service Worker interception)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_WORKER_START =
  'browser.resource_timing.worker_start';

/**
 * Next hop protocol (h2, h3, http/1.1, etc.)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_NEXT_HOP_PROTOCOL =
  'browser.resource_timing.next_hop_protocol';

/**
 * Render blocking status (blocking, non-blocking)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_RESOURCE_RENDER_BLOCKING_STATUS =
  'browser.resource_timing.render_blocking_status';
