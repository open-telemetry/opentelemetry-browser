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
    // If URL parsing fails, redact credentials and sensitive query parameters
    // using regexes. The credential regex uses a restricted character class to
    // avoid polynomial time complexity.
    let sanitized = url.replace(/\/\/[^:/@]+:[^/@]+@/, '//REDACTED:REDACTED@');

    for (const param of SENSITIVE_PARAMS) {
      // Match param=value or param%3Dvalue (URL encoded)
      const regex = new RegExp(`([?&]${param}(?:%3D|=))[^&]*`, 'gi');
      sanitized = sanitized.replace(regex, '$1REDACTED');
    }

    return sanitized;
  }
}

/**
 * Determines if navigation between two URLs represents a hash change.
 * A hash change is true if the URLs are the same except for the hash part,
 * AND the hash is being added or changed (not removed).
 *
 * @param fromUrl - The source URL
 * @param toUrl - The destination URL
 * @returns true if this represents a hash change navigation
 */
export function isHashChange(fromUrl: string, toUrl: string): boolean {
  try {
    const a = new URL(fromUrl, window.location.origin);
    const b = new URL(toUrl, window.location.origin);
    const sameBase =
      a.origin === b.origin &&
      a.pathname === b.pathname &&
      a.search === b.search;
    const fromHasHash = a.hash !== '';
    const toHasHash = b.hash !== '';
    const hashesAreDifferent = a.hash !== b.hash;

    return (
      sameBase &&
      hashesAreDifferent &&
      ((fromHasHash && toHasHash) || (!fromHasHash && toHasHash))
    );
  } catch {
    const fromBase = fromUrl.split('#')[0];
    const toBase = toUrl.split('#')[0];
    const fromHash = fromUrl.split('#')[1] ?? '';
    const toHash = toUrl.split('#')[1] ?? '';

    const sameBase = fromBase === toBase;
    const hashesAreDifferent = fromHash !== toHash;
    const notRemovingHash = toHash !== '';

    return sameBase && hashesAreDifferent && notRemovingHash;
  }
}
