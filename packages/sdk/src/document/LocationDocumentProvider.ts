/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import type { DocumentProvider } from './types/DocumentProvider.ts';

export interface LocationDocumentProviderConfig {
  /**
   * Hook to redact or normalize the document URL before it is attached to
   * telemetry. Use it to drop sensitive query parameters or to reduce the
   * cardinality of the attribute.
   *
   * TODO: as discussed during the SIG, long URLs with query parameters
   * may be out of scope for the document URL or contain sensitive information.
   * This provides an option to trim the full URL.
   *
   * @defaultValue undefined, meaning the URL is reported as-is
   */
  sanitizeUrl?: (url: string) => string;
}

/**
 * LocationDocumentProvider is a {@link DocumentProvider} that reads the
 * current document URL from `location.href` at the time the telemetry is
 * created, so it follows soft navigations without any extra bookkeeping.
 */
export class LocationDocumentProvider implements DocumentProvider {
  private _sanitizeUrl?: (url: string) => string;

  constructor(config: LocationDocumentProviderConfig = {}) {
    this._sanitizeUrl = config.sanitizeUrl;
  }

  getDocumentUrl(): string | null {
    // `location` is absent when the module is evaluated outside a browser,
    // for instance during server-side rendering.
    if (typeof location === 'undefined') {
      return null;
    }

    const url = location.href;
    if (!this._sanitizeUrl) {
      return url;
    }

    // This runs on every span start and every log emit, so a throwing hook
    // must not be allowed to break telemetry creation.
    try {
      return this._sanitizeUrl(url);
    } catch (error) {
      diag.error('sanitizeUrl hook failed', error);
      return null;
    }
  }
}
