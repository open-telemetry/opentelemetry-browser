/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import { describe, expect, it, vi } from 'vitest';
import { createResource } from './resource.ts';

describe('createResource', () => {
  it('uses the default resource without browser detection', () => {
    expect(createResource().attributes).toEqual(defaultResource().attributes);
  });

  it('merges detectors in order and lets explicit attributes override detection', () => {
    const first = {
      detect: vi.fn(() => ({
        attributes: {
          'service.name': 'detected-service',
          'service.version': 'detected-version',
          'browser.language': 'en-US',
          'browser.mobile': false,
          'detector.order': 'first',
        },
      })),
    };
    const second = {
      detect: vi.fn(() => ({
        attributes: {
          'browser.language': 'fr-FR',
          'detector.order': 'second',
        },
      })),
    };

    const resource = createResource(
      { resourceAttributes: { 'browser.language': 'de-DE' } },
      [first, second],
    );

    expect(first.detect).toHaveBeenCalledOnce();
    expect(second.detect).toHaveBeenCalledOnce();
    expect(resource.attributes).toMatchObject({
      'service.name': 'detected-service',
      'service.version': 'detected-version',
      'browser.language': 'de-DE',
      'browser.mobile': false,
      'detector.order': 'second',
    });
  });

  it('keeps SDK-owned attributes over detected and explicit values', () => {
    const sdkAttributes = {
      'telemetry.sdk.name': 'other-sdk',
      'telemetry.sdk.language': 'other-language',
      'telemetry.sdk.version': 'other-version',
    };
    const resource = createResource({ resourceAttributes: sdkAttributes }, [
      { detect: () => ({ attributes: sdkAttributes }) },
    ]);
    const defaults = defaultResource().attributes;

    for (const key of Object.keys(sdkAttributes)) {
      expect(resource.attributes[key]).toBe(defaults[key]);
    }
  });

  it('sets service name and version without changing configured attributes', () => {
    const resourceAttributes = Object.freeze({
      'service.name': 'attribute-service',
      'service.version': 'attribute-version',
    });

    const resource = createResource({
      serviceName: 'my-service',
      serviceVersion: '1.0.0',
      resourceAttributes,
    });

    expect(resource.attributes).toMatchObject({
      'service.name': 'my-service',
      'service.version': '1.0.0',
    });
    expect(resourceAttributes).toEqual({
      'service.name': 'attribute-service',
      'service.version': 'attribute-version',
    });
  });

  it('keeps detector-supplied distro attributes over explicit values', () => {
    const resource = createResource(
      {
        resourceAttributes: {
          'telemetry.distro.name': 'explicit-distro',
          'telemetry.distro.version': 'explicit-version',
          'service.name': 'my-service',
        },
      },
      [
        {
          detect: () => ({
            attributes: {
              'telemetry.distro.name': 'my-distro',
              'telemetry.distro.version': '1.0.0',
              'service.name': 'detected-service',
            },
          }),
        },
      ],
    );

    expect(resource.attributes).toMatchObject({
      'telemetry.distro.name': 'my-distro',
      'telemetry.distro.version': '1.0.0',
      'service.name': 'my-service',
    });
  });

  it('keeps explicit distro attributes when detectors do not supply them', () => {
    const resource = createResource({
      resourceAttributes: {
        'telemetry.distro.name': 'my-distro',
        'telemetry.distro.version': '1.0.0',
      },
    });

    expect(resource.attributes).toMatchObject({
      'telemetry.distro.name': 'my-distro',
      'telemetry.distro.version': '1.0.0',
    });
  });

  it('uses a supplied resource unchanged without running detectors', () => {
    const resource = resourceFromAttributes(
      {
        'service.name': 'shared-service',
        'telemetry.distro.name': 'my-distro',
        'telemetry.distro.version': '1.0.0',
      },
      { schemaUrl: 'https://opentelemetry.io/schemas/1.43.0' },
    );
    const detector = { detect: vi.fn() };

    expect(
      createResource(
        {
          resource,
          serviceName: 'ignored-service',
          resourceAttributes: { 'telemetry.distro.name': 'ignored-distro' },
        },
        [detector],
      ),
    ).toBe(resource);
    expect(detector.detect).not.toHaveBeenCalled();
  });
});
