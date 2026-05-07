/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LoggerProvider as ILoggerProvider,
  Logger,
  LoggerOptions,
  LogRecord,
} from '@opentelemetry/api-logs';
import type { Resource } from '@opentelemetry/resources';
import { emptyResource } from '@opentelemetry/resources';
import type { LoggerProviderConfig } from '@opentelemetry/sdk-logs';
import { LoggerProvider } from '@opentelemetry/sdk-logs';
import type { Entity } from './Entity.ts';
import { mergeEntitiesIntoResource } from './mergeEntitiesIntoResource.ts';

/**
 * A LoggerProvider that maintains a set of currently-bound entities (keyed by
 * `entity.type`) and stamps their attributes onto the Resource of every log
 * record it emits.
 *
 * Implements the proxy / delegating-provider pattern from OTEP discussion #265:
 * `setEntity(e)` rebuilds an internal real LoggerProvider whose Resource is
 * the base merged with all current entities. The same processor instances are
 * reused across rebuilds, so the export pipeline is uninterrupted.
 *
 * `getLogger()` returns a `ProxyLogger` that resolves the current delegate on
 * each `emit()`, so loggers obtained once (e.g. by instrumentations during
 * init) automatically pick up new entities without re-registration.
 */
export class EntityAwareLoggerProvider implements ILoggerProvider {
  private readonly _baseResource: Resource;
  private readonly _providerConfig: Omit<LoggerProviderConfig, 'resource'>;
  private readonly _entities = new Map<string, Entity>();
  private readonly _proxyLoggers = new Map<string, ProxyLogger>();
  private _currentProvider: LoggerProvider;

  constructor(config: LoggerProviderConfig = {}) {
    const { resource, ...rest } = config;
    this._baseResource = resource ?? emptyResource();
    this._providerConfig = rest;
    this._currentProvider = new LoggerProvider(config);
  }

  setEntity(entity: Entity): void {
    this._entities.set(entity.type, entity);
    this._rebuildProvider();
  }

  removeEntity(type: string): void {
    if (this._entities.delete(type)) {
      this._rebuildProvider();
    }
  }

  getLogger(name: string, version?: string, options?: LoggerOptions): Logger {
    const key = `${name}@${version ?? ''}:${options?.schemaUrl ?? ''}`;
    let logger = this._proxyLoggers.get(key);
    if (!logger) {
      logger = new ProxyLogger(this, name, version, options);
      this._proxyLoggers.set(key, logger);
    }
    return logger;
  }

  /** @internal — used by ProxyLogger to resolve the current delegate. */
  _getDelegateLogger(
    name: string,
    version?: string,
    options?: LoggerOptions,
  ): Logger {
    return this._currentProvider.getLogger(name, version, options);
  }

  forceFlush(): Promise<void> {
    return this._currentProvider.forceFlush();
  }

  shutdown(): Promise<void> {
    return this._currentProvider.shutdown();
  }

  private _rebuildProvider(): void {
    const resource = mergeEntitiesIntoResource(this._baseResource, [
      ...this._entities.values(),
    ]);
    this._currentProvider = new LoggerProvider({
      ...this._providerConfig,
      resource,
    });
  }
}

class ProxyLogger implements Logger {
  private readonly _provider: EntityAwareLoggerProvider;
  private readonly _name: string;
  private readonly _version: string | undefined;
  private readonly _options: LoggerOptions | undefined;

  constructor(
    provider: EntityAwareLoggerProvider,
    name: string,
    version: string | undefined,
    options: LoggerOptions | undefined,
  ) {
    this._provider = provider;
    this._name = name;
    this._version = version;
    this._options = options;
  }

  emit(logRecord: LogRecord): void {
    this._provider
      ._getDelegateLogger(this._name, this._version, this._options)
      .emit(logRecord);
  }
}
