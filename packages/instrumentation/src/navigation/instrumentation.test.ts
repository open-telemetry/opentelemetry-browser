/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
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
import { defaultSanitizeUrl } from '#utils';
import { enableForTest, setupTestLogExporter } from '#utils/test';

import { NavigationInstrumentation } from './instrumentation.ts';
import {
  ATTR_BROWSER_NAVIGATION_HASH_CHANGE,
  ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT,
  ATTR_BROWSER_NAVIGATION_TYPE,
  ATTR_URL_FULL,
  BROWSER_NAVIGATION_EVENT_NAME,
} from './semconv.ts';

describe('NavigationInstrumentation', () => {
  let inMemoryExporter: InMemoryLogRecordExporter;
  let instrumentation: NavigationInstrumentation | undefined;
  let restoreReadyState: (() => void) | undefined;

  beforeAll(() => {
    inMemoryExporter = setupTestLogExporter();
  });

  beforeEach(() => {
    // Reset URL to a known state for each test so history-based assertions
    // work regardless of previous tests.
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    instrumentation?.disable();
    instrumentation = undefined;
    inMemoryExporter.reset();
    restoreReadyState?.();
    restoreReadyState = undefined;
    vi.restoreAllMocks();
  });

  const getNavigationLogs = () =>
    inMemoryExporter
      .getFinishedLogRecords()
      .filter((log) => log.eventName === BROWSER_NAVIGATION_EVENT_NAME);

  const setReadyState = (state: DocumentReadyState) => {
    const original = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', {
      value: state,
      configurable: true,
    });

    restoreReadyState = () => {
      if (original) {
        Object.defineProperty(document, 'readyState', original);
      } else {
        delete (document as unknown as { readyState?: unknown }).readyState;
      }
    };
  };

  describe('lifecycle', () => {
    it('should create an instance', () => {
      instrumentation = new NavigationInstrumentation();
      expect(instrumentation).toBeInstanceOf(NavigationInstrumentation);
    });

    it('should enable and disable without errors', () => {
      const inst = new NavigationInstrumentation();
      instrumentation = inst;
      expect(() => {
        enableForTest(inst);
        inst.disable();
      }).not.toThrow();
    });

    it('should not double-subscribe when enabling twice', () => {
      setReadyState('loading');
      instrumentation = new NavigationInstrumentation();
      const addSpy = vi.spyOn(window, 'addEventListener');

      enableForTest(instrumentation);
      instrumentation.enable();

      const popstateCalls = addSpy.mock.calls.filter(
        (c) => c[0] === 'popstate',
      );
      expect(popstateCalls).toHaveLength(1);
    });
  });

  describe('hard navigation', () => {
    it('should emit immediately when readyState is complete', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT]).toBe(
        false,
      );
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_HASH_CHANGE]).toBe(
        false,
      );
    });

    it('should emit on DOMContentLoaded when readyState is loading', () => {
      setReadyState('loading');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      expect(getNavigationLogs()).toHaveLength(0);

      document.dispatchEvent(new Event('DOMContentLoaded'));

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT]).toBe(
        false,
      );
    });

    it('should emit immediately when readyState is interactive', () => {
      // DOMContentLoaded has already fired, so waiting for it would miss the page load.
      setReadyState('interactive');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);

      expect(getNavigationLogs()).toHaveLength(1);
    });

    it('should not emit the page load again after disable and enable', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      instrumentation.disable();
      instrumentation.enable();

      expect(getNavigationLogs()).toHaveLength(1);
    });

    it('should stay on when sanitizeUrl throws for the initial page', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        sanitizeUrl: (url) => {
          if (!url.includes('/next')) {
            throw new Error('sanitizer broke');
          }
          return url;
        },
      });

      enableForTest(instrumentation);
      window.history.pushState({}, '', '/next');

      expect(instrumentation.isEnabled()).toBe(true);
      expect(getNavigationLogs()).toHaveLength(1);
    });

    it('should not emit a duplicate initial event if DOMContentLoaded fires twice', () => {
      setReadyState('loading');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);

      document.dispatchEvent(new Event('DOMContentLoaded'));
      document.dispatchEvent(new Event('DOMContentLoaded'));

      expect(getNavigationLogs()).toHaveLength(1);
    });
  });

  describe('history API patching', () => {
    it('should emit a push event when history.pushState is called', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/new-path');

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe('push');
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT]).toBe(
        true,
      );
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_HASH_CHANGE]).toBe(
        false,
      );
    });

    it('should emit a replace event when history.replaceState is called', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.replaceState({}, '', '/replaced');

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe('replace');
    });

    it('should not emit when pushState is called twice with the same URL', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/same');
      expect(getNavigationLogs()).toHaveLength(1);

      window.history.pushState({}, '', '/same');
      expect(getNavigationLogs()).toHaveLength(1);
    });

    it('should not break pushState when sanitizeUrl throws', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        sanitizeUrl: (url) => {
          if (url.includes('/boom')) {
            throw new Error('sanitizer broke');
          }
          return url;
        },
      });
      enableForTest(instrumentation);

      expect(() => window.history.pushState({}, '', '/boom')).not.toThrow();
      expect(location.pathname).toBe('/boom');
    });

    it('should use the URL at the first enable(), not at construction, as the referrer', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      // History is not patched until the first enable(), so this change is not observed.
      window.history.replaceState({}, '', '/before-enable');
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/before-enable');

      expect(getNavigationLogs()).toHaveLength(0);
    });

    it('should still call the original pushState', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);

      window.history.pushState({ foo: 'bar' }, '', '/original-ran');

      expect(window.location.pathname).toBe('/original-ran');
      expect(window.history.state).toEqual({ foo: 'bar' });
    });
  });

  describe('popstate', () => {
    it('should emit a traverse event on popstate', async () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);

      window.history.pushState({}, '', '/page-a');
      inMemoryExporter.reset();

      // A real traversal: the browser changes the URL, then fires popstate.
      const popped = new Promise((resolve) =>
        window.addEventListener('popstate', resolve, { once: true }),
      );
      window.history.back();
      await popped;

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe(
        'traverse',
      );
    });
  });

  describe('hash change', () => {
    it('should mark hash_change=true when only hash is added', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/#section1');

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_HASH_CHANGE]).toBe(
        true,
      );
    });

    it('should mark hash_change=false when path changes', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/new-path');

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_HASH_CHANGE]).toBe(
        false,
      );
    });
  });

  describe('partial history patch', () => {
    it('should not wrap replaceState again after pushState fails', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      const wrapped: string[] = [];
      // Stubbed rather than locking `history.pushState` for real, because a
      // non-configurable slot cannot be undone and would break later tests.
      vi.spyOn(instrumentation, '_wrap').mockImplementation((_nodule, name) => {
        if (name === 'pushState') {
          throw new TypeError('Cannot redefine property: pushState');
        }
        wrapped.push(String(name));
      });

      enableForTest(instrumentation);
      instrumentation.enable();
      instrumentation.enable();

      expect(instrumentation.isEnabled()).toBe(false);
      expect(wrapped).toEqual(['replaceState']);
    });
  });

  describe('disable', () => {
    it('should not emit for history changes after disable', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();
      instrumentation.disable();

      window.history.pushState({}, '', '/after-disable');

      expect(getNavigationLogs()).toHaveLength(0);
    });

    it('should not emit on popstate after disable', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();
      instrumentation.disable();

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(getNavigationLogs()).toHaveLength(0);
    });
  });

  describe('sanitizeUrl', () => {
    it('should not sanitize by default', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/path?api_key=secret');

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes[ATTR_URL_FULL]).toContain('api_key=secret');
    });

    it('should apply defaultSanitizeUrl when provided', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        sanitizeUrl: defaultSanitizeUrl,
      });
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/path?api_key=secret&normal=value');

      const logs = getNavigationLogs();
      const url = logs[0]?.attributes[ATTR_URL_FULL] as string;
      expect(url).toContain('api_key=REDACTED');
      expect(url).toContain('normal=value');
    });

    it('should apply a custom sanitizeUrl function', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        sanitizeUrl: (url) => url.replace('secret', 'CUSTOM'),
      });
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/path?token=secret');

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes[ATTR_URL_FULL]).toContain('token=CUSTOM');
    });
  });

  describe('applyCustomLogRecordData', () => {
    it('should invoke the hook and allow attribute mutations', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        applyCustomLogRecordData: (logRecord) => {
          (logRecord.attributes as Record<string, unknown>)['custom.key'] =
            'custom.value';
        },
      });
      enableForTest(instrumentation);

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes['custom.key']).toBe('custom.value');
    });

    it('should catch errors thrown by the hook and still emit', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        applyCustomLogRecordData: () => {
          throw new Error('hook boom');
        },
      });
      const diagErrorSpy = vi
        .spyOn(
          (
            instrumentation as unknown as {
              _diag: { error: (...a: unknown[]) => void };
            }
          )._diag,
          'error',
        )
        .mockImplementation(() => {});

      enableForTest(instrumentation);

      expect(getNavigationLogs()).toHaveLength(1);
      expect(diagErrorSpy).toHaveBeenCalled();
    });

    it('should emit a one-time deprecation warning when the hook is used', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        applyCustomLogRecordData: (logRecord) => {
          (logRecord.attributes as Record<string, unknown>)['custom.key'] =
            'custom.value';
        },
      });
      const diagWarnSpy = vi
        .spyOn(
          (
            instrumentation as unknown as {
              _diag: { warn: (...a: unknown[]) => void };
            }
          )._diag,
          'warn',
        )
        .mockImplementation(() => {});

      enableForTest(instrumentation);
      window.history.pushState({}, '', '/page-2');

      expect(diagWarnSpy).toHaveBeenCalledTimes(1);
      expect(diagWarnSpy).toHaveBeenCalledWith(
        'applyCustomLogRecordData is deprecated. Use a custom LogRecordProcessor registered with LoggerProvider instead.',
      );
    });
  });

  describe('LogRecordProcessor custom attributes', () => {
    it('should allow custom LogRecordProcessor to add attributes in onEmit', () => {
      const memoryExporter = new InMemoryLogRecordExporter();
      const customProcessor: LogRecordProcessor = {
        onEmit: (record: SdkLogRecord) => {
          record.setAttribute('custom.processor.key', 'custom.processor.value');
        },
        shutdown: async () => {},
        forceFlush: async () => {},
      };
      const loggerProvider = new LoggerProvider({
        processors: [
          customProcessor,
          new SimpleLogRecordProcessor({ exporter: memoryExporter }),
        ],
      });

      setReadyState('complete');
      instrumentation = new NavigationInstrumentation();
      enableForTest(instrumentation, { loggerProvider });

      const logs = memoryExporter
        .getFinishedLogRecords()
        .filter((log) => log.eventName === BROWSER_NAVIGATION_EVENT_NAME);
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes['custom.processor.key']).toBe(
        'custom.processor.value',
      );
    });
  });

  describe('Navigation API', () => {
    const installNavigationApi = (stub: EventTarget) => {
      const original = Object.getOwnPropertyDescriptor(window, 'navigation');
      Object.defineProperty(window, 'navigation', {
        value: stub,
        configurable: true,
        writable: true,
      });
      return () => {
        if (original) {
          Object.defineProperty(window, 'navigation', original);
        } else {
          delete (window as unknown as { navigation?: unknown }).navigation;
        }
      };
    };

    it('should not patch history.pushState when Navigation API is used', () => {
      setReadyState('complete');
      const stub = new EventTarget();
      const restore = installNavigationApi(stub);
      const origPushState = window.history.pushState;

      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
      });
      enableForTest(instrumentation);

      expect(window.history.pushState).toBe(origPushState);
      restore();
    });

    it('should emit when Navigation API currententrychange fires', () => {
      setReadyState('complete');
      const stub = new EventTarget() as EventTarget & {
        currentEntry: { url: string };
      };
      stub.currentEntry = { url: 'http://localhost/nav-api-path' };
      const restore = installNavigationApi(stub);

      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
      });
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      const event = new Event('currententrychange') as Event & {
        navigationType?: string;
      };
      event.navigationType = 'push';
      stub.dispatchEvent(event);

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_URL_FULL]).toBe(
        'http://localhost/nav-api-path',
      );
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe('push');

      restore();
    });

    it('should remove the Navigation API listener on disable', () => {
      setReadyState('complete');
      const stub = new EventTarget() as EventTarget & {
        currentEntry: { url: string };
      };
      stub.currentEntry = { url: 'http://localhost/nav-api-path' };
      onTestFinished(installNavigationApi(stub));
      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
      });
      enableForTest(instrumentation);

      instrumentation.disable();
      inMemoryExporter.reset();
      stub.dispatchEvent(new Event('currententrychange'));

      expect(getNavigationLogs()).toHaveLength(0);
    });

    it('should keep Navigation API mode after disable and enable', () => {
      setReadyState('complete');
      const stub = new EventTarget() as EventTarget & {
        currentEntry: { url: string };
      };
      stub.currentEntry = { url: 'http://localhost/nav-api-path' };
      onTestFinished(installNavigationApi(stub));
      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
      });
      enableForTest(instrumentation);

      instrumentation.disable();
      instrumentation.enable();
      inMemoryExporter.reset();
      stub.dispatchEvent(new Event('currententrychange'));

      expect(getNavigationLogs()).toHaveLength(1);
    });

    it('should record a navigation that a hook makes during the page load', () => {
      setReadyState('complete');
      const stub = new EventTarget() as EventTarget & {
        currentEntry: { url: string };
      };
      stub.currentEntry = { url: 'http://localhost/nav-api-path' };
      onTestFinished(installNavigationApi(stub));
      let isPageLoad = true;
      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
        applyCustomLogRecordData: () => {
          if (isPageLoad) {
            isPageLoad = false;
            // A same-document replaceState fires this event synchronously.
            stub.dispatchEvent(new Event('currententrychange'));
          }
        },
      });

      enableForTest(instrumentation);

      const urls = getNavigationLogs().map(
        (log) => log.attributes[ATTR_URL_FULL],
      );
      expect(urls).toHaveLength(2);
      expect(urls).toContain('http://localhost/nav-api-path');
    });

    it('should fall back to history patching when window.navigation is undefined', () => {
      setReadyState('complete');
      const original = Object.getOwnPropertyDescriptor(window, 'navigation');
      Object.defineProperty(window, 'navigation', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      onTestFinished(() => {
        if (original) {
          Object.defineProperty(window, 'navigation', original);
        } else {
          delete (window as unknown as { navigation?: unknown }).navigation;
        }
      });
      expect(
        (window as unknown as { navigation?: unknown }).navigation,
      ).toBeUndefined();

      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
      });
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/fallback');

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe('push');
    });

    it('should map currententrychange navigationType values correctly', () => {
      setReadyState('complete');
      const stub = new EventTarget() as EventTarget & {
        currentEntry: { url: string };
      };
      stub.currentEntry = { url: 'http://localhost/nav-api-traverse' };
      const restore = installNavigationApi(stub);

      instrumentation = new NavigationInstrumentation({
        useNavigationApiIfAvailable: true,
      });
      enableForTest(instrumentation);
      inMemoryExporter.reset();

      const event = new Event('currententrychange') as Event & {
        navigationType?: string;
      };
      event.navigationType = 'traverse';
      stub.dispatchEvent(event);

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe(
        'traverse',
      );

      restore();
    });
  });

  describe('multi-instance', () => {
    it('should not throw when two instances are enabled and disabled', () => {
      setReadyState('complete');
      const a = new NavigationInstrumentation();
      const b = new NavigationInstrumentation();

      expect(() => {
        enableForTest(a);
        enableForTest(b);
        window.history.pushState({}, '', '/dual');
        a.disable();
        b.disable();
      }).not.toThrow();
    });
  });
});
