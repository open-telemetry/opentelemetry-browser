/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { delay, HttpResponse, http } from 'msw';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { mockServer } from '../../utils/mock-server.ts';
import type { OtlpSpan } from '../../utils/test-collector.ts';
import { collector } from '../../utils/test-collector.ts';
import {
  assertEquivalentOutcomeAttributes,
  assertEquivalentRequestAttributes,
  attrOf,
} from './compare-spans.ts';
import type { FetchMigrationHarness, ScenarioKey } from './scenarios.ts';
import { urlForScenario } from './scenarios.ts';

declare global {
  interface Window {
    __fetchMigrationHarness?: FetchMigrationHarness;
    __fetchMigrationReady?: boolean;
  }
}

const OLD_BASE_URL = '/e2e/fetch-migration/old';
const NEW_BASE_URL = '/e2e/fetch-migration/new';

const fetchMigrationHandlers = [
  http.get('/e2e/fetch-migration/:impl/get', () =>
    HttpResponse.json({ ok: true }),
  ),
  http.get(
    '/e2e/fetch-migration/:impl/error',
    () =>
      new HttpResponse(null, {
        status: 500,
        statusText: 'Internal Server Error',
      }),
  ),
  http.get('/e2e/fetch-migration/:impl/network-error', () =>
    HttpResponse.error(),
  ),
  http.get('/e2e/fetch-migration/:impl/abort', () =>
    HttpResponse.json({ ok: true }),
  ),
  // Delayed well past the 50ms AbortSignal.timeout() used for the "timeout"
  // scenario, so the request is aborted before this ever resolves.
  http.get('/e2e/fetch-migration/:impl/timeout', async () => {
    await delay(1000);
    return HttpResponse.json({ ok: true });
  }),
  http.get(
    '/e2e/fetch-migration/:impl/no-body',
    () => new HttpResponse(null, { status: 204 }),
  ),
];

const getSpanByUrl = (url: string): OtlpSpan => {
  const span = collector
    .getSpans()
    .find((s) => attrOf(s, ATTR_URL_FULL)?.stringValue === url);
  expect(span).toBeDefined();

  // biome-ignore lint/style/noNonNullAssertion: expect(...).toBeDefined() above throws if undefined
  return span!;
};

async function loadFixtureIframe(
  src: string,
): Promise<{ iframe: HTMLIFrameElement; harness: FetchMigrationHarness }> {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    iframe.addEventListener('load', () => resolve(), { once: true });
    iframe.addEventListener(
      'error',
      () => reject(new Error(`Failed to load ${src}`)),
      { once: true },
    );
  });

  await vi.waitFor(
    () => {
      if (!iframe.contentWindow?.__fetchMigrationReady) {
        throw new Error(`${src} did not signal readiness`);
      }
    },
    { timeout: 5000 },
  );

  const harness = iframe.contentWindow?.__fetchMigrationHarness;
  if (!harness) {
    throw new Error(`${src} did not expose a harness`);
  }
  return { iframe, harness };
}

