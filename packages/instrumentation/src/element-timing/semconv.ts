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
 * The lower-cased tag name of the observed element (e.g. "img", "p").
 * Omitted when the element left the document before the entry was processed.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_ELEMENT = 'browser.element_timing.element';

/**
 * The time the element was rendered (relative to navigation start).
 * Cross-origin images without a `Timing-Allow-Origin` header report 0 in older
 * browsers and a 4ms-coarsened value in newer ones, so prefer `start_time`.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_RENDER_TIME =
  'browser.element_timing.render_time';

/**
 * The time the resource for the element finished loading (relative to navigation start).
 * Only emitted for image elements.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_LOAD_TIME = 'browser.element_timing.load_time';

/**
 * `renderTime` when it is non-zero, otherwise `loadTime` (relative to navigation start).
 * Always populated, so this is the value to chart when `render_time` may be 0.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_START_TIME =
  'browser.element_timing.start_time';

/**
 * The URL of the image resource. Only emitted for image elements.
 * Mirrors the stable upstream `ATTR_URL_FULL`, defined locally to match the
 * sibling instrumentations rather than for stability reasons.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_URL = 'url.full';

/**
 * The intrinsic width of the image in CSS pixels. Only emitted for image elements.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_NATURAL_WIDTH =
  'browser.element_timing.natural_width';

/**
 * The intrinsic height of the image in CSS pixels. Only emitted for image elements.
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_ELEMENT_TIMING_NATURAL_HEIGHT =
  'browser.element_timing.natural_height';
