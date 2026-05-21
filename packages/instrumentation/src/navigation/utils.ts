/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

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