describe('fetch instrumentation migration parity', () => {
  let oldIframe: HTMLIFrameElement;
  let newIframe: HTMLIFrameElement;
  let oldHarness: FetchMigrationHarness;
  let newHarness: FetchMigrationHarness;

  beforeAll(async () => {
    ({ iframe: oldIframe, harness: oldHarness } = await loadFixtureIframe(
      '/e2e-tests/migration/fetch-migration/old.html',
    ));
    ({ iframe: newIframe, harness: newHarness } = await loadFixtureIframe(
      '/e2e-tests/migration/fetch-migration/new.html',
    ));
  });

  afterAll(() => {
    oldIframe.remove();
    newIframe.remove();
  });

  beforeEach(() => {
    mockServer.use(...fetchMigrationHandlers);
  });

  async function runBothAndGetSpans(
    key: ScenarioKey,
  ): Promise<{ oldSpan: OtlpSpan; newSpan: OtlpSpan }> {
    const oldUrl = urlForScenario(OLD_BASE_URL, key);
    const newUrl = urlForScenario(NEW_BASE_URL, key);

    await Promise.all([
      oldHarness.runScenario(key, OLD_BASE_URL),
      newHarness.runScenario(key, NEW_BASE_URL),
    ]);

    const oldSpan = await vi.waitFor(() => getSpanByUrl(oldUrl), {
      timeout: 2000,
    });
    const newSpan = await vi.waitFor(() => getSpanByUrl(newUrl), {
      timeout: 2000,
    });
    return { oldSpan, newSpan };
  }

  it('produces equivalent spans for a successful request', async () => {
    const { oldSpan, newSpan } = await runBothAndGetSpans('success');
    assertEquivalentRequestAttributes(oldSpan, newSpan);
    assertEquivalentOutcomeAttributes(oldSpan, newSpan);
    expect(newSpan.status.code).toBe(0); // SpanStatusCode.UNSET
  });

  it('produces equivalent spans for a non-2xx server response', async () => {
    const { oldSpan, newSpan } = await runBothAndGetSpans('serverError');
    assertEquivalentRequestAttributes(oldSpan, newSpan);
    assertEquivalentOutcomeAttributes(oldSpan, newSpan);
    expect(newSpan.status.code).toBe(2); // SpanStatusCode.ERROR
  });

  it('produces equivalent spans for a no-body (204) response', async () => {
    const { oldSpan, newSpan } = await runBothAndGetSpans('noBody');
    assertEquivalentRequestAttributes(oldSpan, newSpan);
    assertEquivalentOutcomeAttributes(oldSpan, newSpan);
    expect(newSpan.status.code).toBe(0); // SpanStatusCode.UNSET
  });

  it('produces equivalent spans for an intentional abort', async () => {
    const { oldSpan, newSpan } = await runBothAndGetSpans('abort');
    assertEquivalentRequestAttributes(oldSpan, newSpan);

    // Both correctly leave the span UNSET with no error.type for an
    // intentional abort. The only divergence is old's bogus
    // `http.response.status_code: 0` (see compare-spans.ts), which the new
    // instrumentation correctly leaves unset.
    expect(oldSpan.status.code).toBe(0); // SpanStatusCode.UNSET
    expect(newSpan.status.code).toBe(0);
    expect(attrOf(oldSpan, ATTR_ERROR_TYPE)).toEqual({});
    expect(attrOf(newSpan, ATTR_ERROR_TYPE)).toEqual({});
    expect(attrOf(oldSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({
      intValue: 0,
    });
    expect(attrOf(newSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({});
  });

  it('documents the known divergence for network errors (new correctly marks them as errors, old does not)', async () => {
    const { oldSpan, newSpan } = await runBothAndGetSpans('networkError');
    assertEquivalentRequestAttributes(oldSpan, newSpan);

    // Old: never classifies a network error as an error -- `_endSpan` only
    // sets ERROR status/error.type when the synthetic `status` is >= 400,
    // and a failed fetch always synthesizes `status: 0`.
    expect(oldSpan.status.code).toBe(0); // SpanStatusCode.UNSET
    expect(attrOf(oldSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({
      intValue: 0,
    });
    expect(attrOf(oldSpan, ATTR_ERROR_TYPE)).toEqual({});

    // New: correctly marks it as an error, with no bogus status code.
    expect(newSpan.status.code).toBe(2); // SpanStatusCode.ERROR
    expect(attrOf(newSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({});
    expect(attrOf(newSpan, ATTR_ERROR_TYPE)).toEqual({
      stringValue: 'TypeError',
    });
  });

  it('documents the known divergence for timeouts (new correctly marks them as errors, old treats them like an intentional abort)', async () => {
    const { oldSpan, newSpan } = await runBothAndGetSpans('timeout');
    assertEquivalentRequestAttributes(oldSpan, newSpan);

    // Old has no concept of a timeout distinct from an abort: both
    // synthesize `status: 0` and never reach the `>= 400` check in
    // `_endSpan`.
    expect(oldSpan.status.code).toBe(0); // SpanStatusCode.UNSET
    expect(attrOf(oldSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({
      intValue: 0,
    });
    expect(attrOf(oldSpan, ATTR_ERROR_TYPE)).toEqual({});

    // New explicitly distinguishes AbortSignal.timeout() from a manual
    // abort and marks it as an error.
    expect(newSpan.status.code).toBe(2); // SpanStatusCode.ERROR
    expect(attrOf(newSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual({});
    expect(attrOf(newSpan, ATTR_ERROR_TYPE)).toEqual({
      stringValue: 'TimeoutError',
    });
  });
});
