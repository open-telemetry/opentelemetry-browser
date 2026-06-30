/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ROOT_CONTEXT } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/sdk-trace-base';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it } from 'vitest';
import { SessionSpanProcessor } from './SessionSpanProcessor.ts';

describe('SessionSpanProcessor', () => {
  it('adds session.id attribute', () => {
    const expectedAttributes = {
      'session.id': '12345678',
    };

    const tracer = new BasicTracerProvider().getTracer('session-testing');
    const span = tracer.startSpan('test-span') as Span;

    const sessionProvider = {
      getSessionId: () => '12345678',
    };

    const processor = new SessionSpanProcessor(sessionProvider);
    processor.onStart(span, ROOT_CONTEXT);

    expect(span.attributes).toEqual(expectedAttributes);
  });

  it('does not add session.id attribute when there is no session', () => {
    const tracer = new BasicTracerProvider().getTracer('session-testing');
    const span = tracer.startSpan('test-span') as Span;

    const sessionProvider = {
      getSessionId: () => null,
    };

    const processor = new SessionSpanProcessor(sessionProvider);
    processor.onStart(span, ROOT_CONTEXT);

    expect(span.attributes).toEqual({});
  });

  it('does not add session.id attribute when there is no provider', () => {
    const tracer = new BasicTracerProvider().getTracer('session-testing');
    const span = tracer.startSpan('test-span') as Span;

    // biome-ignore lint/suspicious/noExplicitAny: testing missing provider
    const processor = new SessionSpanProcessor(null as any);
    processor.onStart(span, ROOT_CONTEXT);

    expect(span.attributes).toEqual({});
  });

  it('forceFlush is a no-op and does not throw error', async () => {
    const processor = new SessionSpanProcessor({
      getSessionId: () => null,
    });
    await expect(processor.forceFlush()).resolves.toBeUndefined();
  });

  it('onEnd is a no-op and does not throw error', () => {
    const tracer = new BasicTracerProvider().getTracer('session-testing');
    const span = tracer.startSpan('test-span') as Span;

    const processor = new SessionSpanProcessor({
      getSessionId: () => null,
    });

    expect(() => processor.onEnd(span)).not.toThrow();
  });

  it('shutdown is a no-op and does not throw error', async () => {
    const processor = new SessionSpanProcessor({
      getSessionId: () => null,
    });
    await expect(processor.shutdown()).resolves.toBeUndefined();
  });
});
