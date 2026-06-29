/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Context, Span } from '@opentelemetry/api';
import { ROOT_CONTEXT, trace } from '@opentelemetry/api';

type StoredRecord<TData> = TData & { ctx: Context };

/**
 * Base class for sharing OTel span context between two instrumentations that
 * observe the same events from different angles.
 *
 * The producing instrumentation calls `register()` when a span ends; the
 * consuming instrumentation calls `getContext()` to retrieve the span context
 * associated with the event it is processing.
 *
 * @typeParam TData - Registration payload. Must include a `key` string used
 *   as the primary index, plus any implementation-specific fields needed to
 *   disambiguate concurrent operations (e.g. timing windows for network spans).
 * @typeParam TLookup - The object the consuming instrumentation passes to
 *   `getContext` and `unregister` (e.g. a `PerformanceResourceTiming` entry).
 */
export abstract class ContextRegistry<TData extends { key: string }, TLookup> {
  protected _records = new Map<string, StoredRecord<TData>[]>();

  /** Store the span context for the given data, indexed by `data.key`. */
  register(span: Span, data: TData): void {
    const ctx = trace.setSpan(ROOT_CONTEXT, span);
    const list = this._records.get(data.key) ?? [];
    list.push({ ...data, ctx });
    this._records.set(data.key, list);
  }

  /**
   * Remove the record that matches `lookup`. If no matching record exists this
   * is a no-op. Deletes the key entirely once all records under it are removed.
   */
  unregister(lookup: TLookup): void {
    const key = this.getKey(lookup);
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

  /** Return the index key for the given lookup object. */
  abstract getKey(lookup: TLookup): string;

  /**
   * Return the OTel context for the record that matches `lookup`, or
   * `undefined` if no match is found.
   */
  abstract getContext(lookup: TLookup): Context | undefined;
}
