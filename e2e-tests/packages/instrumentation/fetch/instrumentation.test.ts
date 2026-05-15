/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { HttpResponse, http } from 'msw';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  COLLECTOR_URL,
  LOGS_COLLECTOR_URL,
  startMsw,
  stopMsw,
} from '../../../utils/test-collector.ts';
import type { TestOtelSetupResult } from '../../../utils/test-otel-setup.ts';
import { testOtelSetup } from '../../../utils/test-otel-setup.ts';

const TEST_URL = 'http://test.local/api';

describe('FetchInstrumentation', () => {
  let result: TestOtelSetupResult;

  beforeAll(async () => {
    await startMsw(
      http.options(
        TEST_URL,
        () =>
          new HttpResponse(null, {
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers':
                'traceparent, tracestate, baggage',
            },
          }),
      ),
      http.get(TEST_URL, () =>
        HttpResponse.json(
          { ok: true },
          {
            headers: { 'Access-Control-Allow-Origin': '*' },
          },
        ),
      ),
    );
  });

  afterAll(() => {
    stopMsw();
  });

  afterEach(async () => {
    await result.cleanup();
  });

  it('creates a span for a fetch request and emits a network timing log', async () => {
    result = testOtelSetup([
      new FetchInstrumentation({
        ignoreUrls: [COLLECTOR_URL, LOGS_COLLECTOR_URL],
      }),
    ]);

    await fetch(TEST_URL);

    await vi.waitFor(
      () => {
        const spans = result.getSpans();
        expect(spans).toHaveLength(1);
        const span = spans[0];
        expect(span).toBeDefined();
        if (!span) {
          return;
        }

        expect(span.name).toBe('GET');
        expect(span.kind).toBe(3); // SpanKind.CLIENT
        expect(span.status.code).toBe(0); // SpanStatusCode.UNSET

        const attr = (key: string) =>
          span.attributes.find((a) => a.key === key)?.value;

        expect(attr('http.request.method')).toEqual({ stringValue: 'GET' });
        expect(attr('url.full')).toEqual({ stringValue: TEST_URL });
        expect(attr('http.response.status_code')).toEqual({ intValue: 200 });
        expect(attr('server.address')).toEqual({ stringValue: 'test.local' });
        expect(attr('server.port')).toEqual({ intValue: 80 });
        expect(attr('error.type')).toBeUndefined();

        const logRecords = result.getLogs();
        expect(logRecords).toHaveLength(1);
        const logRecord = logRecords[0];
        expect(logRecord).toBeDefined();
        if (!logRecord) {
          return;
        }

        const logAttr = (key: string) =>
          logRecord.attributes.find((a) => a.key === key)?.value;

        expect(logAttr('fetchStart')).toBeDefined();
        expect(logAttr('domainLookupStart')).toBeDefined();
        expect(logAttr('domainLookupEnd')).toBeDefined();
        expect(logAttr('connectStart')).toBeDefined();
        expect(logAttr('connectEnd')).toBeDefined();
        expect(logAttr('requestStart')).toBeDefined();
        expect(logAttr('responseStart')).toBeDefined();
        expect(logAttr('responseEnd')).toBeDefined();

        expect(logRecord.traceId).toBe(span.traceId);
        expect(logRecord.spanId).toBe(span.spanId);
      },
      { timeout: 2000 },
    );
  });

  it('does not emit a network timing log when ignoreNetworkEvents is true', async () => {
    result = testOtelSetup([
      new FetchInstrumentation({
        ignoreUrls: [COLLECTOR_URL, LOGS_COLLECTOR_URL],
        ignoreNetworkEvents: true,
      }),
    ]);

    await fetch(TEST_URL);

    await vi.waitFor(
      () => {
        const spans = result.getSpans();
        expect(spans).toHaveLength(1);

        const span = spans[0];
        expect(span).toBeDefined();
        if (!span) {
          return;
        }

        expect(span.events).toHaveLength(0);
        expect(result.getLogs()).toHaveLength(0);
      },
      { timeout: 2000 },
    );
  });
});
