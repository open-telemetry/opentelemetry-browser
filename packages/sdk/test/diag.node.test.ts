/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe.each([
  {
    name: 'startLogsSdk',
    loadSdk: async () =>
      (await import('../src/logs/startLogsSdk.ts')).startLogsSdk,
    url: 'http://localhost:4318/v1/logs',
  },
  {
    name: 'startTracesSdk',
    loadSdk: async () =>
      (await import('../src/traces/startTracesSdk.ts')).startTracesSdk,
    url: 'http://localhost:4318/v1/traces',
  },
])('$name diagnostics', ({ loadSdk, url }) => {
  const config = {
    exportConfig: { url },
    logLevel: 'WARN',
    setGlobals: false,
  } as const;
  let startSdk: Awaited<ReturnType<typeof loadSdk>>;

  beforeEach(async () => {
    vi.resetModules();
    startSdk = await loadSdk();
  });

  afterEach(() => {
    diag.disable();
    vi.restoreAllMocks();
  });

  it('keeps a registered logger without warning about an override', async () => {
    const logger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    };
    expect(diag.setLogger(logger, DiagLogLevel.WARN)).toBe(true);
    const setLogger = vi.spyOn(diag, 'setLogger');

    await startSdk(config).shutdown();
    diag.warn('test warning');

    expect(logger.warn.mock.calls).toEqual([['test warning']]);
    expect(setLogger).not.toHaveBeenCalled();
  });

  it('registers a console logger at logLevel when no logger is registered', async () => {
    const setLogger = vi.spyOn(diag, 'setLogger');

    await startSdk(config).shutdown();

    expect(setLogger).toHaveBeenCalledExactlyOnceWith(
      expect.any(DiagConsoleLogger),
      { logLevel: DiagLogLevel.WARN },
    );
  });

  it('does not register a logger on later starts', async () => {
    const setLogger = vi.spyOn(diag, 'setLogger');
    await startSdk(config).shutdown();
    diag.disable();

    await startSdk(config).shutdown();

    expect(setLogger).toHaveBeenCalledOnce();
  });
});
