/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_FULL,
} from '@opentelemetry/semantic-conventions';
import { expect } from 'vitest';
import type { OtlpKeyValue, OtlpSpan } from '../../utils/test-collector.ts';

export function attrOf(span: OtlpSpan, key: string): OtlpKeyValue['value'] {
  return span.attributes.find((a) => a.key === key)?.value ?? {};
}

const CORE_REQUEST_ATTRS = [
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_URL_FULL,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
];

/**
 * Attributes that must match between the old (`@opentelemetry/instrumentation-fetch`)
 * and new (`packages/instrumentation/src/fetch`) spans for *every* scenario,
 * because both implementations set them at span creation time, before either
 * one's error-handling paths can diverge.
 */
export function assertEquivalentRequestAttributes(
  oldSpan: OtlpSpan,
  newSpan: OtlpSpan,
): void {
  expect(newSpan.name).toBe(oldSpan.name);
  expect(newSpan.kind).toBe(oldSpan.kind);
  for (const key of CORE_REQUEST_ATTRS) {
    expect(attrOf(newSpan, key)).toEqual(attrOf(oldSpan, key));
  }
}

/**
 * Attributes describing the *outcome* of the request (status code, error
 * classification, span status). These only match between old and new for
 * scenarios where a real HTTP response was received (success, server error,
 * no-body).
 */
export function assertEquivalentOutcomeAttributes(
  oldSpan: OtlpSpan,
  newSpan: OtlpSpan,
): void {
  expect(newSpan.status.code).toBe(oldSpan.status.code);
  expect(attrOf(newSpan, ATTR_HTTP_RESPONSE_STATUS_CODE)).toEqual(
    attrOf(oldSpan, ATTR_HTTP_RESPONSE_STATUS_CODE),
  );
  expect(attrOf(newSpan, ATTR_ERROR_TYPE)).toEqual(
    attrOf(oldSpan, ATTR_ERROR_TYPE),
  );
}
