/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { createDocumentEntity } from './createDocumentEntity.ts';
import { DocumentTracker } from './DocumentTracker.ts';
import type { EntityAwareLoggerProvider } from './EntityAwareLoggerProvider.ts';

/**
 * Binds a `DocumentTracker` to the given `EntityAwareLoggerProvider`: stamps
 * the current `browser.document.url.full` onto the provider's resource and
 * keeps it in sync as the SPA URL changes (popstate, hashchange, pushState,
 * replaceState).
 *
 * Returns the underlying tracker so callers can stop it, register additional
 * observers (e.g. to update UI), or read the current href.
 */
export function trackDocument(
  provider: EntityAwareLoggerProvider,
): DocumentTracker {
  const tracker = new DocumentTracker();
  tracker.addObserver((href) => {
    provider.setEntity(createDocumentEntity(href));
  });
  tracker.start();
  provider.setEntity(createDocumentEntity(tracker.getHref()));
  return tracker;
}
