/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Logger } from '@opentelemetry/api-logs';
import type { InMemoryLogRecordExporter } from '@opentelemetry/sdk-logs';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from 'vitest';
import { page, userEvent } from 'vitest/browser';
import {
  registerForTest,
  setupTestDiagLogger,
  setupTestLogExporter,
} from '#utils/test';
import { WebVitalsInstrumentation } from './instrumentation.ts';
import {
  ATTR_WEB_VITAL_DELTA,
  ATTR_WEB_VITAL_ID,
  ATTR_WEB_VITAL_NAME,
  ATTR_WEB_VITAL_NAVIGATION_TYPE,
  ATTR_WEB_VITAL_RATING,
  ATTR_WEB_VITAL_VALUE,
  WEB_VITAL_EVENT_NAME,
} from './semconv.ts';

// Passes through to the real library, but can make one subscriber throw.
const webVitalsMock = vi.hoisted(() => ({
  failing: undefined as string | undefined,
  calls: [] as string[],
}));

vi.mock('web-vitals/attribution', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('web-vitals/attribution')>();
  const track =
    <Args extends unknown[]>(
      name: string,
      subscribe: (...args: Args) => void,
    ) =>
    (...args: Args) => {
      webVitalsMock.calls.push(name);
      if (webVitalsMock.failing === name) {
        throw new Error(`${name} subscribe failed`);
      }
      subscribe(...args);
    };
  return {
    ...actual,
    onCLS: track('CLS', actual.onCLS),
    onINP: track('INP', actual.onINP),
    onLCP: track('LCP', actual.onLCP),
    onFCP: track('FCP', actual.onFCP),
    onTTFB: track('TTFB', actual.onTTFB),
  };
});

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
      registerForTest(instrumentation);
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
      registerForTest(instrumentation);

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
      registerForTest(instrumentation);
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

    it('should resume emitting after re-enable, without duplicate listeners', async () => {
      instrumentation = new WebVitalsInstrumentation();
      registerForTest(instrumentation);
      instrumentation.disable();
      instrumentation.enable();
      instrumentation.disable();
      instrumentation.enable();

      createButton('Re-enabled test');
      await triggerINP('Re-enabled test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.attributes[ATTR_WEB_VITAL_NAME]).toBe('inp');
      // Listeners cannot be removed, so registering again on each enable would
      // report every metric more than once.
      await new Promise((r) => setTimeout(r, 200));
      const inpLogs = getWebVitalLogs().filter(
        (log) => log.attributes[ATTR_WEB_VITAL_NAME] === 'inp',
      );
      expect(inpLogs).toHaveLength(1);
    });

    it('should not emit through registerInstrumentations with `enabled: false` until enable()', async () => {
      instrumentation = new WebVitalsInstrumentation({ enabled: false });
      registerForTest(instrumentation);

      expect(instrumentation.isEnabled()).toBe(false);

      instrumentation.enable();
      expect(instrumentation.isEnabled()).toBe(true);

      createButton('Enabled later');
      await triggerINP('Enabled later');
      await waitForMetric('inp');
    });

    it('should stay off and warn when PerformanceObserver is not available', () => {
      const { warn } = setupTestDiagLogger();
      vi.stubGlobal('PerformanceObserver', undefined);
      onTestFinished(() => {
        vi.unstubAllGlobals();
      });

      instrumentation = new WebVitalsInstrumentation();
      registerForTest(instrumentation);

      expect(instrumentation.isEnabled()).toBe(false);
      expect(warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringMatching(/PerformanceObserver is not available/),
        expect.any(Error),
      );
    });
  });

  describe('includeRawAttribution', () => {
    it('should include attribution as body when enabled', async () => {
      instrumentation = new WebVitalsInstrumentation({
        includeRawAttribution: true,
      });
      registerForTest(instrumentation);

      createButton('Attribution test');
      await triggerINP('Attribution test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.body).toBeDefined();
      const parsed = JSON.parse(inpLog.body as string);
      expect(parsed).toHaveProperty('interactionTime');
    });
  });

  describe('enabled after an `enabled: false` registration', () => {
    it('should still report TTFB', async () => {
      instrumentation = new WebVitalsInstrumentation({ enabled: false });
      registerForTest(instrumentation);
      // TTFB is reported once. A subscription made while nothing is emitted
      // would receive it and drop it.
      await new Promise((r) => setTimeout(r, 200));

      instrumentation.enable();

      const ttfbLog = await waitForMetric('ttfb');
      expect(ttfbLog.attributes[ATTR_WEB_VITAL_NAME]).toBe('ttfb');
    });
  });

  describe('setConfig', () => {
    it('should apply includeRawAttribution set after construction', async () => {
      instrumentation = new WebVitalsInstrumentation();
      registerForTest(instrumentation);
      instrumentation.setConfig({ includeRawAttribution: true });

      createButton('Late attribution test');
      await triggerINP('Late attribution test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.body).toBeDefined();
    });

    it('should apply an applyCustomLogRecordData hook set after construction', async () => {
      instrumentation = new WebVitalsInstrumentation();
      registerForTest(instrumentation);
      instrumentation.setConfig({
        applyCustomLogRecordData: (logRecord) => {
          if (logRecord.attributes) {
            logRecord.attributes['custom.late'] = true;
          }
        },
      });

      createButton('Late hook test');
      await triggerINP('Late hook test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.attributes['custom.late']).toBe(true);
    });
  });

  describe('emit failure', () => {
    it('should not let a failed emit reach the page as an uncaught error', async () => {
      instrumentation = new WebVitalsInstrumentation();
      registerForTest(instrumentation);
      // Stands in for a log processor that throws from onEmit.
      const emitSpy = vi
        .spyOn(
          (instrumentation as unknown as { logger: Logger }).logger,
          'emit',
        )
        .mockImplementation(() => {
          throw new Error('processor broke');
        });
      const pageErrors: unknown[] = [];
      const onPageError = (event: ErrorEvent) => {
        pageErrors.push(event.error);
        event.preventDefault();
      };
      window.addEventListener('error', onPageError);
      onTestFinished(() => window.removeEventListener('error', onPageError));

      createButton('Emit failure test');
      await triggerINP('Emit failure test');
      await vi.waitFor(() => expect(emitSpy).toHaveBeenCalled());

      expect(pageErrors).toEqual([]);
    });
  });

  describe('subscription failure', () => {
    it('should subscribe the other metrics and warn when one subscriber throws', () => {
      const { warn } = setupTestDiagLogger();
      webVitalsMock.failing = 'INP';
      webVitalsMock.calls.length = 0;
      onTestFinished(() => {
        webVitalsMock.failing = undefined;
      });

      instrumentation = new WebVitalsInstrumentation();
      registerForTest(instrumentation);

      expect(instrumentation.isEnabled()).toBe(true);
      expect(webVitalsMock.calls).toEqual(['CLS', 'INP', 'LCP', 'FCP', 'TTFB']);
      expect(warn).toHaveBeenCalledWith(
        expect.any(String),
        'could not subscribe to INP',
        expect.any(Error),
      );

      instrumentation.disable();
      instrumentation.enable();

      expect(webVitalsMock.calls).toHaveLength(5);
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
      registerForTest(instrumentation);

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
      registerForTest(instrumentation);

      createButton('Custom attr test');
      await triggerINP('Custom attr test');

      const inpLog = await waitForMetric('inp');
      expect(inpLog.attributes['custom.page']).toBe('test-page');
      expect(customHook).toHaveBeenCalled();
    });
  });
});
