/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Entity } from './Entity.ts';

export const SESSION_ENTITY_TYPE = 'browser.session';
export const ATTR_SESSION_ID = 'session.id';

export function createSessionEntity(sessionId: string): Entity {
  return {
    type: SESSION_ENTITY_TYPE,
    identifier: { [ATTR_SESSION_ID]: sessionId },
  };
}
