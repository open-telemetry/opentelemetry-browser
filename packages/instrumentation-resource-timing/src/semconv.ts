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
 */
export const RESOURCE_TIMING_EVENT_NAME = 'browser.resource.timing';

// Resource timing attributes

/**
 * The URL of the resource
 */
export const ATTR_RESOURCE_URL = 'browser.resource.url';

/**
 * The type of resource (script, stylesheet, img, xmlhttprequest, fetch, etc.)
 */
export const ATTR_RESOURCE_INITIATOR_TYPE = 'browser.resource.initiator_type';

/**
 * Total duration of the resource load (in milliseconds)
 */
export const ATTR_RESOURCE_DURATION = 'browser.resource.duration';

/**
 * Start time of the resource fetch (relative to navigation start)
 */
export const ATTR_RESOURCE_FETCH_START = 'browser.resource.fetch_start';

/**
 * Domain lookup start time
 */
export const ATTR_RESOURCE_DOMAIN_LOOKUP_START =
  'browser.resource.domain_lookup_start';

/**
 * Domain lookup end time
 */
export const ATTR_RESOURCE_DOMAIN_LOOKUP_END =
  'browser.resource.domain_lookup_end';

/**
 * Connection start time
 */
export const ATTR_RESOURCE_CONNECT_START = 'browser.resource.connect_start';

/**
 * Connection end time
 */
export const ATTR_RESOURCE_CONNECT_END = 'browser.resource.connect_end';

/**
 * Secure connection start time (HTTPS)
 */
export const ATTR_RESOURCE_SECURE_CONNECTION_START =
  'browser.resource.secure_connection_start';

/**
 * Request start time
 */
export const ATTR_RESOURCE_REQUEST_START = 'browser.resource.request_start';

/**
 * Response start time
 */
export const ATTR_RESOURCE_RESPONSE_START = 'browser.resource.response_start';

/**
 * Response end time
 */
export const ATTR_RESOURCE_RESPONSE_END = 'browser.resource.response_end';

/**
 * Transfer size in bytes (including headers)
 */
export const ATTR_RESOURCE_TRANSFER_SIZE = 'browser.resource.transfer_size';

/**
 * Encoded body size in bytes (compressed)
 */
export const ATTR_RESOURCE_ENCODED_BODY_SIZE =
  'browser.resource.encoded_body_size';

/**
 * Decoded body size in bytes (uncompressed)
 */
export const ATTR_RESOURCE_DECODED_BODY_SIZE =
  'browser.resource.decoded_body_size';

/**
 * Redirect start time
 */
export const ATTR_RESOURCE_REDIRECT_START = 'browser.resource.redirect_start';

/**
 * Redirect end time
 */
export const ATTR_RESOURCE_REDIRECT_END = 'browser.resource.redirect_end';

/**
 * Worker start time (for Service Worker interception)
 */
export const ATTR_RESOURCE_WORKER_START = 'browser.resource.worker_start';

/**
 * Next hop protocol (h2, h3, http/1.1, etc.)
 */
export const ATTR_RESOURCE_NEXT_HOP_PROTOCOL =
  'browser.resource.next_hop_protocol';

/**
 * Render blocking status (blocking, non-blocking)
 */
export const ATTR_RESOURCE_RENDER_BLOCKING_STATUS =
  'browser.resource.render_blocking_status';
