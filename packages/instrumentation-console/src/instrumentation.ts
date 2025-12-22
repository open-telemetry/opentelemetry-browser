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

import { trace, context } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { ATTR_CONSOLE_METHOD, CONSOLE_LOG_EVENT_NAME } from './semconv.ts';
import type { ConsoleInstrumentationConfig, ConsoleMethod } from './types.ts';
import { getTraceParent } from './utils.ts';

const DEFAULT_LOG_METHODS: ConsoleMethod[] = [
  'log',
  'warn',
  'error',
  'info',
  'debug',
];

const SEVERITY_MAP: Record<ConsoleMethod, SeverityNumber> = {
  debug: SeverityNumber.DEBUG,
  log: SeverityNumber.INFO,
  info: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
};

/**
 * Default serializer for console arguments.
 * Joins arguments as strings.
 */
function defaultMessageSerializer(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          // Circular reference or other error, fallback to String
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

/**
 * OpenTelemetry instrumentation that captures console calls and emits them as OpenTelemetry logs.
 */
export class ConsoleInstrumentation extends InstrumentationBase<ConsoleInstrumentationConfig> {
  constructor(config: ConsoleInstrumentationConfig = {}) {
    super('@opentelemetry/instrumentation-console', '0.1.0', config);
  }

  protected override init() {
    return [];
  }

  private _getMessageSerializer(): (args: unknown[]) => string {
    return this._config.messageSerializer ?? defaultMessageSerializer;
  }

  private _getLogMethods(): ConsoleMethod[] {
    return this._config.logMethods ?? DEFAULT_LOG_METHODS;
  }

  private _patchConsoleMethod(
    method: ConsoleMethod,
  ): (original: Console[ConsoleMethod]) => Console[ConsoleMethod] {
    const instrumentation = this;
    // Get the page-level traceparent for fallback
    const pageTraceParent = getTraceParent();
    const serializer = instrumentation._getMessageSerializer();

    return function patchConsoleMethod(original: Console[ConsoleMethod]) {
      return function (this: Console, ...args: unknown[]) {
        // Get the active span context at call time, fallback to page traceparent
        const activeSpan = trace.getSpan(context.active());
        const spanContext = activeSpan?.spanContext() ?? pageTraceParent;
        const body = serializer(args);

        instrumentation.logger.emit({
          body,
          eventName: CONSOLE_LOG_EVENT_NAME,
          severityNumber: SEVERITY_MAP[method],
          severityText: method,
          attributes: {
            [ATTR_CONSOLE_METHOD]: method,
            ...(spanContext && {
              'trace.id': spanContext.traceId,
              'span.id': spanContext.spanId,
            }),
          },
        });

        return original.apply(this, args);
      } as Console[ConsoleMethod];
    };
  }

  override enable(): void {
    const methods = this._getLogMethods();
    for (const method of methods) {
      if (typeof console[method] === 'function') {
        this._wrap(console, method, this._patchConsoleMethod(method));
      }
    }
  }

  override disable(): void {
    const methods = this._getLogMethods();
    for (const method of methods) {
      this._unwrap(console, method);
    }
  }
}
