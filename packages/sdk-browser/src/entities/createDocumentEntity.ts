/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Entity } from './Entity.ts';

export const DOCUMENT_ENTITY_TYPE = 'browser.document';
export const ATTR_BROWSER_DOCUMENT_URL_FULL = 'browser.document.url.full';

export function createDocumentEntity(href: string): Entity {
  return {
    type: DOCUMENT_ENTITY_TYPE,
    identifier: { [ATTR_BROWSER_DOCUMENT_URL_FULL]: href },
  };
}
