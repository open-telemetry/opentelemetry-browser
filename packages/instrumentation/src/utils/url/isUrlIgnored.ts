/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { urlMatches } from './urlMatches.ts';

export function isUrlIgnored(
  url: string,
  ignoreUrls?: Array<string | RegExp>,
): boolean {
  if (!ignoreUrls || ignoreUrls.length === 0) {
    return false;
  }

  return ignoreUrls.some((p) => urlMatches(url, p));
}
