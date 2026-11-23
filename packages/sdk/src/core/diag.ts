/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { isDiagRegistered } from './isDiagRegistered.ts';

/**
 * Sets the global logger with the given log level if none is registered.
 * Once the SDK sets a logger, later calls are a noop.
 */
let loggerSet = false;
export function setSdkLogger(level: keyof typeof DiagLogLevel = 'INFO') {
  if (loggerSet) {
    diag.debug('Logger for SDKs already set.');
    return;
  }
  if (isDiagRegistered()) {
    return;
  }
  // Although the types will error if user pass a wrong value
  // do a runtime check. If value is wrong fallback to the default level
  // ref: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#general-sdk-configuration
  const logLevel =
    typeof DiagLogLevel[level] === 'number'
      ? DiagLogLevel[level]
      : DiagLogLevel.INFO;
  // NOTE: for now we're using the DiagConsoleLogger from the API but we may
  // want to have something that serializes params in a specific format
  diag.setLogger(new DiagConsoleLogger(), { logLevel });
  loggerSet = true;
}
