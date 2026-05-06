/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentTracker } from './DocumentTracker.ts';

describe('DocumentTracker', () => {
  let tracker: DocumentTracker;

  beforeEach(() => {
    tracker = new DocumentTracker();
  });

  afterEach(() => {
    tracker.stop();
  });

  it('fires observers when history.pushState is called', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();

    history.pushState({}, '', '/new-route');

    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledWith(window.location.href);
  });

  it('fires observers when history.replaceState is called', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();

    history.replaceState({}, '', '/replaced');

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('fires observers on popstate events', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('fires observers on hashchange events', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();

    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('stops firing observers after stop()', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();
    tracker.stop();

    history.pushState({}, '', '/after-stop');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(observer).not.toHaveBeenCalled();
  });

  it('restores original history methods on stop()', () => {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    tracker.start();
    expect(history.pushState).not.toBe(originalPushState);
    expect(history.replaceState).not.toBe(originalReplaceState);

    tracker.stop();
    expect(history.pushState).toBe(originalPushState);
    expect(history.replaceState).toBe(originalReplaceState);
  });

  it('is idempotent across multiple start() calls', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();
    tracker.start();

    history.pushState({}, '', '/idempotent');

    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after removeObserver()', () => {
    const observer = vi.fn();
    tracker.addObserver(observer);
    tracker.start();
    tracker.removeObserver(observer);

    history.pushState({}, '', '/no-longer-listening');

    expect(observer).not.toHaveBeenCalled();
  });
});
