/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import type { CommonConfig } from './types.ts';

type LogLevelName = keyof typeof DiagLogLevel;

// The lowest log level at which each method prints.
const METHOD_LEVELS: [keyof DiagLogger, DiagLogLevel][] = [
  ['error', DiagLogLevel.ERROR],
  ['warn', DiagLogLevel.WARN],
  ['info', DiagLogLevel.INFO],
  ['debug', DiagLogLevel.DEBUG],
  ['verbose', DiagLogLevel.VERBOSE],
];

const defaultLoggers = new Map<DiagLogLevel, DiagLogger>();

function noop() {}

/**
 * Returns a logger that prints the SDK's internal messages at the given level
 * and louder to the console. Calling it again with the same level returns the
 * same instance.
 *
 * @param level possible values are ALL, VERBOSE, DEBUG, INFO, WARN, ERROR,
 * NONE. An unknown value falls back to INFO.
 */
export function getDefaultLogger(level: LogLevelName = 'INFO'): DiagLogger {
  // Although the types will error if user pass a wrong value
  // do a runtime check. If value is wrong fallback to the default level
  // ref: https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/#general-sdk-configuration
  const logLevel =
    typeof DiagLogLevel[level] === 'number'
      ? DiagLogLevel[level]
      : DiagLogLevel.INFO;
  let logger = defaultLoggers.get(logLevel);
  if (!logger) {
    // NOTE: for now we're using the DiagConsoleLogger from the API but we may
    // want to have something that serializes params in a specific format
    const consoleLogger = new DiagConsoleLogger();
    const methods = {} as DiagLogger;
    for (const [name, methodLevel] of METHOD_LEVELS) {
      methods[name] =
        logLevel >= methodLevel
          ? (message, ...args) => consoleLogger[name](message, ...args)
          : noop;
    }
    logger = methods;
    defaultLoggers.set(logLevel, logger);
  }
  return logger;
}

let loggerSet = false;
let logLevelWarned = false;

/**
 * Sets the global logger from the config: the `logger` option, or the
 * default logger for the deprecated `logLevel` option. If called a second
 * time the logger stays as it is.
 *
 * @returns the logger from the config
 */
export function setSdkLogger(config?: CommonConfig): DiagLogger {
  const logger = config?.logger ?? getDefaultLogger(config?.logLevel);
  if (loggerSet) {
    diag.debug('Logger for SDKs already set.');
  } else {
    // The logger decides which messages to print, so diag passes all of them.
    diag.setLogger(logger, { logLevel: DiagLogLevel.ALL });
    loggerSet = true;
  }
  if (config?.logLevel !== undefined && !logLevelWarned) {
    logLevelWarned = true;
    diag.warn(
      `The logLevel option is deprecated. Use logger: getDefaultLogger('${config.logLevel}') instead.`,
    );
  }
  return logger;
}
