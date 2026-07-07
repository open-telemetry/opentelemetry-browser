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
import type { ErrorsInstrumentationConfig } from './types.ts';

const EXCEPTION_EVENT_NAME = 'exception';

export class ErrorsInstrumentation extends InstrumentationBase<ErrorsInstrumentationConfig> {
  // Use `declare` to prevent JS class field initializers from running after
  // super(), which would reset values set by the enable() call that
  // InstrumentationBase makes during its constructor.
  private declare _isEnabled: boolean;
  private declare _onErrorHandler?: (
    event: ErrorEvent | PromiseRejectionEvent,
  ) => void;

  constructor(config: ErrorsInstrumentationConfig = {}) {
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
    const isRejection = 'reason' in event;
    let error: Error | string | null | undefined = isRejection
      ? event.reason
      : event.error;

    // Cross-origin scripts deliver an ErrorEvent with `event.error` null but
    // a populated `event.message` (the canonical "Script error." sanitized
    // message). Treat that message as a string error so these events still
    // surface as an exception log instead of being silently dropped.
    // PromiseRejectionEvent has no analogous message field, so it stays a
    // no-op.
    if (
      error == null &&
      !isRejection &&
      typeof event.message === 'string' &&
      event.message.length > 0
    ) {
      error = event.message;
    }

    if (error == null) {
      // Emit a diag debug message so the drop is observable. Anything that
      // lands here had no usable signal (ErrorEvent with no error and no
      // message, or PromiseRejectionEvent rejected with null/undefined). Pass
      // the raw value too so the reader can tell null from undefined when
      // investigating a missing capture.
      this._diag.debug(
        isRejection
          ? 'ignored unhandledrejection event with no reason'
          : 'ignored error event with no error and no message',
        error,
      );
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

    // A throwing LogRecordProcessor would otherwise let the exception escape
    // this global error listener; contain it and surface the failure via diag.
    safeExecuteInTheMiddle(
      () => this.logger.emit(logRecord),
      (err) => {
        if (err) {
          this._diag.error('failed to emit exception log', err);
        }
      },
      true,
    );
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
