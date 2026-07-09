## Overview

Sessions correlate multiple traces, events and logs that happen within a given time period.
Sessions are represented as span/log attributes prefixed with the `session.` namespace. For
additional information, see the [documentation in semantic
conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/general/session.md).

A session is not tied to authentication or user identity — it's a time-boxed correlation ID that
lets you group the telemetry produced by one visit (or one continuous stretch of activity) to your
application.

The `@opentelemetry/browser-sdk/session` subpath provides a default implementation of managing
sessions that:

- abstracts persisting sessions across page loads, with a default implementation based on
  `LocalStorage`
- abstracts generating session IDs
- provides a mechanism for resetting the active session after a maximum defined duration
- provides a mechanism for resetting the active session after a defined inactivity duration

Use it when you want spans and log records emitted by the SDK's tracer/logger providers to carry a
`session.id` attribute automatically, without having to thread a session identifier through your
own application code.

## Quick Start

```javascript
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import {
  createDefaultSessionIdGenerator,
  createLocalStorageSessionStore,
  createSessionLogRecordProcessor,
  createSessionManager,
  createSessionSpanProcessor,
} from '@opentelemetry/browser-sdk/session';

// session manager
const sessionManager = createSessionManager({
  sessionIdGenerator: createDefaultSessionIdGenerator(),
  sessionStore: createLocalStorageSessionStore(),
  maxDuration: 4 * 60 * 60, // 4 hours
  inactivityTimeout: 30 * 60, // 30 minutes
});

// restore or start the session
await sessionManager.start();

startBrowserSdk({
  serviceName: 'my-service',
  traces: {
    processors: [createSessionSpanProcessor(sessionManager)],
  },
  logs: {
    processors: [createSessionLogRecordProcessor(sessionManager)],
  },
});
```

