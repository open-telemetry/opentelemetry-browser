/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocumentProvider {
  /**
   * Full URL of the current document, or `null` when the URL is unavailable
   * or has been suppressed by the implementation.
   */
  getDocumentUrl(): string | null;
}
