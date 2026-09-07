/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export { DocumentLogRecordProcessor } from './DocumentLogRecordProcessor.ts';
export { DocumentSpanProcessor } from './DocumentSpanProcessor.ts';
export type { LocationDocumentProviderConfig } from './LocationDocumentProvider.ts';
export { LocationDocumentProvider } from './LocationDocumentProvider.ts';
export { ATTR_BROWSER_DOCUMENT_URL_FULL } from './semconv.ts';
export type { DocumentProvider } from './types/DocumentProvider.ts';
export {
  createDocumentLogRecordProcessor,
  createDocumentSpanProcessor,
  createLocationDocumentProvider,
} from './utils.ts';
