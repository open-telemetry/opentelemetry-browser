/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import {
  BatchLogRecordProcessor,
  LoggerProvider,
} from '@opentelemetry/sdk-logs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogsSdk } from './logs.ts';

describe('LogsSdk', () => {
  const setGlobalLoggerProviderSpy = vi.spyOn(logs, 'setGlobalLoggerProvider');
  let logsSdk: LogsSdk;

  beforeEach(() => {
    setGlobalLoggerProviderSpy.mockClear();
  });

  it('should register a LoggerProvider with a BatchLogRecordProcessor', () => {
    // Act
    logsSdk = new LogsSdk();
    logsSdk.start();

    // Assert
    const loggerProvider = setGlobalLoggerProviderSpy.mock.lastCall?.[0];
    expect(setGlobalLoggerProviderSpy).callCount(1);
    expect(loggerProvider instanceof LoggerProvider);
    // @ts-expect-error -- accessing private properties
    const processors = loggerProvider['_sharedState']['processors'];
    expect(processors.length).toBe(1);
    expect(processors[0]).toBeInstanceOf(BatchLogRecordProcessor);
  });
});
