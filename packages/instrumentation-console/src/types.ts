/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
