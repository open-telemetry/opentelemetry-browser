/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageSessionStore } from './LocalStorageSessionStore.ts';
import type { Session } from './types/Session.ts';

describe('LocalStorageSessionStore', () => {
  let store: LocalStorageSessionStore;
  let getItemSpy: ReturnType<typeof vi.spyOn>;
  let setItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    store = new LocalStorageSessionStore();
    getItemSpy = vi.spyOn(globalThis.localStorage, 'getItem');
    setItemSpy = vi.spyOn(globalThis.localStorage, 'setItem');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    globalThis.localStorage.clear();
  });

  it('calls localStorage.setItem on save', async () => {
    const session: Session = { id: 'id', startTimestamp: Date.now() };
    await store.save(session);
    expect(setItemSpy).toHaveBeenCalledOnce();
  });

  it('calls localStorage.getItem on get', async () => {
    await store.get();
    expect(getItemSpy).toHaveBeenCalledOnce();
  });

  it('saves and retrieves the same session', async () => {
    const session: Session = {
      id: 'integration-id',
      startTimestamp: 1234567890,
    };

    await store.save(session);
    const retrieved = await store.get();

    expect(retrieved).toEqual(session);
  });

  it('returns null if localStorage is not available', async () => {
    vi.stubGlobal('localStorage', undefined);
    const retrieved = await store.get();
    expect(retrieved).toBeNull();
  });

  it('returns null if stored session is invalid', async () => {
    getItemSpy.mockReturnValue('invalid-json');
    const retrieved = await store.get();
    expect(retrieved).toBeNull();
  });
});
