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
 * Event name for element timing
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ELEMENT_TIMING_EVENT_NAME = 'browser.element_timing';

// Element timing attributes

/**
 * The `elementtiming` attribute value identifying the observed element
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_IDENTIFIER =
  'browser.element_timing.identifier';

/**
 * The lower-cased tag name of the observed element (e.g. "img", "p")
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_ELEMENT = 'browser.element_timing.element';

/**
 * The time the element was rendered (relative to navigation start)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_RENDER_TIME =
  'browser.element_timing.render_time';

/**
 * The time the resource for the element finished loading (relative to navigation start).
 * Only set for image elements; 0 for text elements.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_LOAD_TIME = 'browser.element_timing.load_time';

/**
 * `renderTime` if available, otherwise `loadTime` (relative to navigation start)
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_START_TIME =
  'browser.element_timing.start_time';

/**
 * The URL of the image resource, empty for text elements
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_URL = 'url.full';

/**
 * The intrinsic width of the image in CSS pixels
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_NATURAL_WIDTH =
  'browser.element_timing.natural_width';

/**
 * The intrinsic height of the image in CSS pixels
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_NATURAL_HEIGHT =
  'browser.element_timing.natural_height';
