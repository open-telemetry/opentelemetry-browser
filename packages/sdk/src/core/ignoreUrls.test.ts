/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  Instrumentation,
  InstrumentationConfig,
} from '@opentelemetry/instrumentation';
import { describe, expect, it, vi } from 'vitest';
import { appendIgnoreUrls } from './ignoreUrls.ts';

interface IgnoreUrlsConfig {
  enabled?: boolean;
  ignoreUrls?: Array<string | RegExp>;
}

function createFakeInstrumentation(
  config: IgnoreUrlsConfig = {},
): Instrumentation {
  return {
    instrumentationName: 'test-instrumentation',
    instrumentationVersion: '1.0.0',
    enable: vi.fn(),
    disable: vi.fn(),
    setTracerProvider: vi.fn(),
    setMeterProvider: vi.fn(),
    setLoggerProvider: vi.fn(),
    setConfig: vi.fn(),
    getConfig: () => config as InstrumentationConfig,
  };
}

describe('appendIgnoreUrls', () => {
  it('appends the given URLs after the existing ones', () => {
    const instrumentation = createFakeInstrumentation({
      ignoreUrls: ['https://example.com/api'],
    });

    appendIgnoreUrls(instrumentation, [
      'http://localhost:4318/v1/traces',
      'http://localhost:4318/v1/logs',
    ]);

    expect(instrumentation.setConfig).toHaveBeenCalledWith({
      ignoreUrls: [
        'https://example.com/api',
        'http://localhost:4318/v1/traces',
        'http://localhost:4318/v1/logs',
      ],
    });
  });

  it('creates the ignoreUrls list when the user configured none', () => {
    const instrumentation = createFakeInstrumentation();

    appendIgnoreUrls(instrumentation, ['http://localhost:4318/v1/traces']);

    expect(instrumentation.setConfig).toHaveBeenCalledWith({
      ignoreUrls: ['http://localhost:4318/v1/traces'],
    });
  });

  it('never mutates the ignoreUrls array the user configured', () => {
    const userUrls = ['https://example.com/api'];
    const instrumentation = createFakeInstrumentation({
      ignoreUrls: userUrls,
    });

    appendIgnoreUrls(instrumentation, ['http://localhost:4318/v1/traces']);

    expect(userUrls).toEqual(['https://example.com/api']);
    expect(instrumentation.getConfig()).toEqual({
      ignoreUrls: ['https://example.com/api'],
    });
  });

  it('skips URLs that are already configured', () => {
    const instrumentation = createFakeInstrumentation({
      ignoreUrls: [
        'https://example.com/api',
        'http://localhost:4318/v1/traces',
      ],
    });

    appendIgnoreUrls(instrumentation, [
      'http://localhost:4318/v1/traces',
      'http://localhost:4318/v1/logs',
    ]);

    expect(instrumentation.setConfig).toHaveBeenCalledWith({
      ignoreUrls: [
        'https://example.com/api',
        'http://localhost:4318/v1/traces',
        'http://localhost:4318/v1/logs',
      ],
    });
  });

  it('keeps RegExp entries and appends after them', () => {
    const instrumentation = createFakeInstrumentation({
      ignoreUrls: [/^https:\/\/example\.com/],
    });

    appendIgnoreUrls(instrumentation, ['http://localhost:4318/v1/traces']);

    expect(instrumentation.setConfig).toHaveBeenCalledWith({
      ignoreUrls: [
        /^https:\/\/example\.com/,
        'http://localhost:4318/v1/traces',
      ],
    });
  });

  it('does nothing for an empty list of URLs', () => {
    const instrumentation = createFakeInstrumentation({
      ignoreUrls: ['https://example.com/api'],
    });

    appendIgnoreUrls(instrumentation, []);

    expect(instrumentation.setConfig).not.toHaveBeenCalled();
  });
});
