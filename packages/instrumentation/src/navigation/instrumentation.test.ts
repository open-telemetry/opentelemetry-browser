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
import { defaultSanitizeUrl } from '#utils';
import { setupTestLogExporter } from '#utils/test';

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
      instrumentation = new NavigationInstrumentation({ enabled: false });
      expect(instrumentation).toBeInstanceOf(NavigationInstrumentation);
    });

    it('should enable and disable without errors', () => {
      instrumentation = new NavigationInstrumentation({ enabled: false });
      expect(() => {
        instrumentation?.enable();
        instrumentation?.disable();
      }).not.toThrow();
    });

    it('should not double-subscribe when enabling twice', () => {
      setReadyState('loading');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      const addSpy = vi.spyOn(window, 'addEventListener');

      instrumentation.enable();
      instrumentation.enable();

      const popstateCalls = addSpy.mock.calls.filter(
        (c) => c[0] === 'popstate',
      );
      expect(popstateCalls).toHaveLength(1);

      addSpy.mockRestore();
    });
  });

  describe('hard navigation', () => {
    it('should emit immediately when readyState is complete', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();

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
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      expect(getNavigationLogs()).toHaveLength(0);

      document.dispatchEvent(new Event('DOMContentLoaded'));

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_SAME_DOCUMENT]).toBe(
        false,
      );
    });

    it('should not emit a duplicate initial event if DOMContentLoaded fires twice', () => {
      setReadyState('loading');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();

      document.dispatchEvent(new Event('DOMContentLoaded'));
      document.dispatchEvent(new Event('DOMContentLoaded'));

      expect(getNavigationLogs()).toHaveLength(1);
    });
  });

  describe('history API patching', () => {
    it('should emit a push event when history.pushState is called', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
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
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      inMemoryExporter.reset();

      window.history.replaceState({}, '', '/replaced');

      const logs = getNavigationLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_TYPE]).toBe('replace');
    });

    it('should not emit when pushState is called twice with the same URL', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/same');
      expect(getNavigationLogs()).toHaveLength(1);

      window.history.pushState({}, '', '/same');
      expect(getNavigationLogs()).toHaveLength(1);
    });

    it('should still call the original pushState', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();

      window.history.pushState({ foo: 'bar' }, '', '/original-ran');

      expect(window.location.pathname).toBe('/original-ran');
      expect(window.history.state).toEqual({ foo: 'bar' });
    });
  });

  describe('popstate', () => {
    it('should emit a traverse event on popstate', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();

      // Advance URL so the plugin's tracked lastUrl is /page-a.
      window.history.pushState({}, '', '/page-a');

      // Simulate the browser going back: URL flips before popstate fires.
      // Disable the plugin around the URL change so lastUrl stays at /page-a.
      instrumentation.disable();
      window.history.replaceState({}, '', '/');
      instrumentation.enable();
      inMemoryExporter.reset();

      window.dispatchEvent(new PopStateEvent('popstate'));

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
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
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
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/new-path');

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes[ATTR_BROWSER_NAVIGATION_HASH_CHANGE]).toBe(
        false,
      );
    });
  });

  describe('disable', () => {
    it('should not emit for history changes after disable', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      inMemoryExporter.reset();
      instrumentation.disable();

      window.history.pushState({}, '', '/after-disable');

      expect(getNavigationLogs()).toHaveLength(0);
    });

    it('should not emit on popstate after disable', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      inMemoryExporter.reset();
      instrumentation.disable();

      window.dispatchEvent(new PopStateEvent('popstate'));

      expect(getNavigationLogs()).toHaveLength(0);
    });
  });

  describe('sanitizeUrl', () => {
    it('should not sanitize by default', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({ enabled: false });
      instrumentation.enable();
      inMemoryExporter.reset();

      window.history.pushState({}, '', '/path?api_key=secret');

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes[ATTR_URL_FULL]).toContain('api_key=secret');
    });

    it('should apply defaultSanitizeUrl when provided', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        enabled: false,
        sanitizeUrl: defaultSanitizeUrl,
      });
      instrumentation.enable();
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
        enabled: false,
        sanitizeUrl: (url) => url.replace('secret', 'CUSTOM'),
      });
      instrumentation.enable();
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
        enabled: false,
        applyCustomLogRecordData: (logRecord) => {
          (logRecord.attributes as Record<string, unknown>)['custom.key'] =
            'custom.value';
        },
      });
      instrumentation.enable();

      const logs = getNavigationLogs();
      expect(logs[0]?.attributes['custom.key']).toBe('custom.value');
    });

    it('should catch errors thrown by the hook and still emit', () => {
      setReadyState('complete');
      instrumentation = new NavigationInstrumentation({
        enabled: false,
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

      instrumentation.enable();

      expect(getNavigationLogs()).toHaveLength(1);
      expect(diagErrorSpy).toHaveBeenCalled();
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
        enabled: false,
        useNavigationApiIfAvailable: true,
      });
      instrumentation.enable();

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
        enabled: false,
        useNavigationApiIfAvailable: true,
      });
      instrumentation.enable();
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

    it('should fall back to history patching when window.navigation is undefined', () => {
      setReadyState('complete');
      // Ensure navigation is NOT defined (jsdom default)
      expect(
        (window as unknown as { navigation?: unknown }).navigation,
      ).toBeUndefined();

      instrumentation = new NavigationInstrumentation({
        enabled: false,
        useNavigationApiIfAvailable: true,
      });
      instrumentation.enable();
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
        enabled: false,
        useNavigationApiIfAvailable: true,
      });
      instrumentation.enable();
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
      const a = new NavigationInstrumentation({ enabled: false });
      const b = new NavigationInstrumentation({ enabled: false });

      expect(() => {
        a.enable();
        b.enable();
        window.history.pushState({}, '', '/dual');
        a.disable();
        b.disable();
      }).not.toThrow();
    });
  });
});
