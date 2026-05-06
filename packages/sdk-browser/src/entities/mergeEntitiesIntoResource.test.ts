/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { resourceFromAttributes } from '@opentelemetry/resources';
import { describe, expect, it } from 'vitest';
import type { Entity } from './Entity.ts';
import { mergeEntitiesIntoResource } from './mergeEntitiesIntoResource.ts';

describe('mergeEntitiesIntoResource', () => {
  it('returns the base resource when no entities are passed', () => {
    const base = resourceFromAttributes({ 'service.name': 'test' });
    const merged = mergeEntitiesIntoResource(base, []);
    expect(merged).toBe(base);
  });

  it('adds entity identifier attributes to the resource', () => {
    const base = resourceFromAttributes({ 'service.name': 'test' });
    const session: Entity = {
      type: 'browser.session',
      identifier: { 'session.id': 'abc' },
    };
    const merged = mergeEntitiesIntoResource(base, [session]);
    expect(merged.attributes).toEqual({
      'service.name': 'test',
      'session.id': 'abc',
    });
  });

  it('merges multiple entities of different types', () => {
    const base = resourceFromAttributes({ 'service.name': 'test' });
    const session: Entity = {
      type: 'browser.session',
      identifier: { 'session.id': 'abc' },
    };
    const document: Entity = {
      type: 'browser.document',
      identifier: { 'browser.document.url.full': 'https://example.com/a' },
    };
    const merged = mergeEntitiesIntoResource(base, [session, document]);
    expect(merged.attributes).toEqual({
      'service.name': 'test',
      'session.id': 'abc',
      'browser.document.url.full': 'https://example.com/a',
    });
  });

  it('lets base values win on collision', () => {
    const base = resourceFromAttributes({
      'service.name': 'test',
      'session.id': 'base-wins',
    });
    const session: Entity = {
      type: 'browser.session',
      identifier: { 'session.id': 'abc' },
    };
    const merged = mergeEntitiesIntoResource(base, [session]);
    expect(merged.attributes['session.id']).toBe('base-wins');
  });

  it('includes descriptive entity attributes alongside identifiers', () => {
    const base = resourceFromAttributes({ 'service.name': 'test' });
    const session: Entity = {
      type: 'browser.session',
      identifier: { 'session.id': 'abc' },
      attributes: { 'session.previous_id': 'xyz' },
    };
    const merged = mergeEntitiesIntoResource(base, [session]);
    expect(merged.attributes).toEqual({
      'service.name': 'test',
      'session.id': 'abc',
      'session.previous_id': 'xyz',
    });
  });

  it('lets later entities override earlier ones for the same attribute key', () => {
    const base = resourceFromAttributes({ 'service.name': 'test' });
    const earlier: Entity = {
      type: 'browser.document',
      identifier: { 'browser.document.url.full': 'https://example.com/a' },
    };
    const later: Entity = {
      type: 'browser.document',
      identifier: { 'browser.document.url.full': 'https://example.com/b' },
    };
    const merged = mergeEntitiesIntoResource(base, [earlier, later]);
    expect(merged.attributes['browser.document.url.full']).toBe(
      'https://example.com/b',
    );
  });
});
