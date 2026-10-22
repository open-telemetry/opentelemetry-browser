/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { context, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { ExportResultCode } from '@opentelemetry/core';
import type {
  LogRecordExporter,
  ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStop } from './lifecycle.ts';
import { createLogProcessors } from './processors.ts';
import { runtimeSettings } from './settings.ts';

// Fixture-only access to pinned 1.0.0 internals. App code uses public exports.
const library = import.meta.resolve('react-inp-blame');
const { page } = await import(new URL('./install-state.js', library).href);
const { buildReport, sealReport } = await import(
  new URL('./join.js', library).href
);

function fixture(withLoaf = false, withReact = false) {
  const entries = [
    {
      name: 'click',
      interactionId: 7,
      startTime: 100,
      duration: 240,
      processingStart: 104,
      processingEnd: 330,
      target: null,
    },
  ];
  const frames = withLoaf
    ? [
        {
          start: 100,
          duration: 240,
          blocking: 190,
          forcedLayout: 0,
          styleAndLayoutStart: null,
          scripts: [
            {
              invoker: 'DIV#user-42.onclick',
              name: '',
              source: 'https://example.test/users/private-id/app.js',
              start: 105,
              duration: 220,
              forcedLayout: 0,
            },
          ],
        },
      ]
    : [];
  const commits = withReact
    ? [
        {
          at: 320,
          sinceInput: 220,
          inputTs: 100,
          gestureTs: 100,
          inputType: 'click',
          rendered: 8,
          hydrated: false,
          truncated: false,
          roots: ['OrderSummary'],
          hotPath: ['OrderSummary', 'LineItem'],
          components: [],
          hasDurations: true,
          coarseClock: false,
          total: 180,
          startedAt: null,
          effectsStartedAt: null,
          effectsEndedAt: null,
          walkMs: 0,
          priority: 1,
          didError: false,
        },
      ]
    : [];
  const target = {
    nodeType: 1,
    tagName: 'BUTTON',
    id: 'private-id',
    classList: { length: 0 },
    parentNode: null,
    parentElement: null,
    nextSibling: null,
    firstChild: null,
    getAttribute: () => null,
  };
  const inputs = withReact
    ? [
        {
          ts: 100,
          type: 'click',
          gestureTs: 100,
          target,
          owners: ['LineItem', 'OrderSummary'],
          handler: 'onClick',
          key: null,
          dehydrated: null,
          work: { endedAt: 100, unjoined: [] },
        },
      ]
    : [];
  const report = sealReport(buildReport(entries, commits, frames, inputs));
  page.installed = { api: { reports: () => [report] }, reapply: () => {} };
  return report;
}

const spanContext = {
  traceId: '0123456789abcdef0123456789abcdef',
  spanId: '0123456789abcdef',
  traceFlags: 1,
};

function pipeline(includeNames = false, synchronous = false) {
  const records: Array<{
    attributes: ReadableLogRecord['attributes'];
    hrTime: ReadableLogRecord['hrTime'];
    body: ReadableLogRecord['body'];
    eventName: ReadableLogRecord['eventName'];
    spanContext: ReadableLogRecord['spanContext'];
  }> = [];
  const exporter: LogRecordExporter = {
    export(batch, callback) {
      // Copy inside export so later enrichment cannot repair a wrong order.
      for (const record of batch) {
        records.push({
          attributes: { ...record.attributes },
          hrTime: [...record.hrTime],
          body: record.body,
          eventName: record.eventName,
          spanContext: record.spanContext,
        });
      }
      callback({ code: ExportResultCode.SUCCESS });
    },
    forceFlush: async () => {},
    shutdown: vi.fn(async () => {}),
  };
  const processors = createLogProcessors(exporter, includeNames);
  const batch = processors[2];
  const provider = new LoggerProvider({
    processors: synchronous
      ? [...processors.slice(0, 2), new SimpleLogRecordProcessor({ exporter })]
      : processors,
  });
  const logger = provider.getLogger('react-inp-example-test');
  return { records, provider, logger, exporter, batch };
}

function inp() {
  return {
    eventName: 'browser.web_vital',
    timestamp: performance.timeOrigin + 100,
    context: trace.setSpanContext(ROOT_CONTEXT, spanContext),
    attributes: {
      'browser.web_vital.name': 'inp',
      'browser.web_vital.value': 240,
      'browser.web_vital.id': 'synthetic-inp',
      'browser.web_vital.rating': 'needs-improvement',
    },
  };
}

afterEach(() => {
  page.installed = null;
  page.sampledOut = null;
  vi.unstubAllGlobals();
});

describe('existing INP log pipeline', () => {
  it('enriches one record before batch export and preserves its context and metric', async () => {
    fixture();
    const { logger, records, provider } = pipeline();
    const original = inp();
    logger.emit(original);
    await provider.forceFlush();
    expect(records).toHaveLength(1);
    expect(records[0]?.attributes).toMatchObject({
      ...original.attributes,
      'react_inp_blame.status': 'matched',
    });
    expect(records[0]?.eventName).toBe('browser.web_vital');
    expect(records[0]?.spanContext).toEqual(spanContext);
    const time = records[0]?.hrTime;
    expect(time).toBeDefined();
    expect((time?.[0] ?? 0) * 1000 + (time?.[1] ?? 0) / 1e6).toBeCloseTo(
      original.timestamp,
      2,
    );
    expect(records[0]?.body).toBeUndefined();
    expect(original.attributes).not.toHaveProperty('react_inp_blame.status');
    console.info('Synthetic exporter capture:', JSON.stringify(records[0]));
    await provider.shutdown();
  });

  it('also enriches and filters before a synchronous exporter', async () => {
    fixture(true);
    const { logger, records, provider, batch } = pipeline(false, true);
    logger.emit(inp());
    expect(records).toHaveLength(1);
    expect(records[0]?.attributes['react_inp_blame.status']).toBe('matched');
    expect(JSON.stringify(records)).not.toMatch(
      /user-42|private-id|onclick|example\.test/,
    );
    expect(records[0]?.attributes['react_inp_blame.blame.kind']).toBe('script');
    await provider.shutdown();
    await batch?.shutdown();
  });

  it('keeps names only on explicit opt-in', async () => {
    fixture(true);
    const { logger, records, provider } = pipeline(true);
    logger.emit(inp());
    await provider.forceFlush();
    expect(records[0]?.attributes['react_inp_blame.blame.name']).toBe(
      'DIV#user-42.onclick',
    );
    await provider.shutdown();
  });

  it.each([false, true])(
    'filters React component paths and handlers unless names are enabled: %s',
    async (includeNames) => {
      fixture(false, true);
      const { logger, records, provider } = pipeline(includeNames);
      logger.emit(inp());
      await provider.forceFlush();
      const attributes = records[0]?.attributes;
      expect(attributes?.['react_inp_blame.status']).toBe('matched');
      expect(attributes?.['react_inp_blame.commits.count']).toBe(1);
      expect(attributes?.['react_inp_blame.commits.rendered']).toBe(8);
      if (includeNames) {
        expect(attributes?.['react_inp_blame.target.components']).toBe(
          'OrderSummary > LineItem',
        );
        expect(attributes?.['react_inp_blame.handler']).toBe('onClick');
        console.info(
          'Synthetic named exporter capture:',
          JSON.stringify(records[0]),
        );
      } else {
        expect(JSON.stringify(records)).not.toMatch(
          /OrderSummary|LineItem|onClick|private-id/,
        );
      }
      await provider.shutdown();
    },
  );

  it('keeps the base INP record when attribution time is absent', async () => {
    fixture();
    const { logger, records, provider } = pipeline();
    logger.emit({ ...inp(), timestamp: undefined });
    await provider.forceFlush();
    expect(records[0]?.attributes).toEqual({
      ...inp().attributes,
      'react_inp_blame.status': 'no-report',
    });
    await provider.shutdown();
  });

  it('wires logs.processors through Browser SDK and drains export on teardown', async () => {
    fixture();
    // Node's observer is not a browser Event Timing observer.
    vi.stubGlobal('PerformanceObserver', undefined);
    const seen: Array<ReadableLogRecord['attributes']> = [];
    const exporter: LogRecordExporter = {
      export(records, callback) {
        seen.push(...records.map((record) => ({ ...record.attributes })));
        callback({ code: ExportResultCode.SUCCESS });
      },
      forceFlush: async () => {},
      shutdown: vi.fn(async () => {}),
    };
    const instrumentation = new WebVitalsInstrumentation({
      includeRawAttribution: false,
    });
    const disable = vi.spyOn(instrumentation, 'disable');
    const sdk = startBrowserSdk({
      serviceName: 'react-inp-test',
      instrumentations: [instrumentation],
      logs: { processors: createLogProcessors(exporter) },
    });
    try {
      logs.getLogger('browser-sdk-fixture').emit(inp());
      await sdk.shutdown();
      expect(seen).toHaveLength(1);
      expect(seen[0]?.['react_inp_blame.status']).toBe('matched');
      expect(disable).toHaveBeenCalledOnce();
      expect(exporter.shutdown).toHaveBeenCalledOnce();
    } finally {
      logs.disable();
      trace.disable();
      context.disable();
      propagation.disable();
    }
  });

  it('exports unchanged non-INP records', async () => {
    fixture();
    const { logger, records, provider } = pipeline();
    const lcp = {
      ...inp(),
      attributes: {
        'browser.web_vital.name': 'lcp',
        'browser.web_vital.value': 80,
      },
    };
    const ordinary = { body: 'hello', attributes: { custom: 'kept' } };
    logger.emit(lcp);
    logger.emit(ordinary);
    await provider.forceFlush();
    expect(records).toHaveLength(2);
    expect(records[0]?.attributes).toEqual(lcp.attributes);
    expect(records[0]?.spanContext).toEqual(spanContext);
    expect(records[1]?.attributes).toEqual(ordinary.attributes);
    expect(records[1]?.body).toBe('hello');
    await provider.shutdown();
  });

  it.each(['not-installed', 'sampled-out', 'no-report', 'library-error'])(
    'exports INP with %s and no invented blame',
    async (status) => {
      if (status === 'sampled-out') {
        page.sampledOut = {};
      } else if (status === 'no-report') {
        page.installed = { api: { reports: () => [] } };
      } else if (status === 'library-error') {
        page.installed = {
          api: {
            reports: () => {
              throw new Error('fixture');
            },
          },
        };
      }
      const { logger, records, provider } = pipeline();
      logger.emit(inp());
      await provider.forceFlush();
      expect(records[0]?.attributes).toEqual({
        ...inp().attributes,
        'react_inp_blame.status': status,
      });
      await provider.shutdown();
    },
  );

  it('keeps collection off in production unless explicitly enabled', () => {
    expect(runtimeSettings(true).enabled).toBe(false);
    expect(runtimeSettings(true, 'false').enabled).toBe(false);
    expect(runtimeSettings(true, 'true')).toMatchObject({
      enabled: true,
      sampleRate: 0.1,
      devtoolsTrack: false,
      overlay: false,
      debugGlobal: false,
      labels: 'attributes',
    });
    expect(runtimeSettings(false)).toMatchObject({
      enabled: true,
      sampleRate: 1,
    });
  });

  it.each([false, true])(
    'shuts down before disposing its runtime, including export failure %s',
    async (fail) => {
      const calls: string[] = [];
      const sdk = {
        shutdown: vi.fn(async () => {
          calls.push('shutdown');
          if (fail) {
            throw new Error('export failed');
          }
        }),
      };
      const stop = createStop(
        sdk,
        { dispose: () => calls.push('dispose') },
        () => calls.push('unmount'),
      );
      const first = stop();
      expect(stop()).toBe(first);
      if (fail) {
        await expect(first).rejects.toThrow('export failed');
      } else {
        await first;
      }
      expect(calls).toEqual(['shutdown', 'dispose', 'unmount']);
      expect(sdk.shutdown).toHaveBeenCalledOnce();
    },
  );
});
