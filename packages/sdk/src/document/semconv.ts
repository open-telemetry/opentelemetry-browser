/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The full URL of the document in which the telemetry was produced.
 *
 * This is distinct from `url.full`, which on browser telemetry describes what
 * the event itself is about: the navigated-to URL on `browser.navigation`, the
 * loaded resource on `browser.resource_timing`, the request target on fetch and
 * XHR spans. `browser.document.url.full` always identifies the page the user
 * was on when the telemetry was produced.
 *
 * @example "https://example.com/checkout?step=2"
 */
export const ATTR_BROWSER_DOCUMENT_URL_FULL =
  'browser.document.url.full' as const;
