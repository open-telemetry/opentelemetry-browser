/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { startMsw, stopMsw } from '../../../utils/test-collector.ts';
import type { TestOtelSetupResult } from '../../../utils/test-otel-setup.ts';
import { testOtelSetup } from '../../../utils/test-otel-setup.ts';

// Dispatch a synthetic error event without actually crashing the browser page.
// We suppress the default reporting behavior with a capture-phase listener that
// calls preventDefault() so Playwright does not treat it as a test failure.
const dispatchErrorEvent = (error: Error | string) => {
  const event = new Event('error', { cancelable: true });
  Object.defineProperty(event, 'error', { value: error });
  const suppress = (e: Event) => e.preventDefault();
  window.addEventListener('error', suppress, { capture: true });
  try {
    window.dispatchEvent(event);
  } finally {
    window.removeEventListener('error', suppress, { capture: true });
  }
};

const dispatchUnhandledRejection = (reason: Error | string) => {
  const event = new PromiseRejectionEvent('unhandledrejection', {
    promise: Promise.resolve(),
    reason,
    cancelable: true,
  });
  window.dispatchEvent(event);
};

describe('ErrorsInstrumentation', () => {
  let result: TestOtelSetupResult;

  beforeAll(async () => {
    await startMsw();
  });

  afterAll(() => {
    stopMsw();
  });

  afterEach(async () => {
    await result.cleanup();
  });

  it('emits a log record with exception attributes when an Error is thrown', async () => {
    result = testOtelSetup([new ErrorsInstrumentation()]);

    const error = new TypeError('Something went wrong');
    dispatchErrorEvent(error);

    await vi.waitFor(
      () => {
        const logs = result.getLogs();
        expect(logs).toHaveLength(1);
        const log = logs[0];
        expect(log).toBeDefined();
        if (!log) {
          return;
        }

        const attr = (key: string) =>
          log.attributes.find((a) => a.key === key)?.value;

        expect(log.severityNumber).toBe(17); // SeverityNumber.ERROR
        expect(attr('exception.type')).toEqual({ stringValue: 'TypeError' });
        expect(attr('exception.message')).toEqual({
          stringValue: 'Something went wrong',
        });
        expect(attr('exception.stacktrace')).toBeDefined();
      },
      { timeout: 2000 },
    );
  });

  it('emits a log record with only exception.message when the error is a string', async () => {
    result = testOtelSetup([new ErrorsInstrumentation()]);

    dispatchErrorEvent('plain string error');

    await vi.waitFor(
      () => {
        const logs = result.getLogs();
        expect(logs).toHaveLength(1);
        const log = logs[0];
        expect(log).toBeDefined();
        if (!log) {
          return;
        }

        const attr = (key: string) =>
          log.attributes.find((a) => a.key === key)?.value;

        expect(attr('exception.message')).toEqual({
          stringValue: 'plain string error',
        });
        expect(attr('exception.type')).toBeUndefined();
        expect(attr('exception.stacktrace')).toBeUndefined();
      },
      { timeout: 2000 },
    );
  });

  it('emits a log record when a promise is rejected with an Error', async () => {
    result = testOtelSetup([new ErrorsInstrumentation()]);

    dispatchUnhandledRejection(new RangeError('Out of bounds'));

    await vi.waitFor(
      () => {
        const logs = result.getLogs();
        expect(logs).toHaveLength(1);
        const log = logs[0];
        expect(log).toBeDefined();
        if (!log) {
          return;
        }

        const attr = (key: string) =>
          log.attributes.find((a) => a.key === key)?.value;

        expect(attr('exception.type')).toEqual({ stringValue: 'RangeError' });
        expect(attr('exception.message')).toEqual({
          stringValue: 'Out of bounds',
        });
      },
      { timeout: 2000 },
    );
  });

  it('merges custom attributes from applyCustomAttributes', async () => {
    result = testOtelSetup([
      new ErrorsInstrumentation({
        applyCustomAttributes: (error) => ({
          'app.error.handled': false,
          'app.error.source': error instanceof Error ? error.name : 'string',
        }),
      }),
    ]);

    dispatchErrorEvent(new Error('Custom attr test'));

    await vi.waitFor(
      () => {
        const logs = result.getLogs();
        expect(logs).toHaveLength(1);
        const log = logs[0];
        expect(log).toBeDefined();
        if (!log) {
          return;
        }

        const attr = (key: string) =>
          log.attributes.find((a) => a.key === key)?.value;

        expect(attr('exception.type')).toEqual({ stringValue: 'Error' });
        expect(attr('app.error.handled')).toEqual({ boolValue: false });
        expect(attr('app.error.source')).toEqual({ stringValue: 'Error' });
      },
      { timeout: 2000 },
    );
  });
});
