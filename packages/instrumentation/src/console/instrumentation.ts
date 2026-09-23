/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { InstrumentationBase } from '#instrumentation-base';
import { version } from '../../package.json' with { type: 'json' };
import { ATTR_CONSOLE_METHOD, CONSOLE_LOG_EVENT_NAME } from './semconv.ts';
import type { ConsoleInstrumentationConfig, ConsoleMethod } from './types.ts';

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
          return safeString(arg);
        }
      }
      return safeString(arg);
    })
    .join(' ');
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    // `String()` throws on values like `Object.create(null)`.
    return Object.prototype.toString.call(value);
  }
}

/**
 * OpenTelemetry instrumentation that captures console calls and emits them as OpenTelemetry logs.
 */
export class ConsoleInstrumentation extends InstrumentationBase<ConsoleInstrumentationConfig> {
  // Console calls made while recording one (a console-backed diag logger, an
  // exporter that logs) are not recorded, or a failure could recurse forever.
  private _isRecording = false;

  constructor(config: ConsoleInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/console', version, config);
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

    return function patchConsoleMethod(original: Console[ConsoleMethod]) {
      return function (this: Console, ...args: unknown[]) {
        if (
          !instrumentation._isRecording &&
          instrumentation.isEnabled() &&
          instrumentation._getLogMethods().includes(method)
        ) {
          instrumentation._isRecording = true;
          try {
            instrumentation._record(method, args);
          } finally {
            instrumentation._isRecording = false;
          }
        }

        return original.apply(this, args);
      } as Console[ConsoleMethod];
    };
  }

  private _record(method: ConsoleMethod, args: unknown[]): void {
    this._safeExecute('failed to record console call', () => {
      this.logger.emit({
        body: this._getMessageSerializer()(args),
        eventName: CONSOLE_LOG_EVENT_NAME,
        severityNumber: SEVERITY_MAP[method],
        severityText: method,
        context: context.active(),
        attributes: {
          [ATTR_CONSOLE_METHOD]: method,
        },
      });
    });
  }

  protected override _init(): void {
    for (const method of DEFAULT_LOG_METHODS) {
      if (typeof console[method] === 'function') {
        this._wrap(console, method, this._patchConsoleMethod(method));
      }
    }
  }
}
