/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { diag } from '@opentelemetry/api';
import type { Resource, ResourceDetector } from '@opentelemetry/resources';
import {
  defaultResource,
  detectResources,
  resourceFromAttributes,
} from '@opentelemetry/resources';
import {
  ATTR_TELEMETRY_DISTRO_NAME,
  ATTR_TELEMETRY_DISTRO_VERSION,
  ATTR_TELEMETRY_SDK_LANGUAGE,
  ATTR_TELEMETRY_SDK_NAME,
  ATTR_TELEMETRY_SDK_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { CommonConfig } from './types.ts';

export function createResource(
  config?: CommonConfig & { resource?: Resource },
  detectors?: ResourceDetector[],
): Resource {
  // Types already reject these combinations, warn for untyped callers
  if (config?.resource) {
    if (
      detectors?.length ||
      config.resourceAttributes ||
      config.serviceName ||
      config.serviceVersion
    ) {
      diag.warn(
        'A resource was provided. resourceDetectors, resourceAttributes, serviceName and serviceVersion are ignored.',
      );
    }
    return config.resource;
  }

  const attributes = { ...config?.resourceAttributes };
  if (config?.serviceName) {
    attributes['service.name'] = config.serviceName;
  }
  if (config?.serviceVersion) {
    attributes['service.version'] = config.serviceVersion;
  }
  const {
    [ATTR_TELEMETRY_DISTRO_NAME]: distroName,
    [ATTR_TELEMETRY_DISTRO_VERSION]: distroVersion,
    ...applicationAttributes
  } = attributes;

  const defaults = defaultResource();
  const sdkAttributes = resourceFromAttributes({
    [ATTR_TELEMETRY_SDK_LANGUAGE]:
      defaults.attributes[ATTR_TELEMETRY_SDK_LANGUAGE],
    [ATTR_TELEMETRY_SDK_NAME]: defaults.attributes[ATTR_TELEMETRY_SDK_NAME],
    [ATTR_TELEMETRY_SDK_VERSION]:
      defaults.attributes[ATTR_TELEMETRY_SDK_VERSION],
  });

  return defaults
    .merge(
      resourceFromAttributes({
        [ATTR_TELEMETRY_DISTRO_NAME]: distroName,
        [ATTR_TELEMETRY_DISTRO_VERSION]: distroVersion,
      }),
    )
    .merge(detectResources({ detectors }))
    .merge(resourceFromAttributes(applicationAttributes))
    .merge(sdkAttributes);
}
