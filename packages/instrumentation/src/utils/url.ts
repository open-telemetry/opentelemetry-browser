/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

const SENSITIVE_PARAMS = [
  'password',
  'passwd',
  'secret',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'jwt',
  'session',
  'sessionid',
  'key',
  'private_key',
  'client_secret',
  'client_id',
  'signature',
  'hash',
];

/**
 * Default URL sanitization function that redacts credentials and sensitive query parameters.
 * This is the default implementation used when no custom sanitizeUrl callback is provided.
 *
 * @param url - The URL to sanitize
 * @returns The sanitized URL with credentials and sensitive parameters redacted
 */
export function defaultSanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.username || urlObj.password) {
      urlObj.username = 'REDACTED';
      urlObj.password = 'REDACTED';
    }
    for (const param of SENSITIVE_PARAMS) {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, 'REDACTED');
      }
    }
    return urlObj.toString();
  } catch {
    let sanitized = url.replace(/\/\/[^:/@]+:[^/@]+@/, '//REDACTED:REDACTED@');
    for (const param of SENSITIVE_PARAMS) {
      const regex = new RegExp(`([?&]${param}(?:%3D|=))[^&]*`, 'gi');
      sanitized = sanitized.replace(regex, '$1REDACTED');
    }
    return sanitized;
  }
}

/**
 * Parses url using URL constructor or fallback to anchor element.
 * @param url
 */
export function parseUrl(url: string): URL {
  return new URL(url, document?.baseURI || location?.href);
}

/**
 * Tells if the given URL matches any of the string|RegExp provided in the list
 * @param url
 * @param urlsToMatch
 */
export function matchesUrl(
  url: string,
  urlsToMatch?: Array<string | RegExp>,
): boolean {
  if (!urlsToMatch) {
    return false;
  }

  for (const urlToMatch of urlsToMatch) {
    if (typeof urlToMatch === 'string') {
      if (url === urlToMatch) {
        return true;
      }
    } else if (url.match(urlToMatch)) {
      return true;
    }
  }
  return false;
}

const HTTP_PORT_FROM_PROTOCOL: { [key: string]: string } = {
  'https:': '443',
  'http:': '80',
};
/**
 * Extracts the server port fromt the given URL object
 */
export function serverPortFromUrl(url: URL): number | undefined {
  const serverPort = Number(url.port || HTTP_PORT_FROM_PROTOCOL[url.protocol]);
  // Guard with `if (serverPort)` because `Number('') === 0`.
  if (serverPort && !Number.isNaN(serverPort)) {
    return serverPort;
  } else {
    return undefined;
  }
}
