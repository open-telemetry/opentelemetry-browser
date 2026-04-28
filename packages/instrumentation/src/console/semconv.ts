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
 * Event name for console log events.
 */
export const CONSOLE_LOG_EVENT_NAME = 'browser.console';

/**
 * The console method that was called (e.g., 'log', 'warn', 'error', 'info', 'debug').
 * @example 'error'
 */
export const ATTR_CONSOLE_METHOD = 'browser.console.method';
