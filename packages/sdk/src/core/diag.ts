/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';

/**
 * Sets the global logger with the given log level. A second call keeps the
 * first logger, and warns only when it discards a level the caller asked for
 */
let loggerSet = false;
export function setSdkLogger(level?: keyof typeof DiagLogLevel) {
  if (loggerSet) {
    // Each signal SDK calls this again with no level of its own, so warning
    // unconditionally would fire on every combined start. `warn` and not
    // `debug`: the level being dropped may be the one that would show this
    if (level !== undefined) {
      diag.warn(
        `Logger for SDKs already set. The log level "${level}" is ignored.`,
      );
    }
    return;
  }
  // Although the types will error if user pass a wrong value
  // do a runtime check. If value is wrong fallback to the default level
  // ref: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#general-sdk-configuration
  const resolvedLevel = level ?? 'INFO';
  const logLevel =
    typeof DiagLogLevel[resolvedLevel] === 'number'
      ? DiagLogLevel[resolvedLevel]
      : DiagLogLevel.INFO;
  // NOTE: for now we're using the DiagConsoleLogger from the API but we may
  // want to have something that serializes params in a specific format
  diag.setLogger(new DiagConsoleLogger(), { logLevel });
  loggerSet = true;
}
