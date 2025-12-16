/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { logs } from '@opentelemetry/api-logs';
import { describe, expect, it } from 'vitest';
import { setupTestLogExporter } from './logTestUtils.ts';

describe('logTestUtils', () => {
  it('should collect logs in memory', () => {
    const memoryExporter = setupTestLogExporter();

    const logger = logs.getLogger('test-logger');
    logger.emit({
      body: 'Test log message',
    });

    const exportedLogs = memoryExporter.getFinishedLogRecords();
    expect(exportedLogs.length).toBe(1);
    expect(exportedLogs[0]?.body).toBe('Test log message');
  });
});