**Session processors must be registered before the export processors.** See [Registering session
processors](#registering-session-processors) below for why, and for a full example with explicit
provider setup.

For the rest of the SDK's configuration (exporters, instrumentations, per-signal setup), see the
[`@opentelemetry/browser-sdk` README](../packages/sdk/README.md).

## Session Lifecycle

A session is a small object with exactly two fields:

```typescript
interface Session {
  id: string;
  startTimestamp: number; // epoch milliseconds
}
```

- **`sessionManager.start()`** — restores a session from the configured `sessionStore`, or starts
  a new one if none is stored. It then arms the max-duration and inactivity timers.
- **`sessionManager.getSessionId()` / `getSession()`** — return the current session, lazily
  starting one if `start()` was never called. `getSession()` is also what drives inactivity
  tracking: every call checks how long it has been since the last call, and rearms the inactivity
  timer if more than 5 seconds have passed. In practice this means **"inactivity" measures how
  long it has been since the last span was started or log record was emitted through the session
  processors** — it is not based on raw browser input events (clicks, mouse movement, etc.).
- **Session reset** — happens when either the `maxDuration` timer or the `inactivityTimeout` timer
  fires. On reset, the current session ends (any registered `SessionObserver`s receive
  `onSessionEnded`), a new session is created and persisted, and observers receive
  `onSessionStarted` with both the new and previous session.
- **`sessionManager.shutdown()`** — clears both timers so no further automatic resets happen. It
  does **not** end the current session or clear it from storage; it only stops future
  timer-driven resets. Call it when tearing down the SDK (e.g. in a single-page app teardown path).

## Configuration

`createSessionManager` accepts a `SessionManagerConfig`:

#### sessionIdGenerator

A `SessionIdGenerator` (an object with `generateSessionId(): string`) responsible for producing
new session IDs. Required. Use `createDefaultSessionIdGenerator()` for the built-in implementation,
or provide your own — see [Custom implementations](#custom-implementations).

#### sessionStore

A `SessionStore` (an object with `save(session): Promise<void>` and `get(): Promise<Session |
null>`) responsible for persisting the session across page loads. Required. Use
`createLocalStorageSessionStore()` for the built-in implementation, or provide your own — see
[Custom implementations](#custom-implementations).

#### maxDuration

Maximum duration of a session, in **seconds**. Optional — there is no built-in default. If
omitted, the session is never reset due to elapsed time; it will only be reset by
`inactivityTimeout` (if configured) or when explicitly recreated.

#### inactivityTimeout

Maximum time without activity after which a session is reset, in **seconds**. Optional — there is
no built-in default. If omitted, the session is never reset due to inactivity.

> The `4 * 60 * 60` (4 hours) / `30 * 60` (30 minutes) values shown in the examples on this page
> are simply the values this repository's own examples and sandbox use — they are not defaults
> applied by `createSessionManager` or `SessionManager`. If you don't set `maxDuration` or
> `inactivityTimeout`, the corresponding expiration mechanism is disabled entirely.

## Default Implementations

#### createDefaultSessionIdGenerator

Generates a 32-character hexadecimal ID using `Math.random()`. This is suitable as a correlation
identifier but is **not cryptographically secure** and is not a UUID — do not use it as a security
or authentication token.

#### LocalStorageSessionStore

Persists the session as JSON under a single fixed key in `window.localStorage`. Because
`localStorage` is shared by every tab and window open to the same origin, **all tabs on the same
origin share one session** — this is "one session per browser origin," not "one session per tab."
If you need per-tab sessions, provide a custom `SessionStore` backed by `sessionStorage` instead
(see [Custom implementations](#custom-implementations)). The store is a safe no-op in environments
without `localStorage` (e.g. during server-side rendering).

## Registering Session Processors

`createSessionSpanProcessor` and `createSessionLogRecordProcessor` add the `session.id` attribute
to spans and log records respectively, by reading the current session ID from any object that
implements `SessionProvider` (`getSessionId(): string | null`) — typically a `SessionManager`.

As in the codebase's own [sandbox app](../sandbox/src/otel.ts), register the session processors
**before** the export processors:

```javascript
const spanProcessors = [
  createSessionSpanProcessor(sessionManager),
  new BatchSpanProcessor({ exporter: traceExporter }),
];

const logProcessors = [
  createSessionLogRecordProcessor(sessionManager),
  new BatchLogRecordProcessor({ exporter: logExporter }),
];
```

Processors run in registration order, so putting the session processor first guarantees
`session.id` is already set on the span/log record by the time the export processor picks it up.
If the export processor ran first, exported telemetry could be missing the attribute.

## Observing Sessions

`SessionManager` implements `SessionPublisher`, so you can register observers to be notified when
a session starts or ends:

```javascript
sessionManager.addObserver({
  onSessionStarted: (newSession, previousSession) => {
    console.log('Session started', newSession, previousSession);
  },
  onSessionEnded: (session) => {
    console.log('Session ended', session);
  },
});
```

Multiple observers can be registered; each is called synchronously in registration order whenever
a session starts or ends.

## Custom Implementations

#### Custom SessionStore (per-tab sessions)

The built-in `LocalStorageSessionStore` shares one session across every tab on the same origin. To
scope sessions to a single tab instead, provide a `SessionStore` backed by `sessionStorage`, which
is tab-scoped by design:

```javascript
import { createDefaultSessionIdGenerator, createSessionManager } from '@opentelemetry/browser-sdk/session';

const SESSION_STORAGE_KEY = 'otel-session';

const tabScopedSessionStore = {
  save(session) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return Promise.resolve();
  },
  get() {
    const data = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return Promise.resolve(data ? JSON.parse(data) : null);
  },
};

const sessionManager = createSessionManager({
  sessionIdGenerator: createDefaultSessionIdGenerator(),
  sessionStore: tabScopedSessionStore,
  maxDuration: 4 * 60 * 60,
  inactivityTimeout: 30 * 60,
});

await sessionManager.start();
```

#### Custom session provider (bypassing SessionManager)

If you require a completely custom solution for managing sessions, you can skip `SessionManager`
entirely and pass any object implementing `SessionProvider` directly to the processors:

```javascript
const customSessionProvider = {
  getSessionId: () => 'abcd1234',
};

startBrowserSdk({
  serviceName: 'my-service',
  traces: {
    processors: [createSessionSpanProcessor(customSessionProvider)],
  },
  logs: {
    processors: [createSessionLogRecordProcessor(customSessionProvider)],
  },
});
```

## Known Limitations

Keep the following in mind when configuring session timeouts:

- **`maxDuration` values longer than ~24.8 days are not fully honored.** This is a limit of the
  browser's timer API — a session configured with a longer `maxDuration` will still be reset at
  roughly the 24.8-day mark.
- **Reopening a previously closed tab restarts the inactivity countdown.** If `inactivityTimeout`
  is set, resuming a session (for example after closing and reopening the tab) starts a fresh
  inactivity window rather than continuing from where it left off, so a session can stay active
  longer than `inactivityTimeout` alone would suggest.
- **Session IDs are not cryptographically secure.** The default ID generator uses `Math.random()`
  and is intended only as a correlation identifier — see [DefaultIdGenerator](#defaultidgenerator).

## Related Links

- [`@opentelemetry/browser-sdk` README](../packages/sdk/README.md) — full SDK setup, per-signal
  configuration, and the quick-reference version of this content.
- [Session semantic conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/general/session.md)
- [Browser Events](browser-observability-model.md) — catalog of browser telemetry events emitted
  alongside sessions.
- Source implementation: [`packages/sdk/src/session`](https://github.com/open-telemetry/opentelemetry-browser/tree/main/packages/sdk/src/session)
