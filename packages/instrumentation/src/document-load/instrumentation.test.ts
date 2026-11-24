/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TextMapPropagator } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import {
  InMemorySpanExporter,
  SimpleSpanProcessor,
  TracerProvider,
} from '@opentelemetry/sdk-trace';
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { enableForTest } from '#utils/test';
import { DocumentLoadInstrumentation } from './instrumentation.ts';

const SERVER_TRACE = '1'.repeat(32);
const SERVER_SPAN = '2'.repeat(16);

function addMeta(name: string, content: string) {
  const meta = document.createElement('meta');
  meta.name = name;
  meta.content = content;
  document.head.append(meta);
}

function millis(time: [number, number]): number {
  return time[0] * 1000 + time[1] / 1e6;
}

describe('DocumentLoadInstrumentation', () => {
  let instrumentation: DocumentLoadInstrumentation;
  let spanExporter: InMemorySpanExporter;
  let tracerProvider: TracerProvider;
  let entry: PerformanceNavigationTiming;

  beforeEach(() => {
    vi.useFakeTimers();
    entry = {
      name: 'https://example.test/',
      entryType: 'navigation',
      fetchStart: 10,
      responseEnd: 40,
      loadEventEnd: 100,
    } as PerformanceNavigationTiming;
    vi.spyOn(performance, 'getEntriesByType').mockImplementation((type) =>
      type === 'navigation' ? [entry] : [],
    );
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
    spanExporter = new InMemorySpanExporter();
    tracerProvider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter: spanExporter })],
    });
    instrumentation = new DocumentLoadInstrumentation();
  });

  afterEach(async () => {
    instrumentation.disable();
    for (const meta of Array.from(document.head.querySelectorAll('meta'))) {
      meta.remove();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
    await tracerProvider.shutdown();
  });

  function finishLoad(propagator?: TextMapPropagator) {
    instrumentation.enable({ tracerProvider, propagator });
    vi.runAllTimers();
  }

  function finishedSpan() {
    const span = spanExporter.getFinishedSpans()[0];
    assert(span);
    return span;
  }

  it('creates one span with the original fetchStart and loadEventEnd, without child spans or span events', () => {
    finishLoad();
    const span = finishedSpan();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
    expect(span.name).toBe('documentLoad');
    expect(millis(span.startTime)).toBeCloseTo(performance.timeOrigin + 10, 2);
    expect(millis(span.endTime)).toBeCloseTo(performance.timeOrigin + 100, 2);
    expect(span.events).toEqual([]);
    expect(span.attributes['url.full']).toBe(entry.name);
    expect(span.parentSpanContext).toBeUndefined();
  });

  it('joins the server trace from the traceparent and tracestate meta tags', () => {
    addMeta('traceparent', `00-${SERVER_TRACE}-${SERVER_SPAN}-01`);
    addMeta('tracestate', 'vendor=value');
    finishLoad(new W3CTraceContextPropagator());
    const span = finishedSpan();
    expect(span.spanContext().traceId).toBe(SERVER_TRACE);
    expect(span.parentSpanContext?.spanId).toBe(SERVER_SPAN);
    expect(span.parentSpanContext?.isRemote).toBe(true);
    expect(span.spanContext().traceState?.serialize()).toBe('vendor=value');
  });

  it('matches the meta tag name without case', () => {
    addMeta('TraceParent', `00-${SERVER_TRACE}-${SERVER_SPAN}-01`);
    finishLoad(new W3CTraceContextPropagator());
    expect(finishedSpan().parentSpanContext?.spanId).toBe(SERVER_SPAN);
  });

  it('records no span when the server trace is not sampled', () => {
    addMeta('traceparent', `00-${SERVER_TRACE}-${SERVER_SPAN}-00`);
    finishLoad(new W3CTraceContextPropagator());
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
  });

  it('starts a new trace when the traceparent meta tag is malformed', () => {
    addMeta('traceparent', 'not-a-traceparent');
    finishLoad(new W3CTraceContextPropagator());
    expect(finishedSpan().parentSpanContext).toBeUndefined();
  });

  it('reads the meta tag the configured propagator asks for', () => {
    addMeta('traceparent', `00-${'3'.repeat(32)}-${'4'.repeat(16)}-01`);
    addMeta('b3', `${SERVER_TRACE}-${SERVER_SPAN}-1`);
    finishLoad(new B3Propagator());
    const span = finishedSpan();
    expect(span.spanContext().traceId).toBe(SERVER_TRACE);
    expect(span.parentSpanContext?.spanId).toBe(SERVER_SPAN);
  });

  it('has no side effects until enabled', () => {
    expect(instrumentation.isEnabled()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    enableForTest(instrumentation, { tracerProvider });
    expect(vi.getTimerCount()).toBe(1);
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it('waits until after load handlers for a finalized navigation entry', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    entry = { ...entry, loadEventEnd: 0 };
    instrumentation.enable({ tracerProvider });
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    window.dispatchEvent(new Event('load'));
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    entry = { ...entry, loadEventEnd: 100 };
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it('retries while loadEventEnd is not finalized', () => {
    entry = { ...entry, loadEventEnd: 0 };
    instrumentation.enable({ tracerProvider });
    vi.advanceTimersByTime(0);
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    entry = { ...entry, loadEventEnd: 100 };
    vi.advanceTimersByTime(50);
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it.each([
    { fetchStart: 10, loadEventEnd: 0 },
    { fetchStart: 10, loadEventEnd: 5 },
    { fetchStart: Number.NaN, loadEventEnd: 100 },
    { fetchStart: 10, loadEventEnd: Number.POSITIVE_INFINITY },
  ])('does not invent a load interval from invalid timing %j', (timing) => {
    Object.assign(entry, timing);
    finishLoad();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts at the time origin when fetchStart is below zero', () => {
    entry = { ...entry, fetchStart: -3 };
    finishLoad();
    const span = finishedSpan();
    expect(millis(span.startTime)).toBeCloseTo(performance.timeOrigin, 2);
    expect(millis(span.endTime)).toBeCloseTo(performance.timeOrigin + 100, 2);
  });

  it('does not emit without a navigation entry', () => {
    vi.mocked(performance.getEntriesByType).mockReturnValue([]);
    finishLoad();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
  });

  it('redacts credentials and sensitive query values in url.full', () => {
    entry = {
      ...entry,
      name: 'https://user:pass@example.test/file?sig=abc&X-Amz-Security-Token=def&color=blue',
    } as PerformanceNavigationTiming;
    finishLoad();
    expect(finishedSpan().attributes['url.full']).toBe(
      'https://REDACTED:REDACTED@example.test/file?sig=REDACTED&X-Amz-Security-Token=REDACTED&color=blue',
    );
  });

  it('keeps a collection failure off the page and stops retrying', () => {
    const brokenProvider = {
      getTracer: () => ({
        startSpan: () => {
          throw new Error('broken tracer');
        },
      }),
    } as unknown as TracerProvider;
    instrumentation.enable({ tracerProvider: brokenProvider });
    expect(() => vi.runAllTimers()).not.toThrow();
    expect(performance.getEntriesByType).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels pending collection when disabled', () => {
    instrumentation.enable({ tracerProvider });
    instrumentation.disable();
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
  });

  it('removes the load listener when disabled before load', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    instrumentation.enable({ tracerProvider });
    instrumentation.disable();
    window.dispatchEvent(new Event('load'));
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps one span across repeated enable and disable calls', () => {
    finishLoad();
    instrumentation.enable();
    instrumentation.disable();
    instrumentation.enable();
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it('keeps the original interval when enabled after load', () => {
    vi.advanceTimersByTime(5000);
    finishLoad();
    const span = finishedSpan();
    expect(millis(span.startTime)).toBeCloseTo(performance.timeOrigin + 10, 2);
    expect(millis(span.endTime)).toBeCloseTo(performance.timeOrigin + 100, 2);
  });
});
