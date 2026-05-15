/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseUrl } from './parseUrl.ts';
import { urlMatches } from './urlMatches.ts';

export type PropagateTraceHeaderCorsUrls =
  | string
  | RegExp
  | Array<string | RegExp>;

export function shouldPropagateTraceHeaders(
  spanUrl: string,
  propagateTraceHeaderCorsUrls?: PropagateTraceHeaderCorsUrls,
): boolean {
  let corsUrls: Array<string | RegExp> = [];

  if (propagateTraceHeaderCorsUrls) {
    corsUrls = Array.isArray(propagateTraceHeaderCorsUrls)
      ? propagateTraceHeaderCorsUrls
      : [propagateTraceHeaderCorsUrls];
  }

  const parsed = parseUrl(spanUrl);
  if (parsed.origin === location.origin) {
    return true;
  }

  return corsUrls.some((p) => urlMatches(spanUrl, p));
}
