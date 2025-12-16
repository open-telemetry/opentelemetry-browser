/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This file contains a copy of unstable semantic convention definitions
 * used by this package.
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/main/semantic-conventions#unstable-semconv
 */

export const CLICK_EVENT_NAME = 'browser.user_action.click';

/**
 * @example left
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_MOUSE_EVENT_BUTTON = 'browser.mouse_event.button';

/**
 * @example 10
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_PAGE_X = 'browser.page.x';

/**
 * @example 10
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_PAGE_Y = 'browser.page.y';

/**
 * @example "BUTTON"
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_TAG_NAME = 'browser.tag_name';

/**
 * @example {"id": "123", "name": "Name"}
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_TAGS = 'browser.element.attributes';

/**
 * @example "#main > div:nth-child(2) > button.submit"
 *
 * @experimental This attribute is experimental and is subject to breaking changes in minor releases of `@opentelemetry/semantic-conventions`.
 */
export const ATTR_CSS_SELECTOR = 'browser.css_selector';
