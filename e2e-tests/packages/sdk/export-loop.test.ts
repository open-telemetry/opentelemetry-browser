/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { ATTR_URL_FULL } from '@opentelemetry/semantic-conventions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockServer } from '../../utils/mock-server.ts';
import type { OtlpLogRecord } from '../../utils/test-collector.ts';
import { collector } from '../../utils/test-collector.ts';

/**
 * Regression test for the telemetry-induced telemetry loop: the SDK exports
 * logs and traces to the OTLP collector, the resource-timing instrumentation
 * sees those export requests and emits a `browser.resource_timing` log for
 * them, and the SDK exports that new log too, feeding the loop. The SDK must
 * keep its own export URLs out of the instrumentations it registers so an
 * idle app does not keep exporting indefinitely (see issue #431 and the
 * self-observability supplementary guidelines on avoiding
 * telemetry-induced telemetry loops).
 */
describe('SDK export requests are not instrumented', () => {
  let sdkTeardown: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await sdkTeardown?.();
    sdkTeardown = undefined;
    mockServer.resetHandlers();
  });

  it('does not create resource timing entries for the SDK own export requests', async () => {
    // Arrange: start the SDK with the network instrumentations registered
    // through it, exactly like a user would. The SDK creates OTLP exporters
    // for both signals from the root endpoint (no per-signal overrides), so
    // its export requests go to the mocked collector URLs.
    const sdk = startBrowserSdk({
      exportConfig: { url: 'http://localhost:4318' },
      instrumentations: [
        new FetchInstrumentation(),
        new XhrInstrumentation(),
        new ResourceTimingInstrumentation(),
      ],
      batchProcessorConfig: { scheduledDelayMillis: 10 },
    });
    sdkTeardown = sdk.shutdown;

    // Act: emit one log record and wait for it to arrive at the collector.
    // Every export request the SDK makes from here on goes to the collector
    // URLs the instrumentations must ignore.
    const { logs } = await import('@opentelemetry/api-logs');
    logs.getLogger('e2e-export-loop').emit({ eventName: 'trigger' });
    await vi.waitFor(
      () => {
        expect(collector.getLogs().length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // Let any stray resource-timing entry for an export request be emitted
    // (and its own export flushed) before asserting.
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Assert: no resource-timing log was recorded for either collector URL.
    // The dev-server assets the test page itself loads (e.g. the vite client
    // script) are not export requests, so only the collector URLs matter.
    const urlsOf = (record: OtlpLogRecord) =>
      record.attributes.find((a) => a.key === ATTR_URL_FULL)?.value
        ?.stringValue ?? '';
    const resourceTimingUrls = collector
      .getLogs()
      .filter((l) => l.eventName === 'browser.resource_timing')
      .map(urlsOf);
    expect(
      resourceTimingUrls.filter((u) => u.startsWith('http://localhost:4318')),
    ).toEqual([]);

    // And the fetch instrumentation created no span for the export requests
    // either: only the application log we emitted is in the collector.
    const spans = collector.getSpans();
    expect(spans.length).toBe(0);
  });
});
