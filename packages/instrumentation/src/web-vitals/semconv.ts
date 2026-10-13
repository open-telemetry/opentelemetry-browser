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

// Experimental INP attribution names, pending semantic convention agreement.
// https://github.com/open-telemetry/semantic-conventions-client-side/pull/14

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET =
  'browser.web_vital.attribution.interaction_target';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE =
  'browser.web_vital.attribution.interaction_type';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY =
  'browser.web_vital.attribution.input_delay';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION =
  'browser.web_vital.attribution.processing_duration';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY =
  'browser.web_vital.attribution.presentation_delay';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME =
  'browser.web_vital.attribution.next_paint_time';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE =
  'browser.web_vital.attribution.load_state';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER =
  'browser.web_vital.attribution.longest_script.invoker';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL =
  'browser.web_vital.attribution.longest_script.source_url';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_FUNCTION_NAME =
  'browser.web_vital.attribution.longest_script.source_function_name';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_DURATION =
  'browser.web_vital.attribution.longest_script.duration';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SUBPART =
  'browser.web_vital.attribution.longest_script.subpart';

/**
 * @experimental This attribute is experimental and is subject to change pending semantic convention agreement.
 */
export const ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INTERSECTING_DURATION =
  'browser.web_vital.attribution.longest_script.intersecting_duration';
