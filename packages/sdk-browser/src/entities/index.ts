/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  ATTR_BROWSER_DOCUMENT_URL_FULL,
  createDocumentEntity,
  DOCUMENT_ENTITY_TYPE,
} from './createDocumentEntity.ts';
export {
  ATTR_SESSION_ID,
  createSessionEntity,
  SESSION_ENTITY_TYPE,
} from './createSessionEntity.ts';
export type { DocumentObserver } from './DocumentTracker.ts';
export { DocumentTracker } from './DocumentTracker.ts';
export type { Entity } from './Entity.ts';
export { EntityAwareLoggerProvider } from './EntityAwareLoggerProvider.ts';
export { mergeEntitiesIntoResource } from './mergeEntitiesIntoResource.ts';
export { trackDocument } from './trackDocument.ts';
