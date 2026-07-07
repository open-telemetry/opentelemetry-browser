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
// We dispatch a cancelable plain Event (the instrumentation reads
// `event.error`, falling back to `event.message`) and call preventDefault from
// a capture-phase listener to suppress the default reporting behavior.
const dispatchErrorEvent = (error?: Error | string, message?: string) => {
  const event = new Event('error', { cancelable: true });
  if (error !== undefined) {
    Object.defineProperty(event, 'error', { value: error });
  }
  if (message !== undefined) {
    Object.defineProperty(event, 'message', { value: message });
  }
  const suppress = (e: Event) => e.preventDefault();
  window.addEventListener('error', suppress, { capture: true });
  try {
    window.dispatchEvent(event);
  } finally {
    window.removeEventListener('error', suppress, { capture: true });
  }
};

const dispatchUnhandledRejection = (
  reason?: Error | string | null,
  message?: string,
) => {
  // jsdom does not implement the PromiseRejectionEvent constructor, so we
  // synthesize an event with the same shape the instrumentation listens for.
  // A real PromiseRejectionEvent always exposes a `reason` property, so we
  // always define it (even when null/undefined) to keep the instrumentation's
  // `'reason' in event` discriminant accurate.
  const event = new Event('unhandledrejection');
  Object.defineProperty(event, 'reason', { value: reason });
  // A real PromiseRejectionEvent has no `message`; the optional param lets a
  // test plant a stray one to prove the error-path fallback never leaks in.
  if (message !== undefined) {
    Object.defineProperty(event, 'message', { value: message });
  }
  window.dispatchEvent(event);
};

// The instrumentation does not expose its `_diag` or `logger` fields for
// testing, so reach the internals through a single typed accessor rather than
// casting in each test.
const internals = (inst: ErrorsInstrumentation | undefined) =>
  inst as unknown as {
    _diag: {
      debug: (...args: unknown[]) => void;
      error: (...args: unknown[]) => void;
    };
    logger: { emit: (record: unknown) => void };
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

    it('should not emit and should log a diag debug message when both error and message are missing', () => {
      const diagSpy = vi.spyOn(internals(instrumentation)._diag, 'debug');

      dispatchErrorEvent();

      expect(getErrorLogs()).toHaveLength(0);
      expect(diagSpy).toHaveBeenCalledWith(
        'ignored error event with no error and no message',
        undefined,
      );

      diagSpy.mockRestore();
    });

    it('should emit using event.message when event.error is missing', () => {
      // Cross-origin scripts deliver "Script error." with event.error null.
      dispatchErrorEvent(undefined, 'Script error.');

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.eventName).toBe(EXCEPTION_EVENT_NAME);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe('Script error.');
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBeUndefined();
      expect(logs[0]?.attributes[ATTR_EXCEPTION_STACKTRACE]).toBeUndefined();
    });

    it('should not emit and should log a diag debug message when event.message is an empty string', () => {
      const diagSpy = vi.spyOn(internals(instrumentation)._diag, 'debug');

      dispatchErrorEvent(undefined, '');

      expect(getErrorLogs()).toHaveLength(0);
      expect(diagSpy).toHaveBeenCalledWith(
        'ignored error event with no error and no message',
        undefined,
      );

      diagSpy.mockRestore();
    });

    it('should prefer event.error over event.message when both are present', () => {
      const error = new ValidationError('Real error');
      dispatchErrorEvent(error, 'Script error.');

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe('Real error');
      expect(logs[0]?.attributes[ATTR_EXCEPTION_TYPE]).toBe('ValidationError');
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

    it('should not emit and should log a diag debug message when the reason is null', () => {
      // A PromiseRejectionEvent has no message field to fall back to, so a
      // null reason is dropped rather than surfaced as the error path's
      // "Script error." fallback would be.
      const diagSpy = vi.spyOn(internals(instrumentation)._diag, 'debug');

      dispatchUnhandledRejection(null);

      expect(getErrorLogs()).toHaveLength(0);
      expect(diagSpy).toHaveBeenCalledWith(
        'ignored unhandledrejection event with no reason',
        null,
      );

      diagSpy.mockRestore();
    });

    it('should not fall back to event.message for rejections even when one is present', () => {
      // The `event.message` fallback is gated to error events via `!isRejection`.
      // A synthesized or polyfilled PromiseRejectionEvent could carry a stray
      // `message`; this proves it is never used as a rejection's exception
      // message, so the null reason is still dropped.
      const diagSpy = vi.spyOn(internals(instrumentation)._diag, 'debug');

      dispatchUnhandledRejection(null, 'Script error.');

      expect(getErrorLogs()).toHaveLength(0);
      expect(diagSpy).toHaveBeenCalledWith(
        'ignored unhandledrejection event with no reason',
        null,
      );

      diagSpy.mockRestore();
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

    it('should merge custom attributes on the event.message fallback path', () => {
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

      dispatchErrorEvent(undefined, 'Script error.');

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe('Script error.');
      expect(logs[0]?.attributes['app.custom.exception']).toBe('SCRIPT ERROR.');
    });

    it('should let custom attributes override the message on the fallback path', () => {
      instrumentation = new ErrorsInstrumentation({
        enabled: false,
        applyCustomAttributes: () => ({
          [ATTR_EXCEPTION_MESSAGE]: 'overridden',
        }),
      });
      instrumentation.enable();

      dispatchErrorEvent(undefined, 'Script error.');

      const logs = getErrorLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_EXCEPTION_MESSAGE]).toBe('overridden');
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

  describe('failure containment', () => {
    beforeEach(() => {
      instrumentation = new ErrorsInstrumentation({ enabled: false });
      instrumentation.enable();
    });

    it('should contain a throwing LogRecordProcessor and surface it via diag', () => {
      const accessor = internals(instrumentation);
      const diagSpy = vi.spyOn(accessor._diag, 'error');
      const emitSpy = vi
        .spyOn(accessor.logger, 'emit')
        .mockImplementation(() => {
          throw new Error('processor exploded');
        });

      try {
        // A throw escaping the listener would re-trigger 'error' and loop.
        expect(() =>
          dispatchErrorEvent(new ValidationError('boom')),
        ).not.toThrow();

        // Exactly once: the contained throw did not re-enter the listener.
        expect(emitSpy).toHaveBeenCalledTimes(1);
        expect(diagSpy).toHaveBeenCalledWith(
          'failed to record exception',
          expect.any(Error),
        );
      } finally {
        emitSpy.mockRestore();
        diagSpy.mockRestore();
      }
    });

    it('should contain a rejection reason that throws while its properties are read', () => {
      const diagSpy = vi.spyOn(internals(instrumentation)._diag, 'error');

      // A promise can reject with any value. This one throws while its `stack`
      // is read, exercising the extraction path before emit is ever reached.
      const hostileReason = {} as Error;
      Object.defineProperty(hostileReason, 'stack', {
        get() {
          throw new Error('stack getter exploded');
        },
      });

      try {
        expect(() => dispatchUnhandledRejection(hostileReason)).not.toThrow();

        expect(getErrorLogs()).toHaveLength(0);
        expect(diagSpy).toHaveBeenCalledWith(
          'failed to record exception',
          expect.any(Error),
        );
      } finally {
        diagSpy.mockRestore();
      }
    });
  });
});
