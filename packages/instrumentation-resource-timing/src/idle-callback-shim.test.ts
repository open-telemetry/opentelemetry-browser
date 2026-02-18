/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelIdleCallbackShim,
  requestIdleCallbackShim,
} from './idle-callback-shim.ts';

describe('idle-callback-shim', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('when requestIdleCallback is available', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        requestIdleCallback: vi.fn(() => 42),
        cancelIdleCallback: vi.fn(),
        setTimeout: vi.fn(),
        clearTimeout: vi.fn(),
      });
    });

    it('should delegate to native requestIdleCallback', () => {
      const callback = vi.fn();
      const handle = requestIdleCallbackShim(callback, { timeout: 1000 });

      expect(window.requestIdleCallback).toHaveBeenCalledWith(callback, {
        timeout: 1000,
      });
      expect(handle.native).toBe(true);
      expect(handle.id).toBe(42);
    });

    it('should delegate cancel to native cancelIdleCallback', () => {
      const handle = { id: 42, native: true as const };
      cancelIdleCallbackShim(handle);

      expect(window.cancelIdleCallback).toHaveBeenCalledWith(42);
    });
  });

  describe('when requestIdleCallback is not available', () => {
    beforeEach(() => {
      vi.stubGlobal('window', {
        setTimeout: vi.fn(() => 99),
        clearTimeout: vi.fn(),
      });
    });

    it('should fall back to setTimeout', () => {
      const callback = vi.fn();
      const handle = requestIdleCallbackShim(callback);

      expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1);
      expect(handle.native).toBe(false);
      expect(handle.id).toBe(99);
    });

    it('should provide a synthetic deadline with timeRemaining', () => {
      let capturedDeadline: IdleDeadline | undefined;
      vi.stubGlobal('window', {
        setTimeout: vi.fn((cb: () => void) => {
          cb();
          return 99;
        }),
        clearTimeout: vi.fn(),
      });

      requestIdleCallbackShim((deadline) => {
        capturedDeadline = deadline;
      });

      expect(capturedDeadline).toBeDefined();
      expect(capturedDeadline?.didTimeout).toBe(false);
      expect(capturedDeadline?.timeRemaining()).toBeGreaterThan(0);
      expect(capturedDeadline?.timeRemaining()).toBeLessThanOrEqual(50);
    });

    it('should cancel via clearTimeout', () => {
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
      const handle = { id: 99, native: false as const };
      cancelIdleCallbackShim(handle);

      expect(clearTimeoutSpy).toHaveBeenCalledWith(99);
    });
  });
});
