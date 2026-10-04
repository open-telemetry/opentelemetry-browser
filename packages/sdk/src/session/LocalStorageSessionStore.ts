/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Session } from './types/Session.ts';
import type { SessionStore } from './types/SessionStore.ts';

const SESSION_STORAGE_KEY = 'opentelemetry-session';

// localStorage throws where storage is blocked or full, so every access is guarded.
export class LocalStorageSessionStore implements SessionStore {
  save(session: Session): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      }
    } catch {
      // the session stays in memory only
    }

    return Promise.resolve();
  }

  get(): Promise<Session | null> {
    try {
      if (typeof localStorage === 'undefined') {
        return Promise.resolve(null);
      }

      const sessionData = localStorage.getItem(SESSION_STORAGE_KEY);
      if (sessionData) {
        return Promise.resolve(JSON.parse(sessionData) as Session);
      }
    } catch {
      // blocked storage or invalid JSON
    }
    return Promise.resolve(null);
  }
}
