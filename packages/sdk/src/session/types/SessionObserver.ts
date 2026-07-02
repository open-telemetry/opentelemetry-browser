/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Session } from './Session.ts';

export interface SessionObserver {
  onSessionStarted(newSession: Session, previousSession?: Session): void;
  onSessionEnded(session: Session): void;
}
