/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
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
    } catch (error) {
      diag.debug(
        'Session not saved to localStorage, it stays in memory only',
        error,
      );
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
    } catch (error) {
      // blocked storage or invalid JSON
      diag.debug('Could not read the session from localStorage', error);
    }
    return Promise.resolve(null);
  }
}
