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

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_TYPE = 'navigation.type';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_URL = 'navigation.url';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DURATION = 'navigation.duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_COMPLETE = 'navigation.dom_complete';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_END =
  'navigation.dom_content_loaded_event_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_CONTENT_LOADED_EVENT_START =
  'navigation.dom_content_loaded_event_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOM_INTERACTIVE = 'navigation.dom_interactive';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_LOAD_EVENT_END = 'navigation.load_event_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_LOAD_EVENT_START = 'navigation.load_event_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_REDIRECT_COUNT = 'navigation.redirect_count';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_UNLOAD_EVENT_END = 'navigation.unload_event_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_UNLOAD_EVENT_START =
  'navigation.unload_event_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_FETCH_START = 'navigation.fetch_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOMAIN_LOOKUP_START =
  'navigation.domain_lookup_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DOMAIN_LOOKUP_END = 'navigation.domain_lookup_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_CONNECT_START = 'navigation.connect_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_CONNECT_END = 'navigation.connect_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_SECURE_CONNECTION_START =
  'navigation.secure_connection_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_REQUEST_START = 'navigation.request_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_RESPONSE_START = 'navigation.response_start';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_RESPONSE_END = 'navigation.response_end';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_TRANSFER_SIZE = 'navigation.transfer_size';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_ENCODED_BODY_SIZE = 'navigation.encoded_body_size';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_NAVIGATION_DECODED_BODY_SIZE = 'navigation.decoded_body_size';
