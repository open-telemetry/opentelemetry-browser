/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export { isUrlIgnored } from './isUrlIgnored.ts';
export { parseUrl } from './parseUrl.ts';
export { serverPortFromUrl } from './serverPortFromUrl.ts';
export {
  type PropagateTraceHeaderCorsUrls,
  shouldPropagateTraceHeaders,
} from './shouldPropagateTraceHeaders.ts';
export { urlMatches } from './urlMatches.ts';
