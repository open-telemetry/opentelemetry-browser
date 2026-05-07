/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

export type DocumentObserver = (href: string) => void;

/**
 * Tracks the document URL across SPA navigations. Fires registered observers
 * with the new `location.href` whenever:
 *  - the browser fires `popstate` or `hashchange`
 *  - `history.pushState` or `history.replaceState` is called
 *
 * `start()` is idempotent. The patches store the originals on the instance so
 * `stop()` can restore them.
 */
export class DocumentTracker {
  private readonly _observers = new Set<DocumentObserver>();
  private _started = false;
  private _originalPushState?: typeof history.pushState;
  private _originalReplaceState?: typeof history.replaceState;
  private _onPopState?: () => void;
  private _onHashChange?: () => void;

  addObserver(observer: DocumentObserver): void {
    this._observers.add(observer);
  }

  removeObserver(observer: DocumentObserver): void {
    this._observers.delete(observer);
  }

  start(): void {
    if (this._started || typeof window === 'undefined') {
      return;
    }
    this._started = true;

    const notify = () => this._notify();

    this._originalPushState = history.pushState;
    const originalPushState = this._originalPushState;
    history.pushState = function patchedPushState(
      this: History,
      ...args: Parameters<History['pushState']>
    ): ReturnType<History['pushState']> {
      const result = originalPushState.apply(this, args);
      notify();
      return result;
    };

    this._originalReplaceState = history.replaceState;
    const originalReplaceState = this._originalReplaceState;
    history.replaceState = function patchedReplaceState(
      this: History,
      ...args: Parameters<History['replaceState']>
    ): ReturnType<History['replaceState']> {
      const result = originalReplaceState.apply(this, args);
      notify();
      return result;
    };

    this._onPopState = notify;
    this._onHashChange = notify;
    window.addEventListener('popstate', this._onPopState);
    window.addEventListener('hashchange', this._onHashChange);
  }

  stop(): void {
    if (!this._started) {
      return;
    }
    if (this._originalPushState) {
      history.pushState = this._originalPushState;
    }
    if (this._originalReplaceState) {
      history.replaceState = this._originalReplaceState;
    }
    if (this._onPopState) {
      window.removeEventListener('popstate', this._onPopState);
    }
    if (this._onHashChange) {
      window.removeEventListener('hashchange', this._onHashChange);
    }
    this._started = false;
  }

  /** Returns the current `location.href`. */
  getHref(): string {
    return typeof window === 'undefined' ? '' : window.location.href;
  }

  private _notify(): void {
    const href = this.getHref();
    for (const observer of this._observers) {
      observer(href);
    }
  }
}
