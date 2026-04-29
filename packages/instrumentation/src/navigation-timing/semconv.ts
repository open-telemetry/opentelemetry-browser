/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

export const NAVIGATION_TIMING_EVENT_NAME = 'browser.navigation_timing';

// Navigation-specific attributes (from PerformanceNavigationTiming).

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_TYPE = 'browser.navigation_timing.type';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_URL = 'url.full';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_COMPLETE =
  'browser.navigation_timing.dom_complete';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_END =
  'browser.navigation_timing.dom_content_loaded_event_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_START =
  'browser.navigation_timing.dom_content_loaded_event_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_INTERACTIVE =
  'browser.navigation_timing.dom_interactive';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_LOAD_EVENT_END =
  'browser.navigation_timing.load_event_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_LOAD_EVENT_START =
  'browser.navigation_timing.load_event_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_REDIRECT_COUNT =
  'browser.navigation_timing.redirect_count';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_UNLOAD_EVENT_END =
  'browser.navigation_timing.unload_event_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_UNLOAD_EVENT_START =
  'browser.navigation_timing.unload_event_start';

// Shared timing attributes inherited from PerformanceResourceTiming.
// PerformanceNavigationTiming extends PerformanceResourceTiming, so these
// values mirror resource timing. TODO: extract to a shared module to avoid
// duplication.

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DURATION = 'browser.resource_timing.duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_FETCH_START =
  'browser.resource_timing.fetch_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOMAIN_LOOKUP_START =
  'browser.resource_timing.domain_lookup_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOMAIN_LOOKUP_END =
  'browser.resource_timing.domain_lookup_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_CONNECT_START =
  'browser.resource_timing.connect_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_CONNECT_END =
  'browser.resource_timing.connect_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_SECURE_CONNECTION_START =
  'browser.resource_timing.secure_connection_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_REQUEST_START =
  'browser.resource_timing.request_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_RESPONSE_START =
  'browser.resource_timing.response_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_RESPONSE_END =
  'browser.resource_timing.response_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_TRANSFER_SIZE =
  'browser.resource_timing.transfer_size';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_ENCODED_BODY_SIZE =
  'browser.resource_timing.encoded_body_size';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DECODED_BODY_SIZE =
  'browser.resource_timing.decoded_body_size';
