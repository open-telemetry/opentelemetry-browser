/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

export const BROWSER_NAVIGATION_EVENT_NAME = 'browser.navigation';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_URL_FULL = 'url.full';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT =
  'browser.navigation.same_document';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_BROWSER_NAVIGATION_HASH_CHANGE =
  'browser.navigation.hash_change';

/**
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_BROWSER_NAVIGATION_TYPE = 'browser.navigation.type';
