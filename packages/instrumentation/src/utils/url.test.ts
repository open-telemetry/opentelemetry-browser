/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  defaultSanitizeUrl,
  matchesUrl,
  parseUrl,
  serverPortFromUrl,
} from './url.ts';

describe('parseUrl', () => {
  const urlFields: Array<keyof URL> = [
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
    const url = { port: 'foo' } as URL;

    expect(serverPortFromUrl(url)).toBeUndefined();
  });

  it('should return undefined if the port is not defined and protocol is not known', () => {
    const url = { port: '', protocol: 'bar' } as URL;

    expect(serverPortFromUrl(url)).toBeUndefined();
  });
});
describe('defaultSanitizeUrl', () => {
  it('redacts S3 signed URL params including security token', () => {
    expect(
      defaultSanitizeUrl(
        'https://bucket.s3.amazonaws.com/a.js?X-Amz-Credential=c&X-Amz-Security-Token=t&X-Amz-Signature=s',
      ),
    ).toBe(
      'https://bucket.s3.amazonaws.com/a.js?X-Amz-Credential=REDACTED&X-Amz-Security-Token=REDACTED&X-Amz-Signature=REDACTED',
    );
  });

  it('redacts Google Cloud Storage signed URL params', () => {
    expect(
      defaultSanitizeUrl(
        'https://storage.googleapis.com/b/a.js?X-Goog-Signature=s',
      ),
    ).toBe('https://storage.googleapis.com/b/a.js?X-Goog-Signature=REDACTED');
  });

  it('redacts Azure SAS sig param while leaving normal params intact', () => {
    expect(
      defaultSanitizeUrl(
        'https://acct.blob.core.windows.net/c/a.js?sv=2024&sig=s',
      ),
    ).toBe('https://acct.blob.core.windows.net/c/a.js?sv=2024&sig=REDACTED');
  });

  it('redacts sensitive params in relative URLs with fragments', () => {
    expect(defaultSanitizeUrl('/cb#access_token=abc&state=1')).toBe(
      '/cb#access_token=REDACTED&state=1',
    );
  });

  it('preserves fragment anchors in relative URLs when redacting query params', () => {
    expect(defaultSanitizeUrl('/a.js?token=t#step2')).toBe(
      '/a.js?token=REDACTED#step2',
    );
  });

  it('redacts id_token in fragment', () => {
    expect(
      defaultSanitizeUrl('https://app.example/cb#id_token=abc&state=1'),
    ).toBe('https://app.example/cb#id_token=REDACTED&state=1');
  });

  it('redacts signed URL params', () => {
    expect(
      defaultSanitizeUrl(
        'https://b.s3.amazonaws.com/f?X-Amz-Signature=abc&X-Amz-Credential=xyz',
      ),
    ).toBe(
      'https://b.s3.amazonaws.com/f?X-Amz-Signature=REDACTED&X-Amz-Credential=REDACTED',
    );
  });

  it('redacts AWSAccessKeyId and Signature', () => {
    expect(
      defaultSanitizeUrl(
        'https://x.com/a?AWSAccessKeyId=AK&Signature=s&Expires=1',
      ),
    ).toBe(
      'https://x.com/a?AWSAccessKeyId=REDACTED&Signature=REDACTED&Expires=1',
    );
  });

  it('redacts sensitive params in a query-shaped fragment', () => {
    expect(
      defaultSanitizeUrl(
        'https://app.example.com/cb#access_token=abc&state=xyz',
      ),
    ).toBe('https://app.example.com/cb#access_token=REDACTED&state=xyz');
  });

  it('leaves route and anchor fragments alone', () => {
    expect(defaultSanitizeUrl('https://app.example.com/#/users/1')).toBe(
      'https://app.example.com/#/users/1',
    );
    expect(defaultSanitizeUrl('https://x.com/#section-2')).toBe(
      'https://x.com/#section-2',
    );
  });
  it('redacts tokens in fragments with a leading &', () => {
    expect(
      defaultSanitizeUrl(
        'https://app.example.com/cb#&access_token=abc&state=1',
      ),
    ).toBe('https://app.example.com/cb#access_token=REDACTED&state=1');
  });

  it('redacts tokens in relative URLs with a leading & in fragment', () => {
    expect(defaultSanitizeUrl('/cb#&access_token=abc&state=1')).toBe(
      '/cb#&access_token=REDACTED&state=1',
    );
  });
});
