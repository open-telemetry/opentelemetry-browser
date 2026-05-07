/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  ATTR_EXCEPTION_MESSAGE,
  ATTR_EXCEPTION_STACKTRACE,
  ATTR_EXCEPTION_TYPE,
} from '@opentelemetry/semantic-conventions';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { setupTestLogExporter } from '#utils/test';
import { ErrorsInstrumentation } from './instrumentation.ts';

const EXCEPTION_EVENT_NAME = 'exception';
const STRING_ERROR = 'Some error string.';

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// jsdom routes window 'error' events through its uncaught-exception reporter,
// which would surface to vitest's unhandled error reporter and fail the run.
// We dispatch a cancelable plain Event (the instrumentation only reads
// `event.error`) and call preventDefault from a capture-phase listener to
// suppress the default reporting behavior.
const dispatchErrorEvent = (error?: Error | string) => {
  const event = new Event('error', { cancelable: true });
  if (error !== undefined) {
    Object.defineProperty(event, 'error', { value: error });
  }
  const suppress = (e: Event) => e.preventDefault();
  window.addEventListener('error', suppress, { capture: true });
  try {
    window.dispatchEvent(event);
  } finally {
    window.removeEventListener('error', suppress, { capture: true });
  }
};

const dispatchUnhandledRejection = (reason: Error | string) => {
  // jsdom does not implement the PromiseRejectionEvent constructor, so we
  // synthesize an event with the same shape the instrumentation listens for.
  const event = new Event('unhandledrejection');
  Object.defineProperty(event, 'reason', { value: reason });
  window.dispatchEvent(event);
};

describe('ErrorsInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: ErrorsInstrumentation | undefined;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    inMemoryExporter.reset();
  });

  afterEach(() => {
    instrumentation?.disable();
    instrumentation = undefined;
    inMemoryExporter.reset();
  });

  const getErrorLogs = () =>
    inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.eventName === EXCEPTION_EVENT_NAME);

  describe('lifecycle', () => {
    it('should create an instance', () => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      expect(instrumentation).toBeInstanceOf(ErrorsInstrumentation);
    });

    it('should enable and disable without errors', () => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      expect(() => {
        instrumentation?.enable();
        instrumentation?.disable();
      }).not.toThrow();
    });

    it('should not emit after disable', () => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      instrumentation.enable();
      instrumentation.disable();

      dispatchErrorEvent(new Error('after disable'));

      expect(getErrorLogs()).toHaveLength(0);
    });

    it('should not double-subscribe when enabling twice', () => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      const addSpy = vi.spyOn(window, 'addEventListener');

      instrumentation.enable();
      instrumentation.enable();

      const errorCalls = addSpy.mock.calls.filter((c) => c[0] === 'error');
      const rejectionCalls = addSpy.mock.calls.filter(
        (c) => c[0] === 'unhandledrejection',
      );
      expect(errorCalls).toHaveLength(1);
      expect(rejectionCalls).toHaveLength(1);

      addSpy.mockRestore();
    });
  });

  describe('error events', () => {
    beforeEach(() => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      instrumentation.enable();
    });

    it('should emit an exception event when an Error is thrown', () => {
      dispatchErrorEvent(new ValidationError('Something happened!'));

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.eventName).toBe(EXCEPTION_EVENT_NAME);
    });

    it('should set semantic attributes for Error objects', () => {
      const stack =
        'Error: Something happened\n' +
        '    at baz (filename.js:10:15)\n' +
        '    at bar (filename.js:6:3)\n' +
        '    at foo (filename.js:2:3)';
      const error = new ValidationError('Something happened!');
      error.stack = stack;

      dispatchErrorEvent(error);

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBe('ValidationError');
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe(
        'Something happened!',
      );
      expect(logs[0]?.attributes[ATTR_EXCEPTION_STACKTRACE]).toBe(stack);
    });

    it('should handle a string error', () => {
      dispatchErrorEvent(STRING_ERROR);

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe(STRING_ERROR);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBeUndefined();
      expect(logs[0]?.attributes[ATTR_EXCEPTION_STACKTRACE]).toBeUndefined();
    });

    it('should not emit when the error is missing', () => {
      dispatchErrorEvent();

      expect(getErrorLogs()).toHaveLength(0);
    });
  });

  describe('unhandled rejection events', () => {
    beforeEach(() => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      instrumentation.enable();
    });

    it('should emit an exception event when a promise is rejected with an Error', () => {
      const error = new ValidationError('Rejected!');
      dispatchUnhandledRejection(error);

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBe('ValidationError');
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe('Rejected!');
    });

    it('should emit an exception event when a promise is rejected with a string', () => {
      dispatchUnhandledRejection(STRING_ERROR);

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe(STRING_ERROR);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBeUndefined();
    });
  });

  describe('applyCustomAttributes', () => {
    it('should merge custom attributes for Error objects', () => {
      instrumentation = new ErrorsInstrumentation({
        enabled: false,
        applyCustomAttributes: (error) => ({
          'app.custom.exception':
            error instanceof Error
              ? error.message.toLocaleUpperCase()
              : error.toLocaleUpperCase(),
        }),
      });
      instrumentation.enable();

      dispatchErrorEvent(new ValidationError('Something happened!'));

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes['app.custom.exception']).toBe(
        'SOMETHING HAPPENED!',
      );
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBe('ValidationError');
    });

    it('should merge custom attributes for string errors', () => {
      instrumentation = new ErrorsInstrumentation({
        enabled: false,
        applyCustomAttributes: (error) => ({
          'app.custom.exception':
            typeof error === 'string'
              ? error.toLocaleUpperCase()
              : error.message.toLocaleUpperCase(),
        }),
      });
      instrumentation.enable();

      dispatchErrorEvent(STRING_ERROR);

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe(STRING_ERROR);
      expect(logs[0]?.attributes['app.custom.exception']).toBe(
        STRING_ERROR.toLocaleUpperCase(),
      );
    });

    it('should still emit standard attributes when the hook throws', () => {
      instrumentation = new ErrorsInstrumentation({
        enabled: false,
        applyCustomAttributes: () => {
          throw new Error('hook boom');
        },
      });
      instrumentation.enable();

      expect(() =>
        dispatchErrorEvent(new ValidationError('Something happened!')),
      ).not.toThrow();

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBe('ValidationError');
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe(
        'Something happened!',
      );
    });
  });
});
