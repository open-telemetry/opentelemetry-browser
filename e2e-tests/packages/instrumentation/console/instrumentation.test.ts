/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, trace } from '@opentelemetry/api';
import { ConsoleInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/console';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { collector } from '../../../utils/test-collector.ts';
import type { TestSdkHandle } from '../../../utils/test-otel-setup.ts';
import { testSdkSetup } from '../../../utils/test-otel-setup.ts';

describe('ConsoleInstrumentation', () => {
  let result: TestSdkHandle;

  beforeAll(async () => {
    await collector.start();
  });

  afterAll(() => {
    collector.stop();
  });

  afterEach(async () => {
    await result.shutdown();
    collector.reset();
  });

  it('emits a log record with body, severity, and method attribute for console.error', async () => {
    result = testSdkSetup([new ConsoleInstrumentation()]);

    console.error('test browser error');

    await vi.waitFor(
      () => {
        // Match by body, not index, so this stays resilient should unrelated console.logs later be added to the startBrowserSdk harness
        const log = collector
          .getLogs()
          .find((l) => l.body?.stringValue === 'test browser error');
        expect(log).toBeDefined();
        if (!log) {
          throw new Error('Log record is undefined');
        }

        const attr = (key: string) =>
          log.attributes.find((a) => a.key === key)?.value;

        expect(log.severityNumber).toBe(17); // SeverityNumber.ERROR
        expect(log.severityText).toBe('error');
        expect(log.eventName).toBe('browser.console');
        expect(attr('browser.console.method')).toEqual({
          stringValue: 'error',
        });
      },
      { timeout: 2000 },
    );
  });

  it('maps each console method to its severity number', async () => {
    result = testSdkSetup([new ConsoleInstrumentation()]);

    console.debug('debug message');
    console.log('log message');
    console.info('info message');
    console.warn('warn message');
    console.error('error message');

    // SeverityNumber: DEBUG=5, INFO=9, WARN=13, ERROR=17
    const expected = [
      ['debug message', 'debug', 5],
      ['log message', 'log', 9],
      ['info message', 'info', 9],
      ['warn message', 'warn', 13],
      ['error message', 'error', 17],
    ] as const;

    await vi.waitFor(
      () => {
        const logs = collector.getLogs();
        for (const [body, method, severityNumber] of expected) {
          const log = logs.find((l) => l.body?.stringValue === body);
          expect(log?.severityText).toBe(method);
          expect(log?.severityNumber).toBe(severityNumber);
          expect(
            log?.attributes.find((a) => a.key === 'browser.console.method')
              ?.value,
          ).toEqual({ stringValue: method });
        }
      },
      { timeout: 2000 },
    );
  });

  it('serializes object arguments as JSON', async () => {
    result = testSdkSetup([new ConsoleInstrumentation()]);

    console.log('user', { id: 42 }, 'signed in');

    await vi.waitFor(
      () => {
        const log = collector
          .getLogs()
          .find((l) => l.body?.stringValue === 'user {"id":42} signed in');
        expect(log).toBeDefined();
      },
      { timeout: 2000 },
    );
  });

  it('only instruments the methods listed in logMethods', async () => {
    result = testSdkSetup([
      new ConsoleInstrumentation({ logMethods: ['error'] }),
    ]);

    console.log('log message');
    console.warn('warn message');
    console.error('error message');

    await vi.waitFor(
      () => {
        const logs = collector.getLogs();
        expect(
          logs.find((l) => l.body?.stringValue === 'error message'),
        ).toBeDefined();
        expect(
          logs.find((l) => l.body?.stringValue === 'log message'),
        ).toBeUndefined();
        expect(
          logs.find((l) => l.body?.stringValue === 'warn message'),
        ).toBeUndefined();
      },
      { timeout: 2000 },
    );
  });

  it('correlates the log with the active span', async () => {
    result = testSdkSetup([new ConsoleInstrumentation()]);

    const span = trace.getTracer('console-e2e').startSpan('checkout');
    context.with(trace.setSpan(context.active(), span), () => {
      console.error('charge failed');
    });
    span.end();

    const { traceId, spanId } = span.spanContext();

    await vi.waitFor(
      () => {
        const log = collector
          .getLogs()
          .find((l) => l.body?.stringValue === 'charge failed');
        expect(log).toBeDefined();
        if (!log) {
          throw new Error('Log record is undefined');
        }

        expect(log.traceId).toBe(traceId);
        expect(log.spanId).toBe(spanId);
      },
      { timeout: 2000 },
    );
  });
});
