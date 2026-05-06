/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';

/**
 * Shape of a browser entity, following the OTEP entity model:
 * - `type` is the entity kind (e.g. `browser.session`, `browser.document`).
 * - `identifier` holds the attributes that uniquely identify the entity instance.
 * - `attributes` (optional) holds non-identifying descriptive attributes.
 */
export interface Entity {
  type: string;
  identifier: Attributes;
  attributes?: Attributes;
}
