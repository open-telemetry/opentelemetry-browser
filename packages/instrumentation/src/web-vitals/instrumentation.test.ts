/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

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
import { page, userEvent } from 'vitest/browser';
import type { LCPMetricWithAttribution } from 'web-vitals/attribution';
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals/attribution';
import { setupTestLogExporter } from '#utils/test';
import { WebVitalsInstrumentation } from './instrumentation.ts';
import {
  ATTR_WEB_VITAL_DELTA,
  ATTR_WEB_VITAL_ID,
  ATTR_WEB_VITAL_NAME,
  ATTR_WEB_VITAL_NAVIGATION_ID,
  ATTR_WEB_VITAL_NAVIGATION_TYPE,
  ATTR_WEB_VITAL_NAVIGATION_URL,
  ATTR_WEB_VITAL_RATING,
  ATTR_WEB_VITAL_VALUE,
  WEB_VITAL_EVENT_NAME,
} from './semconv.ts';

// Keeps the real library, the spies only record the options each call gets.
vi.mock('web-vitals/attribution', { spy: true });

describe('WebVitalsInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: WebVitalsInstrumentation;
  let testContainer: HTMLDivElement;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    testContainer = document.createElement('div');
    testContainer.id = 'test-container';
    document.body.appendChild(testContainer);
  });

  afterEach(() => {
    instrumentation?.disable();
    inMemoryExporter.reset();
    testContainer?.remove();
    vi.restoreAllMocks();
  });

  const getWebVitalLogs = () =>
    inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.eventName === WEB_VITAL_EVENT_NAME);

  const triggerVisibilityChange = () => {
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  };

  const waitForMetric = async (
    metricName: string,
    timeoutMs = 1000,
  ): Promise<ReturnType<typeof getWebVitalLogs>[0]> => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const logs = getWebVitalLogs();
      const found = logs.find(
        (log) => log.attributes[ATTR_WEB_VITAL_NAME] === metricName,
      );
      if (found) {
        return found;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(
      `Metric "${metricName}" not captured within ${timeoutMs}ms`,
    );
  };

  const createButton = (name: string, busyWaitMs = 16) => {
    const button = document.createElement('button');
    button.textContent = name;
    button.addEventListener('click', () => {
      const start = performance.now();
      while (performance.now() - start < busyWaitMs) {
        // busy wait
      }
    });
    testContainer.appendChild(button);
    return button;
  };

  const triggerINP = async (buttonName: string) => {
    await userEvent.click(page.getByRole('button', { name: buttonName }));
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await new Promise((r) => setTimeout(r, 100));
    triggerVisibilityChange();
  };

  describe('INP metric', () => {
    it('should emit INP after user interaction', async () => {
      instrumentation = new WebVitalsInstrumentation();
      createButton('Click me');

      await triggerINP('Click me');

      const inpLog = await waitForMetric('inp');

      expect(inpLog.attributes[ATTR_WEB_VITAL_VALUE]).toBeGreaterThanOrEqual(0);
      expect(inpLog.attributes[ATTR_WEB_VITAL_DELTA]).toBeGreaterThanOrEqual(0);
      expect(inpLog.attributes[ATTR_WEB_VITAL_ID]).toBeDefined();
      expect(inpLog.attributes[ATTR_WEB_VITAL_NAVIGATION_TYPE]).toBeDefined();
      expect(['good', 'needs-improvement', 'poor']).toContain(
        inpLog.attributes[ATTR_WEB_VITAL_RATING],
      );
    });
  });

  describe('CLS metric', () => {
    it('should emit CLS after layout shift', async () => {
      instrumentation = new WebVitalsInstrumentation();

      const shifter = document.createElement('div');
      shifter.id = 'shifter';
      shifter.style.cssText =
        'width: 100px; height: 100px; background: red; position: relative;';
      testContainer.appendChild(shifter);

      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      await new Promise((r) => setTimeout(r, 100));

      const pusher = document.createElement('div');
      pusher.style.cssText = 'width: 100px; height: 200px; background: blue;';
      testContainer.insertBefore(pusher, shifter);

      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      await new Promise((r) => setTimeout(r, 100));

      triggerVisibilityChange();

      const clsLog = await waitForMetric('cls');

      expect(typeof clsLog.attributes[ATTR_WEB_VITAL_VALUE]).toBe('number');
      expect(clsLog.attributes[ATTR_WEB_VITAL_VALUE]).toBeGreaterThanOrEqual(0);
      expect(clsLog.attributes[ATTR_WEB_VITAL_DELTA]).toBeGreaterThanOrEqual(0);
      expect(clsLog.attributes[ATTR_WEB_VITAL_ID]).toBeDefined();
      expect(['good', 'needs-improvement', 'poor']).toContain(
        clsLog.attributes[ATTR_WEB_VITAL_RATING],
      );
    });
  });

  describe('enable/disable', () => {
    it('should not emit metrics when disabled', async () => {
      instrumentation = new WebVitalsInstrumentation();
      instrumentation.disable();

      const button = document.createElement('button');
      button.textContent = 'Disabled test';
      testContainer.appendChild(button);

      await userEvent.click(
        page.getByRole('button', { name: 'Disabled test' }),
      );
      triggerVisibilityChange();
      await new Promise((r) => setTimeout(r, 200));

      const logs = getWebVitalLogs();
      expect(logs.length).toBe(0);
    });

    it('should resume emitting after re-enable', async () => {
      instrumentation = new WebVitalsInstrumentation();
      instrumentation.disable();
      instrumentation.enable();

      createButton('Re-enabled test');
      await triggerINP('Re-enabled test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.attributes[ATTR_WEB_VITAL_NAME]).toBe('inp');
    });
  });

  describe('includeRawAttribution', () => {
    it('should include attribution as body when enabled', async () => {
      instrumentation = new WebVitalsInstrumentation({
        includeRawAttribution: true,
      });

      createButton('Attribution test');
      await triggerINP('Attribution test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.body).toBeDefined();
      const parsed = JSON.parse(inpLog.body as string);
      expect(parsed).toHaveProperty('interactionTime');
    });
  });

  describe('applyCustomLogRecordData hook', () => {
    it('should catch and log errors from hook without crashing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHook = vi.fn(() => {
        throw new Error('Hook error');
      });

      instrumentation = new WebVitalsInstrumentation({
        applyCustomLogRecordData: errorHook,
      });

      createButton('Hook error test');
      await triggerINP('Hook error test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.attributes[ATTR_WEB_VITAL_NAME]).toBe('inp');
      expect(errorHook).toHaveBeenCalled();
    });

    it('should allow hook to add custom attributes', async () => {
      const customHook = vi.fn((logRecord) => {
        logRecord.attributes['custom.page'] = 'test-page';
      });

      instrumentation = new WebVitalsInstrumentation({
        applyCustomLogRecordData: customHook,
      });

      createButton('Custom attr test');
      await triggerINP('Custom attr test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.attributes['custom.page']).toBe('test-page');
      expect(customHook).toHaveBeenCalled();
    });
  });

  describe('reportAllChanges', () => {
    const subscribers = [onCLS, onINP, onLCP, onFCP, onTTFB].map((fn) =>
      vi.mocked(fn),
    );

    // restoreAllMocks() does not clear automocked spies, so calls from earlier tests would remain.
    beforeEach(() => {
      for (const subscribe of subscribers) {
        subscribe.mockClear();
      }
    });

    it.each([
      { config: { reportAllChanges: true }, expected: true },
      { config: { reportAllChanges: false }, expected: false },
      { config: {}, expected: false },
    ])(
      'should register listeners with reportAllChanges $expected for config $config',
      ({ config, expected }) => {
        instrumentation = new WebVitalsInstrumentation(config);

        for (const subscribe of subscribers) {
          expect(subscribe).toHaveBeenCalledOnce();
          expect(subscribe.mock.lastCall?.[1]).toEqual({
            reportAllChanges: expected,
            reportSoftNavs: false,
          });
        }
      },
    );

    it('should defer registration when disabled and keep options on re-enable', () => {
      instrumentation = new WebVitalsInstrumentation({
        enabled: false,
        reportAllChanges: true,
      });
      for (const subscribe of subscribers) {
        expect(subscribe).not.toHaveBeenCalled();
      }

      instrumentation.enable();
      instrumentation.disable();
      instrumentation.setConfig({ reportAllChanges: false });
      instrumentation.enable();

      for (const subscribe of subscribers) {
        expect(subscribe).toHaveBeenCalledOnce();
        expect(subscribe.mock.lastCall?.[1]).toEqual({
          reportAllChanges: true,
          reportSoftNavs: false,
        });
      }
    });
  });

  describe('reportSoftNavs', () => {
    const subscribers = [onCLS, onINP, onLCP, onFCP, onTTFB].map((fn) =>
      vi.mocked(fn),
    );

    beforeEach(() => {
      for (const subscribe of subscribers) {
        subscribe.mockClear();
      }
    });

    const softNavLCP = {
      name: 'LCP',
      value: 500,
      delta: 500,
      rating: 'good',
      id: 'v5-soft',
      entries: [],
      navigationType: 'soft-navigation',
      navigationId: 7,
      navigationInteractionId: 3,
      navigationStartTime: 1000,
      navigationURL: 'https://example.com/next',
      attribution: {},
    } as unknown as LCPMetricWithAttribution;

    const emitLCP = (metric: LCPMetricWithAttribution) => {
      vi.mocked(onLCP).mockImplementationOnce((callback) => callback(metric));
    };

    const toPerformanceMs = ([seconds, nanos]: [number, number]) =>
      seconds * 1e3 + nanos / 1e6 - performance.timeOrigin;

    it.each([
      { config: { reportSoftNavs: true }, expected: true },
      { config: { reportSoftNavs: false }, expected: false },
      { config: {}, expected: false },
    ])(
      'should register listeners with reportSoftNavs $expected for config $config',
      ({ config, expected }) => {
        instrumentation = new WebVitalsInstrumentation(config);

        for (const subscribe of subscribers) {
          expect(subscribe).toHaveBeenCalledOnce();
          expect(subscribe.mock.lastCall?.[1]).toEqual({
            reportAllChanges: false,
            reportSoftNavs: expected,
          });
        }
      },
    );

    it('should add navigation id and url attributes', () => {
      emitLCP(softNavLCP);
      instrumentation = new WebVitalsInstrumentation({ reportSoftNavs: true });

      const [lcpLog] = getWebVitalLogs();
      expect(lcpLog?.attributes[ATTR_WEB_VITAL_NAVIGATION_TYPE]).toBe(
        'soft-navigation',
      );
      expect(lcpLog?.attributes[ATTR_WEB_VITAL_NAVIGATION_ID]).toBe(7);
      expect(lcpLog?.attributes[ATTR_WEB_VITAL_NAVIGATION_URL]).toBe(
        'https://example.com/next',
      );
    });

    it('should omit navigation attributes when web-vitals has none', () => {
      emitLCP({
        ...softNavLCP,
        navigationId: 0,
        navigationURL: undefined,
      } as LCPMetricWithAttribution);
      instrumentation = new WebVitalsInstrumentation();

      const [lcpLog] = getWebVitalLogs();
      expect(lcpLog?.attributes).not.toHaveProperty(
        ATTR_WEB_VITAL_NAVIGATION_ID,
      );
      expect(lcpLog?.attributes).not.toHaveProperty(
        ATTR_WEB_VITAL_NAVIGATION_URL,
      );
    });

    it('should offset the timestamp by the soft navigation start', () => {
      emitLCP(softNavLCP);
      instrumentation = new WebVitalsInstrumentation({ reportSoftNavs: true });

      const [lcpLog] = getWebVitalLogs();
      expect(lcpLog).toBeDefined();
      expect(toPerformanceMs(lcpLog?.hrTime ?? [0, 0])).toBeCloseTo(1500, 0);
    });
  });
});
