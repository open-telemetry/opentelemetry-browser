/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InstrumentationConfig } from '@opentelemetry/instrumentation';

/**
 * Console methods that can be instrumented.
 */
export type ConsoleMethod = 'log' | 'warn' | 'error' | 'info' | 'debug';

/**
 * ConsoleInstrumentation Configuration
 */
export interface ConsoleInstrumentationConfig extends InstrumentationConfig {
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
