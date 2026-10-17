/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Console methods that can be instrumented.
 */
export type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';

/**
 * ConsoleInstrumentation Configuration
 */
export interface ConsoleInstrumentationConfig {
  /**
   * Console methods to instrument.
   * @default ['log', 'warn', 'error', 'info', 'debug']
   */
  logMethods?: ConsoleMethod[];

  /**
   * Custom serializer for console arguments.
   * @default Joins args as strings
   */
  messageSerializer?: (args: unknown[]) => string;
}
