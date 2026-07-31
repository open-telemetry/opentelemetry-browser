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
  protected _recordsByKey = new Map<string, StoredRecord<TData>[]>();
  private _recordsList: StoredRecord<TData>[] = [];

  /** Store the span context for the given data, key is resolved . */
  register(span: Span, data: TData): void {
    const ctx = trace.setSpan(ROOT_CONTEXT, span);
    const key = this.getDataKey(data);
    const list = this._recordsByKey.get(key) ?? [];
    const record = { ...data, ctx };

    // Set record into the map for faster lookup and in the
    // list to track the size
    list.push(record);
    this._recordsByKey.set(key, list);
    this._recordsList.push(record);

    // If capacity is exceeded remove the oldest (1st in the array)
    if (this._recordsList.length > MAX_CAPACITY) {
      const oldestRecord = this._recordsList.shift();
      if (oldestRecord) {
        const oldestKey = this.getDataKey(oldestRecord);
        const oldestCtx = oldestRecord.ctx;
        this.removeByKey(oldestKey, oldestCtx);
      }
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

    // Remove form the lookup map and from the global list
    // to keep size up to date
    this.removeByKey(key, ctx);
    const index = this._recordsList.findIndex((r) => {
      const k = this.getDataKey(r);
      return key === k && ctx === r.ctx;
    });
    if (index > -1) {
      this._recordsList.splice(index, 1);
    }
  }

  /**
   * Remove a record from the records sub-list of the given key
   */
  private removeByKey(key: string, ctx: Context): void {
    const list = this._recordsByKey.get(key);
    if (!list) {
      return;
    }

    const filtered = list.filter((r) => r.ctx !== ctx);
    if (filtered.length === 0) {
      this._recordsByKey.delete(key);
    } else {
      this._recordsByKey.set(key, filtered);
    }
  }

  /**
   * Return the size number of records stored in the registry
   */
  size(): number {
    return this._recordsList.length;
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
