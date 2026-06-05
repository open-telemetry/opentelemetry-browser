/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { URLLike } from './url.ts';
import { matchesUrl, parseUrl, serverPortFromUrl } from './url.ts';

describe('parseUrl', () => {
  const urlFields: Array<keyof URLLike> = [
    'hash',
    'host',
    'hostname',
    'href',
    'origin',
    'password',
    'pathname',
    'port',
    'protocol',
    'search',
    'username',
  ];
  it('should parse url', () => {
    const url = parseUrl('https://opentelemetry.io/foo');
    urlFields.forEach((field) => {
      expect(typeof url[field]).toBe('string');
    });
  });

  it('should parse relative url', () => {
    const url = parseUrl('/foo');
    urlFields.forEach((field) => {
      expect(typeof url[field]).toBe('string');
    });
  });
});

describe('matchesUrl', () => {
  const urlToTest = 'http://myaddress.com/somepath';

  describe('when urls to match are undefined', () => {
    it('should return false', () => {
      expect(matchesUrl(urlToTest)).toBe(false);
    });
  });

  describe('when urls to match are empty', () => {
    it('should return false', () => {
      expect(matchesUrl(urlToTest, [])).toBe(false);
    });
  });

  describe('when urls to match is the same as url', () => {
    it('should return true', () => {
      expect(matchesUrl(urlToTest, ['http://myaddress.com/somepath'])).toBe(
        true,
      );
    });
  });

  describe('when url is part of urls to match', () => {
    it('should return false', () => {
      expect(matchesUrl(urlToTest, ['http://myaddress.com/some'])).toBe(false);
    });
  });

  describe('when urls to match is part of url - REGEXP', () => {
    it('should return true', () => {
      expect(matchesUrl(urlToTest, [/.+?myaddress\.com/])).toBe(true);
    });
  });

  describe('when url is part of urls to match - REGEXP', () => {
    it('should return false', () => {
      expect(
        matchesUrl(urlToTest, [/http:\/\/myaddress\.com\/somepath2/]),
      ).toBe(false);
    });
  });

  describe('when regex has global flag', () => {
    it('should return true', () => {
      const urlsToMatch = [/myaddr/g];
      // Run test multiple times to ensure same result (git.io/JimS1)
      for (let i = 0; i < 3; i++) {
        expect(matchesUrl(urlToTest, urlsToMatch)).toBe(true);
      }
    });
  });
});

describe('serverPortFromUrl', () => {
  it('should return the default port based on the protocol', () => {
    const secureUrl = parseUrl('https://opentelemetry.io/foo');
    const insecureUrl = parseUrl('http://opentelemetry.io/foo');

    expect(serverPortFromUrl(secureUrl)).toBe(443);
    expect(serverPortFromUrl(insecureUrl)).toBe(80);
  });

  it('should return the port defined in the URL', () => {
    const url = parseUrl('https://opentelemetry.io:8443/foo');

    expect(serverPortFromUrl(url)).toBe(8443);
  });

  it('should return undefined if the port is not a number', () => {
    const url = { port: 'foo' } as URLLike;

    expect(serverPortFromUrl(url)).toBeUndefined();
  });

  it('should return undefined if the port is not defined and protocol is not known', () => {
    const url = { port: '', protocol: 'bar' } as URLLike;

    expect(serverPortFromUrl(url)).toBeUndefined();
  });
});
