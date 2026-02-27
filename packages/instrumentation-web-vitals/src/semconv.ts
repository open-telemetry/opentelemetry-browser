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
