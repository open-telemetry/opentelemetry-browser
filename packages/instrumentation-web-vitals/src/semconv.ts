/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

export const WEB_VITAL_EVENT_NAME = 'browser.web_vital';

// Core metric attributes

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_NAME = 'browser.web_vital.name';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_VALUE = 'browser.web_vital.value';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_RATING = 'browser.web_vital.rating';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_DELTA = 'browser.web_vital.delta';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ID = 'browser.web_vital.id';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_NAVIGATION_TYPE =
  'browser.web_vital.navigation_type';

// CLS attribution

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LARGEST_SHIFT_TARGET =
  'browser.web_vital.attribution.largest_shift_target';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LARGEST_SHIFT_VALUE =
  'browser.web_vital.attribution.largest_shift_value';

// INP attribution

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET =
  'browser.web_vital.attribution.interaction_target';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE =
  'browser.web_vital.attribution.interaction_type';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY =
  'browser.web_vital.attribution.input_delay';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION =
  'browser.web_vital.attribution.processing_duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY =
  'browser.web_vital.attribution.presentation_delay';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME =
  'browser.web_vital.attribution.next_paint_time';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE =
  'browser.web_vital.attribution.load_state';

// LCP attribution

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_TARGET =
  'browser.web_vital.attribution.target';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_URL =
  'browser.web_vital.attribution.url';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_TIME_TO_FIRST_BYTE =
  'browser.web_vital.attribution.time_to_first_byte';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_RESOURCE_LOAD_DELAY =
  'browser.web_vital.attribution.resource_load_delay';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_RESOURCE_LOAD_DURATION =
  'browser.web_vital.attribution.resource_load_duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_ELEMENT_RENDER_DELAY =
  'browser.web_vital.attribution.element_render_delay';

// FCP attribution

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_FIRST_BYTE_TO_FCP =
  'browser.web_vital.attribution.first_byte_to_fcp';

// TTFB attribution

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_WAITING_DURATION =
  'browser.web_vital.attribution.waiting_duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_CACHE_DURATION =
  'browser.web_vital.attribution.cache_duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_DNS_DURATION =
  'browser.web_vital.attribution.dns_duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_CONNECTION_DURATION =
  'browser.web_vital.attribution.connection_duration';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_REQUEST_DURATION =
  'browser.web_vital.attribution.request_duration';
