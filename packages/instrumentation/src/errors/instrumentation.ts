/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';
import type { AnyValueMap, LogRecord } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';
import {
  InstrumentationBase,
  safeExecuteInTheMiddle,
} from '@opentelemetry/instrumentation';
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';
import { version } from '../../package.json' with { type: 'json' };
import type { ExceptionInstrumentationConfig } from './types.ts';

const EXCEPTION_EVENT_NAME = 'exception';

export class ExceptionInstrumentation extends InstrumentationBase<ExceptionInstrumentationConfig> {
  // Use `declare` to prevent JS class field initializers from running after
  // super(), which would reset values set by the enable() call that
  // InstrumentationBase makes during its constructor.
  private declare _isEnabled: boolean;
  private declare _onErrorHandler?: (
    event: ErrorEvent | PromiseRejectionEvent,
  ) => void;

  constructor(config: ExceptionInstrumentationConfig = {}) {
    super('@opentelemetry/browser-instrumentation/errors', version, config);
  }

  protected override init() {
    return [];
  }

  override enable(): void {
    if (this._isEnabled) {
      return;
    }
    this._isEnabled = true;

    this._onErrorHandler = (event) => this._onError(event);
    window.addEventListener('error', this._onErrorHandler);
    window.addEventListener('unhandledrejection', this._onErrorHandler);
  }

  override disable(): void {
    if (!this._isEnabled) {
      return;
    }
    this._isEnabled = false;

    if (this._onErrorHandler) {
      window.removeEventListener('error', this._onErrorHandler);
      window.removeEventListener('unhandledrejection', this._onErrorHandler);
      this._onErrorHandler = undefined;
    }
  }

  private _onError(event: ErrorEvent | PromiseRejectionEvent): void {
    const error: Error | string | null | undefined =
      'reason' in event ? event.reason : event.error;

    if (error == null) {
      return;
    }

    let errorAttributes: AnyValueMap;
    if (typeof error === 'string') {
      errorAttributes = { [ATTR_EXCEPTION_MESSAGE]: error };
    } else {
      errorAttributes = {
        [ATTR_EXCEPTION_TYPE]: error.name,
        [ATTR_EXCEPTION_MESSAGE]: error.message,
        [ATTR_EXCEPTION_STACKTRACE]: error.stack,
      };
    }

    const customAttributes = this._applyCustomAttributes(error);

    const logRecord: LogRecord = {
      eventName: EXCEPTION_EVENT_NAME,
      severityNumber: SeverityNumber.ERROR,
      attributes: { ...errorAttributes, ...customAttributes },
    };

    this.logger.emit(logRecord);
  }

  private _applyCustomAttributes(error: Error | string): Attributes {
    const hook = this.getConfig().applyCustomAttributes;
    if (!hook) {
      return {};
    }
    let result: Attributes = {};
    safeExecuteInTheMiddle(
      () => {
        result = hook(error);
      },
      (err) => {
        if (err) {
          this._diag.error('applyCustomAttributes hook failed', err);
        }
      },
      true,
    );
    return result;
  }
}
