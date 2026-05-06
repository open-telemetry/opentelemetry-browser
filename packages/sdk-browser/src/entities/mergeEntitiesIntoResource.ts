/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';
import type { Resource } from '@opentelemetry/resources';
import { resourceFromAttributes } from '@opentelemetry/resources';
import type { Entity } from './Entity.ts';

/**
 * Returns a new Resource that is the base merged with the union of all entity
 * attributes. Base values take precedence on collision — entities never
 * overwrite explicitly-configured base attributes.
 *
 * When two entities specify the same attribute, the later entity in the array
 * wins (last-write).
 */
export function mergeEntitiesIntoResource(
  base: Resource,
  entities: readonly Entity[],
): Resource {
  if (entities.length === 0) {
    return base;
  }
  const entityAttrs: Attributes = {};
  for (const entity of entities) {
    Object.assign(entityAttrs, entity.identifier);
    if (entity.attributes) {
      Object.assign(entityAttrs, entity.attributes);
    }
  }
  // Resource.merge: "the other Resource takes precedence on collision".
  // We want base to win, so put base in the `other` position.
  return resourceFromAttributes(entityAttrs).merge(base);
}
