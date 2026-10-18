/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  propagation,
  ROOT_CONTEXT,
  TraceFlags,
  trace,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
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
import { NavigationTimingInstrumentation } from '../navigation-timing/instrumentation.ts';
import { ResourceTimingInstrumentation } from '../resource-timing/instrumentation.ts';
import { getDocumentLoadContextRegistry } from '../utils/DocumentLoadContextRegistry.ts';
import { getNetworkContextRegistry } from '../utils/NetworkContextRegistry.ts';
import { DocumentLoadInstrumentation } from './instrumentation.ts';

const SERVER_TRACE = '1'.repeat(32);
const SERVER_SPAN = '2'.repeat(16);
const URL = 'https://example.test/asset.js';

function resource(
  fetchStart: number,
  responseEnd: number,
): PerformanceResourceTiming {
  return {
    name: URL,
    entryType: 'resource',
    fetchStart,
    responseEnd,
  } as PerformanceResourceTiming;
}

function millis(time: [number, number]): number {
  return time[0] * 1000 + time[1] / 1e6;
}

describe('DocumentLoadInstrumentation', () => {
  let instrumentation: DocumentLoadInstrumentation;
  let spanExporter: InMemorySpanExporter;
  let logExporter: InMemoryLogRecordExporter;
  let tracerProvider: TracerProvider;
  let loggerProvider: LoggerProvider;
  let entry: PerformanceNavigationTiming;
  let navigation: NavigationTimingInstrumentation | undefined;
  let resources: ResourceTimingInstrumentation | undefined;
  let resourceCallback: PerformanceObserverCallback;

  beforeEach(() => {
    vi.useFakeTimers();
    propagation.disable();
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
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
    logExporter = new InMemoryLogRecordExporter();
    tracerProvider = new TracerProvider({
      spanProcessors: [new SimpleSpanProcessor({ exporter: spanExporter })],
    });
    loggerProvider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
    });
    instrumentation = new DocumentLoadInstrumentation({ enabled: false });
    instrumentation.setTracerProvider(tracerProvider);
  });

  afterEach(async () => {
    resources?.disable();
    navigation?.disable();
    resources = undefined;
    navigation = undefined;
    instrumentation.disable();
    document.head
      .querySelectorAll('meta[name="traceparent"], meta[name="tracestate"]')
      .forEach((meta) => {
        meta.remove();
      });
    propagation.disable();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await tracerProvider.shutdown();
    await loggerProvider.shutdown();
  });

  function meta(name: string, content: string) {
    const element = document.createElement('meta');
    element.name = name;
    element.content = content;
    document.head.append(element);
  }

  function finishLoad() {
    instrumentation.enable();
    vi.runAllTimers();
  }

  function finishedSpan() {
    const span = spanExporter.getFinishedSpans()[0];
    assert(span);
    return span;
  }

  function emitNavigation() {
    navigation = new NavigationTimingInstrumentation({ enabled: false });
    navigation.setLoggerProvider(loggerProvider);
    navigation.enable();
    const log = logExporter.getFinishedLogRecords()[0];
    assert(log);
    return log;
  }

  function emitResources(entries: PerformanceResourceTiming[]) {
    vi.stubGlobal(
      'PerformanceObserver',
      vi.fn(function (this: unknown, callback: PerformanceObserverCallback) {
        resourceCallback = callback;
        return { observe: vi.fn(), disconnect: vi.fn() };
      }),
    );
    resources = new ResourceTimingInstrumentation({ enabled: false });
    resources.setLoggerProvider(loggerProvider);
    resources.enable();
    resourceCallback(
      {
        getEntries: () => entries,
        getEntriesByName: () => entries,
        getEntriesByType: () => entries,
      } as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    );
    resources.disable();
    return logExporter.getFinishedLogRecords();
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
    expect(span.attributes['user_agent.original']).toBe(navigator.userAgent);
    expect(span.parentSpanContext).toBeUndefined();
  });

  it('keeps the default-enabled constructor registration until deferred collection', () => {
    instrumentation.disable();
    instrumentation = new DocumentLoadInstrumentation();
    instrumentation.setTracerProvider(tracerProvider);
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
    expect(
      getDocumentLoadContextRegistry().getContext(resource(20, 90)),
    ).toBeDefined();
  });

  it('continues the server traceparent and tracestate from document meta', () => {
    meta('traceparent', `00-${SERVER_TRACE}-${SERVER_SPAN}-01`);
    meta('tracestate', 'vendor=value');
    finishLoad();
    const span = finishedSpan();
    expect(span.spanContext().traceId).toBe(SERVER_TRACE);
    expect(span.parentSpanContext?.spanId).toBe(SERVER_SPAN);
    expect(span.parentSpanContext?.isRemote).toBe(true);
    expect(span.spanContext().traceState?.serialize()).toBe('vendor=value');
  });

  it('starts a new trace for malformed meta', () => {
    meta('traceparent', 'invalid');
    finishLoad();
    const span = finishedSpan();
    expect(span.parentSpanContext).toBeUndefined();
    expect(span.spanContext().traceId).not.toBe(SERVER_TRACE);
  });

  it('does not replace a server sampling decision', () => {
    meta('traceparent', `00-${SERVER_TRACE}-${SERVER_SPAN}-00`);
    finishLoad();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    const ctx = getDocumentLoadContextRegistry().getContext(resource(20, 90));
    assert(ctx);
    expect(trace.getSpanContext(ctx)?.traceId).toBe(SERVER_TRACE);
    expect(trace.getSpanContext(ctx)?.traceFlags).toBe(TraceFlags.NONE);
  });

  it('waits until after load handlers for a finalized navigation entry', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    entry = { ...entry, loadEventEnd: 0 };
    instrumentation.enable();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    window.dispatchEvent(new Event('load'));
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    entry = { ...entry, loadEventEnd: 100 };
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it('retries while loadEventEnd is not finalized', () => {
    entry = { ...entry, loadEventEnd: 0 };
    instrumentation.enable();
    vi.advanceTimersByTime(0);
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    entry = { ...entry, loadEventEnd: 100 };
    vi.advanceTimersByTime(50);
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it.each([
    { fetchStart: 10, loadEventEnd: 0 },
    { fetchStart: 10, loadEventEnd: 5 },
    { fetchStart: -1, loadEventEnd: 100 },
    { fetchStart: Number.NaN, loadEventEnd: 100 },
    { fetchStart: 10, loadEventEnd: Number.POSITIVE_INFINITY },
  ])('does not invent a load interval from invalid timing %j', (timing) => {
    Object.assign(entry, timing);
    finishLoad();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not emit without a navigation entry', () => {
    vi.mocked(performance.getEntriesByType).mockReturnValue([]);
    finishLoad();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
  });

  it('cancels pending collection and removes correlation when disabled', () => {
    instrumentation.enable();
    instrumentation.disable();
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(0);
    expect(
      getDocumentLoadContextRegistry().getContext(resource(20, 90)),
    ).toBeUndefined();
  });

  it('removes the load listener when disabled before load', () => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    instrumentation.enable();
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
    expect(
      getDocumentLoadContextRegistry().getContext(resource(20, 90)),
    ).toBeDefined();
  });

  it('correlates navigation before the document-load timer runs', () => {
    instrumentation.enable();
    const log = emitNavigation();
    const span = finishedSpan();
    expect(log.spanContext?.spanId).toBe(span.spanContext().spanId);
    vi.runAllTimers();
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
  });

  it('preserves the original interval when enabled after load', () => {
    vi.advanceTimersByTime(5000);
    finishLoad();
    const span = finishedSpan();
    const records = emitResources([resource(20, 90), resource(101, 120)]);
    expect(millis(span.startTime)).toBeCloseTo(performance.timeOrigin + 10, 2);
    expect(millis(span.endTime)).toBeCloseTo(performance.timeOrigin + 100, 2);
    expect(records[0]?.spanContext?.spanId).toBe(span.spanContext().spanId);
    expect(records[1]?.spanContext).toBeUndefined();
  });

  it('correlates two same-URL resources independently in either observation order', () => {
    finishLoad();
    const span = finishedSpan();
    const records = emitResources([
      resource(20, 101),
      resource(20, 90),
      resource(101, 120),
      resource(30, 100),
    ]);
    expect(records.map((record) => record.spanContext?.spanId)).toEqual([
      undefined,
      span.spanContext().spanId,
      undefined,
      span.spanContext().spanId,
    ]);
  });

  it('lets an exact network match win without consuming document fallback', () => {
    finishLoad();
    const span = finishedSpan();
    const request = resource(20, 90);
    const network = tracerProvider
      .getTracer('test')
      .startSpan('fetch', {}, ROOT_CONTEXT);
    network.end();
    getNetworkContextRegistry().register(network, {
      key: URL,
      startPerfNow: 20,
      endPerfNow: 90,
    });
    const records = emitResources([request, resource(30, 95)]);
    expect(records[0]?.spanContext?.spanId).toBe(network.spanContext().spanId);
    expect(records[1]?.spanContext?.spanId).toBe(span.spanContext().spanId);
    expect(getNetworkContextRegistry().getContext(request)).toBeUndefined();
  });

  it('still uses a network match outside the document interval', () => {
    finishLoad();
    const network = trace.wrapSpanContext({
      traceId: '3'.repeat(32),
      spanId: '4'.repeat(16),
      traceFlags: TraceFlags.SAMPLED,
    });
    const request = resource(120, 150);
    getNetworkContextRegistry().register(network, {
      key: URL,
      startPerfNow: 120,
      endPerfNow: 150,
    });
    expect(emitResources([request])[0]?.spanContext?.spanId).toBe(
      '4'.repeat(16),
    );
  });

  it('uses the original inclusive interval boundaries and rejects invalid resource times', () => {
    finishLoad();
    const span = finishedSpan();
    const records = emitResources([
      resource(10, 100),
      resource(9, 90),
      resource(20, 101),
      resource(30, 20),
      resource(Number.NaN, 90),
    ]);
    expect(records.map((record) => record.spanContext?.spanId)).toEqual([
      span.spanContext().spanId,
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it('resolves resource context before the document-load timer runs', () => {
    instrumentation.enable();
    const records = emitResources([resource(20, 90), resource(30, 95)]);
    expect(spanExporter.getFinishedSpans()).toHaveLength(1);
    const spanId = finishedSpan().spanContext().spanId;
    expect(records.map((record) => record.spanContext?.spanId)).toEqual([
      spanId,
      spanId,
    ]);
  });
});
