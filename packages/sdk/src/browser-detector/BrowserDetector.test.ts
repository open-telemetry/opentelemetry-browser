/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ATTR_USER_AGENT_ORIGINAL } from '@opentelemetry/semantic-conventions';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserDetector } from './BrowserDetector.ts';
import {
  ATTR_BROWSER_BRANDS,
  ATTR_BROWSER_LANGUAGE,
  ATTR_BROWSER_MOBILE,
  ATTR_BROWSER_PLATFORM,
} from './semconv.ts';
import type { UserAgentData } from './types.ts';

function setUserAgentData(userAgentData: UserAgentData | undefined): void {
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: userAgentData,
  });
}

describe('browserDetector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'userAgentData');
  });

  it('detects browser attributes from user agent client hints', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('test-agent');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    setUserAgentData({
      platform: 'Windows',
      brands: [
        { brand: 'Chromium', version: '140' },
        { brand: 'Not;A=Brand', version: '99' },
      ],
      mobile: false,
    });

    expect(browserDetector.detect().attributes).toEqual({
      [ATTR_BROWSER_PLATFORM]: 'Windows',
      [ATTR_BROWSER_BRANDS]: ['Chromium 140', 'Not;A=Brand 99'],
      [ATTR_BROWSER_MOBILE]: false,
      [ATTR_BROWSER_LANGUAGE]: 'en-US',
      [ATTR_USER_AGENT_ORIGINAL]: 'test-agent',
    });
  });

  it('falls back to user agent and language without client hints', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('test-agent');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
    setUserAgentData(undefined);

    expect(browserDetector.detect().attributes).toEqual({
      [ATTR_BROWSER_LANGUAGE]: 'fr-FR',
      [ATTR_USER_AGENT_ORIGINAL]: 'test-agent',
    });
  });

  it('returns an empty resource when browser identification is unavailable', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('');
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('');
    setUserAgentData(undefined);

    expect(browserDetector.detect().attributes).toEqual({});
  });
});
