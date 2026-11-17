/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { DiagLogger } from '@opentelemetry/api';
import { diag, trace } from '@opentelemetry/api';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { startBrowserSdk } from './startBrowserSdk.ts';

// The SDK sets the global logger once per page, so this file starts the SDK
// before anything else does.
describe('startBrowserSdk logger option', () => {
  const logger: DiagLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
  };
  // Spans go nowhere, so the SDK exports nothing
  const traces = {
    processors: [
      new SimpleSpanProcessor({
        exporter: { export: () => {}, shutdown: () => Promise.resolve() },
      }),
    ],
  };
  const consoleDirSpy = vi.spyOn(console, 'dir').mockImplementation(() => {});

  afterAll(() => {
    consoleDirSpy.mockRestore();
    diag.disable();
  });

  it('should register the given logger and pass it every message', async () => {
    // Act
    const sdk = startBrowserSdk({
      logger,
      // @ts-expect-error: an entry that is not an instrumentation is logged
      instrumentations: [{}],
      traces,
    });
    diag.debug('debug message');
    trace.getTracer('logger-test').startSpan('test').end();
    await sdk.shutdown();

    // Assert: the SDK's own error and a debug message both reach the logger,
    // and a logger option adds no console exporters
    expect(logger.error).toHaveBeenCalledWith(
      'instrumentations[0] is not an instrumentation; skipped',
    );
    expect(logger.debug).toHaveBeenCalledWith('debug message');
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringMatching(/deprecated/),
    );
    expect(consoleDirSpy).not.toHaveBeenCalled();
  });

  it('should keep the first logger when an SDK starts again', async () => {
    // Arrange
    const other: DiagLogger = { ...logger, warn: vi.fn() };

    // Act
    const sdk = startBrowserSdk({ logger: other, traces });
    diag.warn('warn message');
    await sdk.shutdown();

    // Assert
    expect(logger.warn).toHaveBeenCalledWith('warn message');
    expect(other.warn).not.toHaveBeenCalled();
  });

  it('should warn once that logLevel is deprecated', async () => {
    // Act
    const first = startBrowserSdk({ logLevel: 'WARN', traces });
    const second = startBrowserSdk({ logLevel: 'WARN', traces });
    await first.shutdown();
    await second.shutdown();

    // Assert
    const deprecations = vi
      .mocked(logger.warn)
      .mock.calls.filter(([message]) => /deprecated/.test(message));
    expect(deprecations).toEqual([
      [
        "The logLevel option is deprecated. Use logger: getDefaultLogger('WARN') instead.",
      ],
    ]);
  });
});
