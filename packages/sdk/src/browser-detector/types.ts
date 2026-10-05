/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserAgentData {
  brands: Array<{ brand: string; version: string }>;
  platform: string;
  mobile: boolean;
}
