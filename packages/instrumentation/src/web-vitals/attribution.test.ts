/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecord } from '@opentelemetry/api';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  FCPMetricWithAttribution,
  INPMetricWithAttribution,
} from 'web-vitals/attribution';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';
import { enableForTest, setupTestLogExporter } from '#utils/test';
import { WebVitalsInstrumentation } from './instrumentation.ts';
import {
  ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET,
  ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE,
  ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INTERSECTING_DURATION,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_FUNCTION_NAME,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL,
  ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SUBPART,
  ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME,
  ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY,
  ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION,
  ATTR_WEB_VITAL_DELTA,
  ATTR_WEB_VITAL_ID,
  ATTR_WEB_VITAL_NAME,
  ATTR_WEB_VITAL_NAVIGATION_ID,
  ATTR_WEB_VITAL_NAVIGATION_TYPE,
  ATTR_WEB_VITAL_RATING,
  ATTR_WEB_VITAL_VALUE,
  WEB_VITAL_EVENT_NAME,
} from './semconv.ts';

vi.mock('web-vitals/attribution', { spy: true });

const createINPMetric = (
  attribution: Partial<INPMetricWithAttribution['attribution']> = {},
): INPMetricWithAttribution => ({
  name: 'INP',
  value: 80,
  delta: 80,
  rating: 'good',
  id: 'inp-fixture',
  entries: [],
  navigationType: 'navigate',
  navigationId: 1,
  attribution: {
    interactionTarget: '#checkout',
    interactionType: 'pointer',
    interactionTime: 100,
    nextPaintTime: 180,
    inputDelay: 10,
    processingDuration: 50,
    presentationDelay: 20,
    loadState: 'complete',
    processedEventEntries: [],
    longAnimationFrameEntries: [],
    ...attribution,
  },
});

type LongestScript = NonNullable<
  INPMetricWithAttribution['attribution']['longestScript']
>;

const createLongestScript = (
  invoker = 'BUTTON#checkout.onclick',
  invokerType: LongestScript['entry']['invokerType'] = 'event-listener',
  startTime = 95,
): LongestScript => ({
  entry: {
    name: 'script',
    entryType: 'script',
    startTime,
    duration: 55,
    executionStart: startTime,
    invoker,
    invokerType,
    sourceURL: 'https://example.com/checkout.js?token=secret',
    sourceFunctionName: 'submitOrder',
    sourceCharPosition: 0,
    pauseDuration: 0,
    forcedStyleAndLayoutDuration: 5,
    windowAttribution: 'self',
    toJSON() {
      return {
        startTime: this.startTime,
        duration: this.duration,
        invoker: this.invoker,
        invokerType: this.invokerType,
        sourceURL: this.sourceURL,
      };
    },
  },
  subpart: 'input-delay',
  intersectingDuration: 50,
});

const createFrame = (
  startTime: number,
  duration: number,
  scripts: PerformanceScriptTiming[],
): PerformanceLongAnimationFrameTiming => ({
  name: 'long-animation-frame',
  entryType: 'long-animation-frame',
  startTime,
  duration,
  renderStart: startTime + duration - 5,
  styleAndLayoutStart: 0,
  blockingDuration: 10,
  firstUIEventTimestamp: 0,
  scripts,
  toJSON() {
    return {
      name: this.name,
      startTime: this.startTime,
      duration: this.duration,
      blockingDuration: this.blockingDuration,
      scripts: this.scripts.map((script) => script.toJSON()),
    };
  },
});

