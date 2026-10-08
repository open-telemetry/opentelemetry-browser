/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Attributes } from '@opentelemetry/api';
import { diag } from '@opentelemetry/api';
import type {
  DetectedResource,
  ResourceDetectionConfig,
  ResourceDetector,
} from '@opentelemetry/resources';
import { emptyResource } from '@opentelemetry/resources';
import { ATTR_USER_AGENT_ORIGINAL } from '@opentelemetry/semantic-conventions';
import {
  ATTR_BROWSER_BRANDS,
  ATTR_BROWSER_LANGUAGE,
  ATTR_BROWSER_MOBILE,
  ATTR_BROWSER_PLATFORM,
} from './semconv.ts';
import type { UserAgentData } from './types.ts';

class BrowserDetector implements ResourceDetector {
  detect(_config?: ResourceDetectionConfig): DetectedResource {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return emptyResource();
    }

    const attributes = getBrowserAttributes();
    if (
      !attributes[ATTR_USER_AGENT_ORIGINAL] &&
      !attributes[ATTR_BROWSER_PLATFORM]
    ) {
      diag.debug(
        'BrowserDetector failed: Unable to find required browser resources.',
      );
      return emptyResource();
    }

    return { attributes };
  }
}

function getBrowserAttributes(): Attributes {
  const attributes: Attributes = {};
  /* eslint-disable baseline-js/use-baseline */
  const userAgentData = (
    navigator as Navigator & { userAgentData?: UserAgentData }
  ).userAgentData;
  /* eslint-enable baseline-js/use-baseline */

  if (userAgentData) {
    attributes[ATTR_BROWSER_PLATFORM] = userAgentData.platform;
    attributes[ATTR_BROWSER_BRANDS] = userAgentData.brands.map(
      ({ brand, version }) => `${brand} ${version}`,
    );
    attributes[ATTR_BROWSER_MOBILE] = userAgentData.mobile;
  }

  attributes[ATTR_USER_AGENT_ORIGINAL] = navigator.userAgent;
  attributes[ATTR_BROWSER_LANGUAGE] = navigator.language;
  return attributes;
}

export const browserDetector = new BrowserDetector();
