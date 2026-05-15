/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import type { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { HttpResponse, http } from 'msw';
import { setupWorker } from 'msw/browser';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setupTestSpanExporter } from '#utils/test';
import { FetchInstrumentation } from './instrumentation.ts';
import { ATTR_HTTP_REQUEST_BODY_SIZE } from './semconv.ts';

export const handlers = [
  http.get('/api/get', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.post('/api/post', () => {
    return HttpResponse.json({ ok: true });
  }),
  http.get('/api/error', () => {
    return new HttpResponse(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }),
];

describe('WebVitalsInstrumentation', () => {
  let inMemoryExporter: InMemorySpanExporter;
  let instrumentation: FetchInstrumentation;

  const msWorker = setupWorker(...handlers);

  beforeAll(async () => {
    await msWorker.start();
    inMemoryExporter = setupTestSpanExporter();
    instrumentation = new FetchInstrumentation();
  });

  afterEach(() => {
    inMemoryExporter.reset();
    msWorker.resetHandlers();
  });

  afterAll(() => {
    msWorker.stop();
  });

  const getUrlForPath = (path: string) => {
    const url = new URL(location.href);
    url.pathname = path;
    return url.href;
  };

  const scopeName = '@opentelemetry/browser-instrumentation/fetch';
  const getFetchSpans = () =>
    inMemoryExporter
      .getFinishedSpans()
      .filter((span) => span.instrumentationScope.name === scopeName);

  const waitForSpan = async (
    url: string,
    timeoutMs = 1000,
  ): Promise<ReturnType<typeof getFetchSpans>[0]> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const spans = getFetchSpans();
      const found = spans.find(
        (span) => span.attributes[ATTR_URL_FULL] === url,
      );
      if (found) {
        return found;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `Span with URL "${url}" not captured within ${timeoutMs}ms`,
    );
  };

  describe('with no configuration', () => {
    it('should create spans for GET requests', async () => {
      const url = getUrlForPath('/api/get');
      await fetch(url);

      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(63315); // vitest server port

      // TODO: check the context has been stashed for the resource
    });

    it('should create spans for POST requests', async () => {
      const url = getUrlForPath('/api/post');
      await fetch(url, { method: 'post', body: 'body_content' });

      const span = await waitForSpan(url);
      expect(span.name).toBe('POST');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('POST');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(63315); // vitest server port
      expect(span.attributes[ATTR_HTTP_REQUEST_BODY_SIZE]).toBeUndefined(); // requires config set to true

      // TODO: check the context has been stashed for the resource
    });

    it('should record the exception for failed requests', async () => {
      const url = getUrlForPath('/api/error');
      await fetch(url);

      const span = await waitForSpan(url);
      expect(span.name).toBe('GET');
      expect(span.kind).toEqual(SpanKind.CLIENT);
      expect(span.attributes[ATTR_HTTP_REQUEST_METHOD]).toEqual('GET');
      expect(span.attributes[ATTR_URL_FULL]).toEqual(url);
      expect(span.attributes[ATTR_SERVER_PORT]).toEqual(63315); // vitest server port
      expect(span.status.code).toEqual(SpanStatusCode.ERROR);
      expect(span.attributes[ATTR_ERROR_TYPE]).toEqual('500');
      // TODO: check the context has been stashed for the resource
    });
  });

  describe('with ignoreUrls configuration', () => {
    it('should create spans for GET requests', async () => {
      const url = getUrlForPath('/api/get');
      instrumentation.setConfig({ ignoreUrls: [url] });
      await fetch(url);

      expect(async () => await waitForSpan(url)).rejects.toThrow(); // no spans exported
      // TODO: check the context has been stashed for the resource
    });
  });
});