describe('WebVitalsInstrumentation INP attribution', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: WebVitalsInstrumentation;
  let reportINP: Parameters<typeof onINP>[0];
  let reportFCP: Parameters<typeof onFCP>[0];

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    vi.mocked(onCLS).mockImplementation(() => {});
    vi.mocked(onLCP).mockImplementation(() => {});
    vi.mocked(onTTFB).mockImplementation(() => {});
    vi.mocked(onINP).mockImplementation((callback) => {
      reportINP = callback;
    });
    vi.mocked(onFCP).mockImplementation((callback) => {
      reportFCP = callback;
    });
  });

  afterEach(() => {
    instrumentation?.disable();
    inMemoryExporter.reset();
    vi.resetAllMocks();
  });

  const getLog = () => {
    const logs = inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.eventName === WEB_VITAL_EVENT_NAME);
    expect(logs).toHaveLength(1);
    const log = logs[0];
    if (!log) {
      throw new Error('Expected one web-vital log');
    }
    return log;
  };

  const getAttributionAttributes = (attributes: LogRecord['attributes']) =>
    Object.fromEntries(
      Object.entries(attributes ?? {}).filter(([name]) =>
        name.startsWith('browser.web_vital.attribution.'),
      ),
    );

  it('keeps attribution out of attributes and body by default', () => {
    instrumentation = new WebVitalsInstrumentation();
    enableForTest(instrumentation);
    reportINP(createINPMetric({ longestScript: createLongestScript() }));

    const log = getLog();
    expect(getAttributionAttributes(log.attributes)).toEqual({});
    expect(log.body).toBeUndefined();
    expect(log.attributes).toEqual({
      [ATTR_WEB_VITAL_NAME]: 'inp',
      [ATTR_WEB_VITAL_VALUE]: 80,
      [ATTR_WEB_VITAL_DELTA]: 80,
      [ATTR_WEB_VITAL_RATING]: 'good',
      [ATTR_WEB_VITAL_ID]: 'inp-fixture',
      [ATTR_WEB_VITAL_NAVIGATION_ID]: 1,
      [ATTR_WEB_VITAL_NAVIGATION_TYPE]: 'navigate',
    });
  });

  it('adds selected INP attribution without the raw body when enabled', () => {
    instrumentation = new WebVitalsInstrumentation({
      includeAttribution: true,
    });
    enableForTest(instrumentation);
    const metric = createINPMetric({ longestScript: createLongestScript() });
    reportINP(metric);

    const log = getLog();
    expect(getAttributionAttributes(log.attributes)).toEqual({
      [ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET]: '#checkout',
      [ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE]: 'pointer',
      [ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY]: 10,
      [ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION]: 50,
      [ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY]: 20,
      [ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME]: 180,
      [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: 'complete',
      [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER]:
        'BUTTON#checkout.onclick',
      [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL]:
        'https://example.com/checkout.js?token=REDACTED',
      [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_FUNCTION_NAME]:
        'submitOrder',
      [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_DURATION]: 55,
      [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SUBPART]: 'input-delay',
      [ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INTERSECTING_DURATION]: 50,
    });
    expect(log.body).toBeUndefined();
  });

  it.each(['classic-script', 'module-script'] as const)(
    'sanitizes a %s invoker by default',
    (invokerType) => {
      instrumentation = new WebVitalsInstrumentation({
        includeAttribution: true,
      });
      enableForTest(instrumentation);
      const longestScript = createLongestScript(
        'https://example.com/checkout?token=secret',
        invokerType,
      );
      reportINP(createINPMetric({ longestScript }));

      expect(
        getLog().attributes[ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER],
      ).toBe('https://example.com/checkout?token=REDACTED');
    },
  );

  it('uses the configured sanitizer for script URLs and leaves selector invokers unchanged', () => {
    instrumentation = new WebVitalsInstrumentation({
      includeAttribution: true,
      includeRawAttribution: true,
      sanitizeUrl: (url) => new URL(url).pathname,
    });
    enableForTest(instrumentation);
    const longestScript = createLongestScript();
    const moduleScript = createLongestScript(
      'https://example.com/checkout?token=secret',
      'module-script',
    );
    const metric = createINPMetric({
      longestScript,
      longAnimationFrameEntries: [
        createFrame(90, 60, [longestScript.entry, moduleScript.entry]),
      ],
    });
    reportINP(metric);

    const log = getLog();
    expect(
      log.attributes[ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL],
    ).toBe('/checkout.js');
    expect(
      log.attributes[ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_INVOKER],
    ).toBe('BUTTON#checkout.onclick');
    expect(log.body).toBe(
      JSON.stringify(metric.attribution)
        .replaceAll(
          'https://example.com/checkout.js?token=secret',
          '/checkout.js',
        )
        .replaceAll('https://example.com/checkout?token=secret', '/checkout'),
    );
    expect(log.body).toContain('BUTTON#checkout.onclick');
  });

  it('sanitizes every script in the body without changing the attribution', () => {
    instrumentation = new WebVitalsInstrumentation({
      includeRawAttribution: true,
    });
    enableForTest(instrumentation);
    const longestScript = createLongestScript();
    const classicScript = createLongestScript(
      'https://example.com/checkout?token=secret',
      'classic-script',
    );
    const moduleScript = createLongestScript(
      'https://example.com/checkout-module?token=secret',
      'module-script',
      150,
    );
    const metric = createINPMetric({
      longestScript,
      longAnimationFrameEntries: [
        createFrame(90, 60, [longestScript.entry, classicScript.entry]),
        createFrame(150, 60, [moduleScript.entry]),
      ],
    });
    for (const frame of metric.attribution.longAnimationFrameEntries) {
      for (const script of frame.scripts) {
        Object.freeze(script);
      }
      Object.freeze(frame.scripts);
      Object.freeze(frame);
    }
    Object.freeze(metric.attribution.longAnimationFrameEntries);
    Object.freeze(longestScript);
    Object.freeze(metric.attribution);
    const original = JSON.stringify(metric.attribution);

    reportINP(metric);

    const { body } = getLog();
    expect(body).not.toContain('token=secret');
    expect(body).toBe(original.replaceAll('token=secret', 'token=REDACTED'));
    expect(JSON.stringify(metric.attribution)).toBe(original);
  });

  it.each([
    { includeAttribution: false, includeRawAttribution: false },
    { includeAttribution: true, includeRawAttribution: false },
    { includeAttribution: false, includeRawAttribution: true },
    { includeAttribution: true, includeRawAttribution: true },
  ])('controls attributes and raw body independently: %j', (config) => {
    instrumentation = new WebVitalsInstrumentation(config);
    enableForTest(instrumentation);
    const metric = createINPMetric({ longestScript: createLongestScript() });
    reportINP(metric);

    const log = getLog();
    expect(Object.keys(getAttributionAttributes(log.attributes))).toHaveLength(
      config.includeAttribution ? 13 : 0,
    );
    expect(log.body).toBe(
      config.includeRawAttribution
        ? JSON.stringify(metric.attribution).replace(
            'token=secret',
            'token=REDACTED',
          )
        : undefined,
    );
    if (config.includeRawAttribution) {
      expect(JSON.parse(log.body as string).interactionTime).toBe(100);
      expect(log.attributes).not.toHaveProperty(
        'browser.web_vital.attribution.interaction_time',
      );
    }
  });

  it('preserves zero timings and an empty target without LoAF data', () => {
    instrumentation = new WebVitalsInstrumentation({
      includeAttribution: true,
    });
    enableForTest(instrumentation);
    reportINP(
      createINPMetric({
        interactionTarget: '',
        interactionType: 'keyboard',
        inputDelay: 0,
        processingDuration: 0,
        presentationDelay: 0,
        nextPaintTime: 0,
      }),
    );

    expect(getAttributionAttributes(getLog().attributes)).toEqual({
      [ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET]: '',
      [ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TYPE]: 'keyboard',
      [ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY]: 0,
      [ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION]: 0,
      [ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY]: 0,
      [ATTR_WEB_VITAL_ATTRIBUTION_NEXT_PAINT_TIME]: 0,
      [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: 'complete',
    });
  });

  it('omits unavailable interaction and script fields for a dummy INP', () => {
    instrumentation = new WebVitalsInstrumentation({
      includeAttribution: true,
    });
    enableForTest(instrumentation);
    reportINP(
      createINPMetric({
        interactionTarget: undefined,
        interactionType: undefined,
        interactionTime: undefined,
        nextPaintTime: undefined,
        inputDelay: 0,
        processingDuration: 0,
        presentationDelay: 80,
      }),
    );

    expect(getAttributionAttributes(getLog().attributes)).toEqual({
      [ATTR_WEB_VITAL_ATTRIBUTION_INPUT_DELAY]: 0,
      [ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION]: 0,
      [ATTR_WEB_VITAL_ATTRIBUTION_PRESENTATION_DELAY]: 80,
      [ATTR_WEB_VITAL_ATTRIBUTION_LOAD_STATE]: 'complete',
    });
  });

  it.each([false, true])(
    'does not add INP attributes to other web-vital events (raw body: %s)',
    (includeRawAttribution) => {
      instrumentation = new WebVitalsInstrumentation({
        includeAttribution: true,
        includeRawAttribution,
      });
      enableForTest(instrumentation);
      const metric: FCPMetricWithAttribution = {
        name: 'FCP',
        value: 100,
        delta: 100,
        rating: 'good',
        id: 'fcp-fixture',
        entries: [],
        navigationType: 'navigate',
        navigationId: 1,
        attribution: {
          timeToFirstByte: 40,
          firstByteToFCP: 60,
          loadState: 'loading',
        },
      };
      reportFCP(metric);

      const log = getLog();
      expect(log.attributes[ATTR_WEB_VITAL_NAME]).toBe('fcp');
      expect(getAttributionAttributes(log.attributes)).toEqual({});
      expect(log.body).toBe(
        includeRawAttribution ? JSON.stringify(metric.attribution) : undefined,
      );
    },
  );

  it('lets the custom hook redact both attribution attributes and raw body', () => {
    let attributesAtHook: LogRecord['attributes'];
    let bodyAtHook: LogRecord['body'];
    const hook = vi.fn((logRecord: LogRecord) => {
      attributesAtHook = { ...logRecord.attributes };
      bodyAtHook = logRecord.body;
      if (logRecord.attributes) {
        delete logRecord.attributes[
          ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET
        ];
        delete logRecord.attributes[
          ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL
        ];
      }
      logRecord.body = 'redacted';
    });
    instrumentation = new WebVitalsInstrumentation({
      includeAttribution: true,
      includeRawAttribution: true,
      applyCustomLogRecordData: hook,
    });
    enableForTest(instrumentation);
    reportINP(createINPMetric({ longestScript: createLongestScript() }));

    const log = getLog();
    expect(hook).toHaveBeenCalledOnce();
    expect(
      attributesAtHook?.[ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET],
    ).toBe('#checkout');
    expect(bodyAtHook).toBeDefined();
    expect(log.attributes).not.toHaveProperty(
      ATTR_WEB_VITAL_ATTRIBUTION_INTERACTION_TARGET,
    );
    expect(log.attributes).not.toHaveProperty(
      ATTR_WEB_VITAL_ATTRIBUTION_LONGEST_SCRIPT_SOURCE_URL,
    );
    expect(log.attributes[ATTR_WEB_VITAL_ATTRIBUTION_PROCESSING_DURATION]).toBe(
      50,
    );
    expect(log.body).toBe('redacted');
  });
});
