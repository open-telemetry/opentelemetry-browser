/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span } from '@opentelemetry/api';
import { ROOT_CONTEXT, trace } from '@opentelemetry/api';

type StoredRecord<TData> = TData & { ctx: Context };

const MAX_CAPACITY = 1000;

/**
 * Base class for sharing OTel span context between two instrumentations that
 * observe the same events from different angles.
 *
 * The producing instrumentation calls `register()` when a span ends; the
 * consuming instrumentation calls `getContext()` to retrieve the span context
 * associated with the event it is processing.
 *
 * @typeParam TData - Registration payload. Must include enough info to derive a `key` string
 *   which will be used as the primary index, plus any implementation-specific fields needed to
 *   disambiguate concurrent operations (e.g. timing windows for network spans).
 * @typeParam TLookup - The object the consuming instrumentation passes to
 *   `getContext` and `unregister` (e.g. a `PerformanceResourceTiming` entry).
 */
export abstract class ContextRegistry<TData, TLookup> {
  protected _records = new Map<string, StoredRecord<TData>[]>();
  private _usedKeys: string[] = [];

  /** Store the span context for the given data, key is resolved by getDataKey(). */
  register(span: Span, data: TData): void {
    const ctx = trace.setSpan(ROOT_CONTEXT, span);
    const key = this.getDataKey(data);
    const list = this._records.get(key) ?? [];
    list.push({ ...data, ctx });
    this._records.set(key, list);

    // To keep track of the items added we just need the keys. Removing the oldest
    // bocomes only keeping the key used at that time and remove the 1st element of
    // the list under that key (since we are pushing)

    // Keep the key used for registration
    this._usedKeys.push(key);
    if (this._usedKeys.length > MAX_CAPACITY) {
      // 1st key of the array is the oldest
      const oldestKey = this._usedKeys.shift() as string;
      // and 1st item on the list is the oldest
      const oldestList = this._records.get(oldestKey) || [];
      oldestList.shift();
    }
  }

  /**
   * Remove the record that matches `lookup`. If no matching record exists this
   * is a no-op. Deletes the key entirely once all records under it are removed.
   */
  unregister(lookup: TLookup): void {
    const key = this.getLookupKey(lookup);
    const ctx = this.getContext(lookup);
    if (ctx === undefined) {
      return;
    }

    const list = this._records.get(key);
    if (!list) {
      return;
    }

    const filtered = list.filter((r) => r.ctx !== ctx);
    if (filtered.length === 0) {
      this._records.delete(key);
    } else {
      this._records.set(key, filtered);
    }
  }

  /** Return the index key for the given data object. */
  abstract getDataKey(data: TData): string;

  /** Return the index key for the given lookup object. */
  abstract getLookupKey(lookup: TLookup): string;

  /**
   * Return the OTel context for the record that matches `lookup`, or
   * `undefined` if no match is found.
   */
  abstract getContext(lookup: TLookup): Context | undefined;
}
