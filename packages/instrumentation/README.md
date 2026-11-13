# @opentelemetry/browser-instrumentation

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

**Note: This is an experimental package under active development. New releases
may include breaking changes. See [VERSIONING.md](../../VERSIONING.md).**

OpenTelemetry browser instrumentations, available as subpath exports under
`./experimental/*`.

Moving from `opentelemetry-js` or `opentelemetry-js-contrib`? See the
[migration guide](../../docs/migration-guide.md) for import paths, behavior
changes, and remaining gaps.

## Installation

```bash
npm install @opentelemetry/browser-instrumentation
```

## Instrumentations

- [Navigation](#navigation) — automatic instrumentation for browser navigations
  (initial load and SPA route changes)
- [Document Load](#document-load) — one document load span
- [Navigation Timing](#navigation-timing) — automatic instrumentation for
  navigation timing
- [Resource Timing](#resource-timing) — automatic instrumentation for resource
  timing
- [Element Timing](#element-timing) — automatic instrumentation for paint timing
  of annotated elements
- [User Action](#user-action) — automatic instrumentation for user actions
  (clicks)
- [Web Vitals](#web-vitals) — automatic instrumentation for Core Web Vitals
- [Long Animation Frames](#long-animation-frames) — automatic instrumentation
  for Long Animation Frames (jank, and the scripts behind a slow interaction)
- [Console](#console) — automatic instrumentation for console API calls (log,
  warn, error, info, debug)
- [Errors](#errors) — automatic instrumentation for unhandled errors and promise
  rejections
- [Fetch](#fetch) — automatic instrumentation for request using the `fetch` API

## Usage

The easiest way to use these instrumentations is the [Browser SDK](../sdk). Pass
them to `startBrowserSdk()` and the SDK enables them with its own providers.

You can also enable them yourself. Call `enable()` on each one:

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';

const loggerProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor({ exporter: new ConsoleLogRecordExporter() }),
  ],
});
logs.setGlobalLoggerProvider(loggerProvider);

const instrumentations = [
  new ErrorsInstrumentation(),
  new NavigationInstrumentation(),
  new NavigationTimingInstrumentation(),
  new ResourceTimingInstrumentation(),
  new UserActionInstrumentation(),
  new WebVitalsInstrumentation(),
];
for (const instrumentation of instrumentations) {
  instrumentation.enable();
}
```

---

### Navigation

```typescript
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
```

Emits a `browser.navigation` event for the initial page load (hard navigation)
and for subsequent in-page navigations (soft navigations), including
`history.pushState`, `history.replaceState`, `popstate`, and hash changes. When
enabled via config, the
[Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API)
is used in preference to patching `history`.

#### Configuration

```typescript
import {
  NavigationInstrumentation,
  defaultSanitizeUrl,
} from '@opentelemetry/browser-instrumentation/experimental/navigation';

new NavigationInstrumentation({
  // Use window.navigation (Navigation API) when available instead of
  // patching history.pushState / history.replaceState. Default: false.
  useNavigationApiIfAvailable: true,

  // Rewrite the captured URL before it is emitted. Useful for stripping
  // path segments, query parameters, or tokens that should not be exported.
  sanitizeUrl: (url) => defaultSanitizeUrl(url),

  // [Deprecated] Mutate the log record before it is emitted.
  // Prefer using a custom LogRecordProcessor registered with LoggerProvider.
  applyCustomLogRecordData: (logRecord) => {
    logRecord.attributes = {
      ...logRecord.attributes,
      'app.route.id': '...',
    };
  },
});
```

| Option                        | Type                             | Default | Description                                                                                                                                                                                                                                                     |
| ----------------------------- | -------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useNavigationApiIfAvailable` | `boolean`                        | `false` | When `true`, subscribes to the Navigation API (`currententrychange`) instead of patching `history.pushState` / `history.replaceState`. Falls back to history patching when the Navigation API is unavailable. The choice is made once, at the first `enable()`. |
| `sanitizeUrl`                 | `(url: string) => string`        | —       | Called before the URL is written to `url.full`.                                                                                                                                                                                                                 |
| `applyCustomLogRecordData`    | `(logRecord: LogRecord) => void` | —       | **[Deprecated]** Hook to modify log records before they are emitted. Errors thrown from this hook are caught and logged via the instrumentation diag logger. Prefer using a custom `LogRecordProcessor` registered with `LoggerProvider`.                       |

> **Note on Custom Attributes:** `applyCustomLogRecordData` is deprecated. To
> enrich or mutate log records with custom attributes, register a custom
> `LogRecordProcessor` with `LoggerProvider`:
>
> ```typescript
> import type { LogRecordProcessor, SdkLogRecord } from '@opentelemetry/sdk-logs';
>
> class CustomAttributesProcessor implements LogRecordProcessor {
>   onEmit(logRecord: SdkLogRecord) {
>     logRecord.setAttribute('app.route.id', '...');
>   }
>   async forceFlush() {}
>   async shutdown() {}
> }
> ```

`defaultSanitizeUrl` is exported for composition — it redacts `user:password@`
credentials and a set of common sensitive query parameters (`api_key`, `token`,
`password`, signed URL signatures, etc.).

#### Captured Attributes

Each `browser.navigation` event includes:

| Attribute                          | Description                                                                               |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `url.full`                         | The destination URL (after `sanitizeUrl` if configured).                                  |
| `browser.navigation.same_document` | `true` for SPA route changes; `false` for full-page loads.                                |
| `browser.navigation.hash_change`   | `true` when the navigation only adds or changes the URL fragment.                         |
| `browser.navigation.type`          | One of `push`, `replace`, `reload`, `traverse` (omitted for the initial hard navigation). |

---

### Document Load

```typescript
import { DocumentLoadInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/document-load';
```

Creates one `documentLoad` span from the navigation entry's `fetchStart` to
`loadEventEnd`, with the `url.full` attribute. Credentials and sensitive query
values in `url.full` are redacted with `defaultSanitizeUrl`. The span starts a
new trace. Pass it to `startBrowserSdk()` and the SDK enables it with its tracer
provider:

```typescript
import { startBrowserSdk } from '@opentelemetry/browser-sdk';

const sdk = startBrowserSdk({
  instrumentations: [new DocumentLoadInstrumentation()],
});
```

To enable it yourself, pass the tracer provider to `enable()`:

```typescript
const documentLoad = new DocumentLoadInstrumentation();
documentLoad.enable({ tracerProvider });
```

Enabling after the page has loaded reads the buffered navigation entry and keeps
its original interval. During load, collection waits until `loadEventEnd` is
populated. Missing or invalid navigation timing produces no span rather than a
made-up end time. Disabling cancels collection. Re-enabling an instance that
already collected the document does not emit a second span for that load.

Detailed timings come from the navigation-timing and resource-timing
instrumentations, so there are no `documentFetch` or `resourceFetch` child spans
or span events.

---

### Navigation Timing

```typescript
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
```

Provides automatic instrumentation for
[Navigation Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming)
in web applications.

---

### Resource Timing

```typescript
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
```

Provides automatic instrumentation for
[Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming)
in web applications, capturing performance metrics for all resources loaded by
the browser (scripts, stylesheets, images, fonts, XHR/fetch requests, etc.).

- Uses `requestIdleCallback` to avoid blocking the main thread (with automatic
  `setTimeout` fallback for Safari)
- Processes resources in configurable batches
- Captures historical resources loaded before instrumentation was enabled via
  buffered mode
- Flushes pending entries on visibility change to prevent data loss

#### Configuration

```typescript
new ResourceTimingInstrumentation({
  // Process 100 resources per batch (default: 50)
  batchSize: 100,

  // Wait max 2 seconds for idle time before forcing processing (default: 1000)
  forceProcessingAfter: 2000,

  // Spend max 100ms processing per idle callback (default: 50)
  maxProcessingTime: 100,

  // Maximum queue size before forcing immediate flush (default: 1000)
  maxQueueSize: 2000,
});
```

| Option                 | Type     | Default | Description                                                               |
| ---------------------- | -------- | ------- | ------------------------------------------------------------------------- |
| `batchSize`            | `number` | `50`    | Number of resources to process per batch.                                 |
| `forceProcessingAfter` | `number` | `1000`  | Maximum time (ms) to wait for an idle callback before forcing processing. |
| `maxProcessingTime`    | `number` | `50`    | Maximum time (ms) to spend processing resources per idle callback.        |
| `maxQueueSize`         | `number` | `1000`  | Maximum number of resources to queue before forcing immediate flush.      |

#### Captured Data

Each resource timing event includes:

- **URL** and **Initiator Type** (script, css, img, xmlhttprequest, fetch, etc.)
- **Duration** — total resource load time
- **Timing Phases** — DNS lookup, TCP connection, TLS handshake, request,
  response
- **Size Metrics** — transfer size, encoded size, decoded size
- **Protocol** — HTTP version (h1, h2, h3)
- **Redirect Info** — redirect timing if applicable
- **Service Worker** — worker start time if intercepted
- **Render Blocking** — whether the resource blocked rendering (Chromium only)

---

### Element Timing

```typescript
import { ElementTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/element-timing';
```

Emits a `browser.element_timing` event for each element annotated with the
[`elementtiming`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceElementTiming)
attribute, reporting when the browser painted it.

Only image elements and text-containing block elements are eligible, and the
attribute must be present before the element is first painted:

```html
<img src="hero.jpg" elementtiming="hero-image">
<p elementtiming="headline">Welcome</p>
```

Entries recorded before the instrumentation was enabled are captured via
buffered mode. Element Timing is Chromium-only. On other browsers the
instrumentation stays disabled and logs a diag message.

#### Captured Attributes

Each `browser.element_timing` event includes:

| Attribute                               | Description                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `browser.element_timing.identifier`     | The `elementtiming` attribute value.                                                                                               |
| `browser.element_timing.element`        | The lower-cased tag name (omitted when the element left the document before the entry was processed).                              |
| `browser.element_timing.render_time`    | Paint time relative to navigation start. Cross-origin images without a `Timing-Allow-Origin` header report 0 or a coarsened value. |
| `browser.element_timing.start_time`     | `render_time` when non-zero, otherwise `load_time`. Always present, so prefer this for charting.                                   |
| `browser.element_timing.load_time`      | Resource load time relative to navigation start. Image elements only.                                                              |
| `url.full`                              | The image resource URL. Image elements only.                                                                                       |
| `browser.element_timing.natural_width`  | Intrinsic width in CSS pixels. Image elements only.                                                                                |
| `browser.element_timing.natural_height` | Intrinsic height in CSS pixels. Image elements only.                                                                               |

---

### User Action

```typescript
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
```

Provides automatic instrumentation for user actions in web applications.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

#### Configuration

By default the instrumentation captures `click` events. Middle clicks are
captured through `auxclick` and right clicks through `contextmenu`, since native
context menus can consume the mouse release before `auxclick` fires. Only button
2 context menus are recorded, so keyboard menu events are ignored. Right-button
`auxclick` events are ignored to avoid duplicate records. You can configure
which events to capture by passing an options object:

```typescript
new UserActionInstrumentation({
  // Array of actions to automatically capture. Default: ['click'].
  autoCapturedActions: [],

  // [Deprecated] Mutate the log record before it is emitted.
  // Prefer using a custom LogRecordProcessor registered with LoggerProvider.
  applyCustomLogRecordData: (logRecord) => {
    logRecord.attributes = {
      ...logRecord.attributes,
      'app.user.role': 'admin',
    };
  },
});
```

| Option                     | Type                             | Default     | Description                                                                                                                                                                                                                               |
| -------------------------- | -------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `autoCapturedActions`      | `AutoCapturedUserAction[]`       | `['click']` | Array of actions to automatically capture.                                                                                                                                                                                                |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | —           | **[Deprecated]** Hook to modify log records before they are emitted. Errors thrown from this hook are caught and logged via the instrumentation diag logger. Prefer using a custom `LogRecordProcessor` registered with `LoggerProvider`. |

#### Additional Attributes

Data attributes with the prefix `data-otel-` on the target element will be added
as additional attributes to the generated log record. For example:

```html
<button id="btn1" data-otel-user-id="12345" data-otel-feature="signup">
  Sign Up
</button>
```

---

### Web Vitals

```typescript
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';
```

Provides automatic instrumentation for
[Core Web Vitals](https://web.dev/vitals/) using the
[`web-vitals`](https://github.com/GoogleChrome/web-vitals) library.

#### Configuration

| Option                     | Type                             | Default | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | -------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `includeRawAttribution`    | `boolean`                        | `false` | When true, sets the log record body to the JSON-stringified `web-vitals` attribution object.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | —       | **[Deprecated]** Hook to modify log records before they are emitted. Prefer using a custom `LogRecordProcessor` registered with `LoggerProvider`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `reportAllChanges`         | `boolean`                        | `false` | When true, CLS, INP and LCP are reported each time their value changes, not only when the value is final. FCP and TTFB are not affected. `delta` is the change since the previous report for the same metric `id`.`web-vitals` [recommends](https://github.com/GoogleChrome/web-vitals#report-the-value-on-every-change) this for debugging, not for production.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `reportSoftNavs`           | `boolean`                        | `false` | When true, metrics are reported again after each soft navigation (a route change in a single-page app). CLS and INP start again from zero. FCP and LCP are the paints after the soft navigation. TTFB is not reported for soft navigations. Metrics for the first page are final at the first soft navigation, so its CLS and INP can be lower than without this option. Adds `browser.web_vital.navigation_url`. Use it to group metrics by route, because a metric can be reported after the URL has changed. `browser.web_vital.navigation_id` is added when the browser exposes a navigation id, with or without this option. Requires Chromium 151 or later. Other browsers ignore this option. See the [`web-vitals` docs](https://github.com/GoogleChrome/web-vitals#report-metrics-for-soft-navigations). |
| `sanitizeUrl`              | `(url: string) => string`        | —       | Called before the URL is written to `browser.web_vital.navigation_url`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

---

### Long Animation Frames

```typescript
import { LongAnimationFrameInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/long-animation-frame';
```

Emits a `browser.long_animation_frame` event for every
[Long Animation Frames API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming)
entry. The API is not Baseline and is currently unavailable in Firefox and
Safari, and it reports a frame only once it exceeds the 50 ms long-frame
threshold, so this instrumentation stays silent on pages that are already
responsive.

The [sandbox](../../sandbox) has a **Long Frame** button that blocks the main
thread past that threshold, so an entry can be generated on demand while
reviewing or QAing a change locally.

#### Configuration

```typescript
import { LongAnimationFrameInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/long-animation-frame';

new LongAnimationFrameInstrumentation({
  // Optional. Defaults to `defaultSanitizeUrl`, which redacts
  // `user:password@` credentials and common sensitive query parameters
  // (`api_key`, `token`, `password`, ...). Pass `undefined` to emit the
  // URL-bearing fields exactly as the browser reports them.
  sanitizeUrl: (url) => url.replace(/\/users\/\d+/, '/users/:id'),
});
```

| Option        | Type                      | Default              | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sanitizeUrl` | `(url: string) => string` | `defaultSanitizeUrl` | Called before a URL-bearing field of a `scripts` entry is written: `source_url`, and `invoker` for a `classic-script` or `module-script` entry, where the spec defines it as the invoking script's source URL. For an inline script that URL is the page URL including its query string, so a `token` in it would otherwise be exported here even when `url.full` is sanitized elsewhere. Values that are not URLs — the `DOMWindow.onclick` style `invoker` of an `event-listener` entry, an unresolved `source_url` — are written unchanged and never passed to the function, so a sanitizer that parses its argument (`new URL(url)`) is safe to pass. Unlike `url.full` for navigation, fetch and xhr, this is on by default, because the value sits inside the `scripts` array where a page token is easy to miss. |

#### Captured Attributes

| Attribute                                               | Description                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser.long_animation_frame.start_time`               | Start of the frame, in milliseconds relative to the time origin. Same clock as `render_start`, `style_and_layout_start` and `first_ui_event_timestamp`; the record timestamp is this value plus `performance.timeOrigin`.                                                                                                                                                                                                                                                                                                                     |
| `browser.long_animation_frame.duration`                 | Total duration of the frame, in milliseconds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `browser.long_animation_frame.blocking_duration`        | Time the main thread was blocked from responding to high-priority tasks, in milliseconds: the sum, over the tasks in the frame that ran longer than 50 ms, of each task's duration minus 50 ms, with the rendering time added to the longest of them. It is not the frame's total duration and it is not split across the `scripts` entries — scripts carry `duration` and `forced_style_and_layout_duration` instead. See [the spec](https://w3c.github.io/long-animation-frames/#dom-performancelonganimationframetiming-blockingduration). |
| `browser.long_animation_frame.render_start`             | Start of the rendering cycle, in milliseconds relative to the time origin. Omitted when the frame did not render — the spec's getter returns `0` for "no value", which would otherwise be exported as a real time at the time origin.                                                                                                                                                                                                                                                                                                         |
| `browser.long_animation_frame.style_and_layout_start`   | Start of the style and layout cycle, in milliseconds relative to the time origin. Omitted when the frame had no style and layout cycle, for the same reason.                                                                                                                                                                                                                                                                                                                                                                                  |
| `browser.long_animation_frame.first_ui_event_timestamp` | Time of the first UI event processed during the frame, in milliseconds relative to the time origin. Omitted when no UI event was processed in the frame, which is the common case for frames not caused by an interaction.                                                                                                                                                                                                                                                                                                                    |
| `browser.long_animation_frame.scripts`                  | Script timing entries attributed to the frame: `start_time`, `duration`, `execution_start`, `invoker`, `invoker_type`, `source_url`, `source_function_name`, `source_char_position`, `pause_duration`, `forced_style_and_layout_duration`, `window_attribution`. `invoker` and `source_url` are passed through `sanitizeUrl` when they are URLs; see Configuration.                                                                                                                                                                           |

Every entry is named `long-animation-frame` and every script entry is named
`script` by the spec, so neither name is repeated as an attribute: the event
name already says what the record is.

#### Buffered replay and volume

The instrumentation observes with `buffered: true`, so frames the browser
retained from before it started are emitted once, on the first `enable()`. A
later `disable()` / `enable()` cycle resumes live observation and does not
re-emit frames that were already logged.

No client-side throttle is applied. The performance timeline buffer keeps the
first ~200 entries and leaves out the newer ones once it is full
(`droppedEntriesCount` goes up), so it only bounds the buffered replay above; a
live observer still receives every frame. A throttle would drop the worst frames
first: a jank burst that produces dozens of entries would be reported as one,
which improves the downstream p95 while the page gets worse. If a hard ceiling
is ever needed, prefer accounting over sampling — a per-callback cap plus a
dropped count on the following record so the loss stays visible, or the batching
shape [Resource Timing](#resource-timing) already uses (`batchSize`,
`maxQueueSize`, `forceProcessingAfter`, drained on an idle callback).

#### Correlating frames with interactions

`first_ui_event_timestamp` is a `DOMHighResTimeStamp` on the same clock as
`Event.timeStamp`, so a frame can be related to the interaction that triggered
it without any context plumbing. The `scripts` array then names the culprit:
`invoker` (for example `DOMWindow.onclick`), `invoker_type` (`event-listener`),
`source_url`, `source_function_name`, `source_char_position`, and
`forced_style_and_layout_duration` (the time that script spent forcing style and
layout).

Do not join the two by equality. `first_ui_event_timestamp` is the `timeStamp`
of the first UI event whose listener ran in that frame — any UI event — while a
web-vitals INP record's `attribution.interactionTime` is the start of the
interaction's first event entry. The two only line up when the frame happened to
handle that first event before anything else, and a slow interaction can overlap
more than one frame (the frame that delayed the input and the frame that ran the
handlers), of which at most one can match.

The INP side of the join is already done by [Web Vitals](#web-vitals): with
`includeRawAttribution` enabled, every frame that overlaps the interaction is in
the record body as `attribution.longAnimationFrameEntries`, scripts included, so
read them from there. For any other correlation, match by overlap — a frame
overlaps the interaction when its `start_time` precedes the interaction end and
its `start_time + duration` follows the interaction start, both of which are on
the frame record as attributes — rather than by an exact timestamp comparison.
INP says which interaction was slow; Long Animation Frames say which script made
it slow.

#### Page attribution

`browser.document.url.full` is stamped by `createDocumentLogRecordProcessor` and
`createDocumentSpanProcessor`, and `LocationDocumentProvider` reads
`location.href` at emit time, so soft navigations are reflected without extra
bookkeeping. The URL is therefore the one current when the record is built, not
necessarily the one the frame happened on, and the two differ more often than
the replay caveat above suggests: the observer callback runs after the frame has
finished, so a handler that blocks for 100 ms and then calls `history.pushState`
is reported with the new pathname — often exactly the frame a reviewer wants to
place. The buffered replay broadens it further, since those frames carry the URL
current when they are emitted rather than the URL they happened on, so the first
records of a session can be mislabelled on a page that navigates early. The
frame's own timing is unaffected — `start_time` and the record timestamp
describe the frame, not the URL, and the record timestamp is
`performance.timeOrigin + start_time` — which is what the overlap match above
uses.

### Console

```typescript
import { ConsoleInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/console';
```

Provides automatic instrumentation for browser console API calls. By default
captures `log`, `warn`, `error`, `info`, and `debug` methods.

#### Configuration

```typescript
new ConsoleInstrumentation({
  // Specify which console methods to capture (default: log, warn, error, info, debug)
  logMethods: ['error', 'warn'],
});
```
#### Captured Attributes

Each `browser.console` event includes the following attributes:

| Attribute                | Description                        | Example                                 |
| ------------------------ | ---------------------------------- | --------------------------------------- |
| `browser.console.method` | The console method that was called | `error`, `warn`, `log`, `info`, `debug` |

---

### Errors

```typescript
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
```

Emits an `exception` event for every uncaught error
(`window.addEventListener('error', ...)`) and unhandled promise rejection
(`window.addEventListener('unhandledrejection', ...)`).

#### Configuration

```typescript
new ErrorsInstrumentation({
  // Return extra attributes to attach to the emitted log record.
  applyCustomAttributes: (error) => ({
    'app.error.severity':
      error instanceof Error && error.name === 'ValidationError'
        ? 'warning'
        : 'error',
  }),
});
```

| Option                  | Type                                     | Default | Description                                                                                                                                            |
| ----------------------- | ---------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `applyCustomAttributes` | `(error: Error \| string) => Attributes` | —       | Returns extra attributes to merge onto the emitted log record. Errors thrown from this hook are caught and logged via the instrumentation diag logger. |

#### Captured Attributes

Each `exception` event includes:

| Attribute              | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `exception.type`       | The error's `name` (omitted when the thrown value is a string).  |
| `exception.message`    | The error's `message`, or the thrown string itself.              |
| `exception.stacktrace` | The error's `stack` (omitted when the thrown value is a string). |

---

### Fetch

```typescript
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
```

Emits a Span for every HTTP request made using the `window.fetch` browser API.
This instrumentation also propagates the context for distributed traces.

#### Configuration

```typescript
new FetchInstrumentation({
  ignoreUrls: ['https://example.com/api'],
  propagateTraceHeaderCorsUrls: [/domain.com\/api.*/],
  measureRequestSize: true,
  applyCustomAttributesOnSpan: (span, request, result) => {
    span.setAttribute('foo', 'bar');
  },
});
```

| Option                         | Type                                                                                    | Default | Description                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ignoreUrls`                   | `Array<string \| RegExp>`                                                               | —       | List of URLs that we do not want its requests instrumented. You can use strings for a single match or regular expressions to match many. |
| `propagateTraceHeaderCorsUrls` | `Array<string \| RegExp>`                                                               | —       | List of cross origin URLs to appens trace context headers. You can use strings for a single match or regular expressions to match many.  |
| `measureRequestSize`           | `boolean`                                                                               | —       | Set it to `true` to add the request size as a Span attribute.                                                                            |
| `sanitizeUrl`                  | `(url: string) => string`                                                               | —       | Returns the given URL with sensitive fields `REDACTED`.                                                                                  |
| `requestHook`                  | `(span: Span, request: Request \| RequestInit) => void`                                 | —       | Function for adding Span attributes or request headers before the request starts and trace headers are injected.                         |
| `applyCustomAttributesOnSpan`  | `(span: Span, request: Request \| RequestInit, result: Response \| FetchError) => void` | —       | Function that allows you to interact with the Span once the request is finished, before the Span ends.                                   |

See [Sharing fetch and XHR hooks](#sharing-fetch-and-xhr-hooks) to reuse
callbacks across both instrumentations.

#### Captured Attributes

Each `fetch` Span includes:

| Attribute                      | Description                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `http.request.method`          | The method of the request in uppercase (GET, POST, PUT, PATCH, QUERY).                                              |
| `http.request.method_original` | Original HTTP method sent by the client in the request line..                                                       |
| `url.full`                     | Absolute URL describing a network resource according to RFC3986 (sanitized if passing `sanitizeUrl` config option). |
| `server.address`               | The hostmane of the request's URL.                                                                                  |
| `server.port`                  | The port of the request's URL.                                                                                      |
| `http.response.status_code`    | HTTP response status code.                                                                                          |
| `error.type`                   | If request failed. Describes a class of error the operation ended with.                                             |

---

### XHR (XmlHttpRequest)

```typescript
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';
```

Emits a Span for every HTTP request made using the `window.XmlHttpRequest`
browser API. This instrumentation also propagates the context for distributed
traces.

#### Configuration

```typescript
new XhrInstrumentation({
  ignoreUrls: ['https://example.com/api'],
  propagateTraceHeaderCorsUrls: [/domain.com\/api.*/],
  measureRequestSize: true,
  applyCustomAttributesOnSpan: (span, xhr) => {
    span.setAttribute('foo', 'bar');
  },
});
```

| Option                         | Type                                        | Default | Description                                                                                                                                       |
| ------------------------------ | ------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ignoreUrls`                   | `Array<string \| RegExp>`                   | —       | List of URLs that we do not want its requests instrumented. You can use strings for a single match or regular expressions to match many.          |
| `propagateTraceHeaderCorsUrls` | `Array<string \| RegExp>`                   | —       | List of cross origin URLs to appens trace context headers. You can use strings for a single match or regular expressions to match many.           |
| `measureRequestSize`           | `boolean`                                   | —       | Set it to `true` to add the request size as a Span attribute.                                                                                     |
| `sanitizeUrl`                  | `(url: string) => string`                   | —       | Returns the given URL with sensitive fields `REDACTED`.                                                                                           |
| `requestHook`                  | `(span: Span, xhr: XMLHttpRequest) => void` | —       | Function for adding Span attributes or request headers via `xhr.setRequestHeader`. Called after `open`, before `send` and trace-header injection. |
| `applyCustomAttributesOnSpan`  | `(span: Span, xhr: XMLHttpRequest) => void` | —       | Function that allows you to interact with the Span and completed XHR once the request is finished, before the Span ends.                          |

#### Sharing fetch and XHR hooks

Both instrumentations accept the same callbacks when the request parameter is
typed as `Request | RequestInit | XMLHttpRequest`. For
`applyCustomAttributesOnSpan`, make the third parameter optional: fetch supplies
a `Response` or `FetchError`, while XHR supplies no third argument. Read XHR
response information from the `XMLHttpRequest` itself.

Hooks run synchronously. Errors thrown by either hook are caught and reported
through the instrumentation's diagnostic logger without interrupting the request
or preventing the Span from ending. Ignored requests and disabled
instrumentations do not invoke hooks.

**Note:** For `fetch(url, init)`, the example below changes the caller's
`init.headers`. These changes persist if `init` is reused; pass a fresh `init`
object for each request to keep them request-specific.

```typescript
import type { Span } from '@opentelemetry/api';
import {
  FetchInstrumentation,
  type FetchError,
} from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';

type HttpRequest = Request | RequestInit | XMLHttpRequest;

const hooks = {
  requestHook: (span: Span, request: HttpRequest) => {
    span.setAttribute(
      'request.api',
      request instanceof XMLHttpRequest ? 'xhr' : 'fetch',
    );
    if (request instanceof XMLHttpRequest) {
      request.setRequestHeader('x-custom-header', 'value');
    } else if (request instanceof Request) {
      request.headers.set('x-custom-header', 'value');
    } else {
      const headers = new Headers(request.headers);
      headers.set('x-custom-header', 'value');
      request.headers = headers;
    }
  },
  applyCustomAttributesOnSpan: (
    span: Span,
    request: HttpRequest,
    result?: Response | FetchError,
  ) => {
    const status =
      request instanceof XMLHttpRequest ? request.status : result?.status;
    if (status !== undefined) {
      span.setAttribute('custom.response.status', status);
    }
  },
};

new FetchInstrumentation(hooks);
new XhrInstrumentation(hooks);
```

#### Captured Attributes

Each `xhr` Span includes:

| Attribute                      | Description                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `http.request.method`          | The method of the request in uppercase (GET, POST, PUT, PATCH, QUERY).                                              |
| `http.request.method_original` | Original HTTP method sent by the client in the request line..                                                       |
| `url.full`                     | Absolute URL describing a network resource according to RFC3986 (sanitized if passing `sanitizeUrl` config option). |
| `server.address`               | The hostmane of the request's URL.                                                                                  |
| `server.port`                  | The port of the request's URL.                                                                                      |
| `http.response.status_code`    | HTTP response status code.                                                                                          |
| `error.type`                   | If request failed. Describes a class of error the operation ended with.                                             |

## Enabling and disabling

Each instrumentation has three methods: `enable()`, `disable()` and
`isEnabled()`.

- `new X()` does nothing. It only stores the config. It does not patch, listen
  or emit.
- The first `enable(deps?)` runs a one-time init and then starts emitting. Init
  patches browser APIs and checks that the browser supports what the
  instrumentation needs.
- The first `enable()` also locks the dependencies for the life of the instance.
  A dependency that you do not pass uses the global API from
  `@opentelemetry/api` or `@opentelemetry/api-logs`. Later `enable()` calls
  ignore `deps`. They log a warning if a passed dependency differs from the
  locked one, and a debug message if it is the same.
- `disable()` stops emitting and removes listeners. Patched browser APIs stay
  patched, because other code may have wrapped them after us. A later `enable()`
  starts emitting again, unless `disable()` failed.
- `isEnabled()` is `true` only while the instrumentation emits.

The dependencies are:

| Dependency       | Used for                           | Default                    |
| ---------------- | ---------------------------------- | -------------------------- |
| `tracerProvider` | Spans                              | The global tracer provider |
| `loggerProvider` | Log records (events)               | The global logger provider |
| `propagator`     | Trace context in outgoing requests | The global propagation API |

```typescript
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';

const errors = new ErrorsInstrumentation();
errors.isEnabled(); // false. Nothing is patched yet.

// No deps are passed, so it uses the global providers.
errors.enable();
errors.isEnabled(); // true

errors.disable();
errors.isEnabled(); // false
```

The [Browser SDK](../sdk) calls `enable()` and `disable()` for you. For example,
to wait for user consent, start the SDK with `enabled: false` and call
`sdk.enable()` later. See the SDK README.

Listeners are added only when the instrumentation is enabled. So a late
`enable()` still records the initial page load, buffered resource entries, and
web vitals that are reported only once. One-time events, such as the initial
page load, are not emitted a second time after `disable()` and `enable()`.

To keep an instrumentation fully off, with no patches, do not call `enable()`.

Init can fail, for example when a needed browser API is missing or another
script has locked it. A passed provider that cannot give a tracer or logger
fails the same way. The reason is logged as an error through the OpenTelemetry
diag logger, so set one with `diag.setLogger()` to see it. A failed
instrumentation stays off for good. Later calls to `enable()` only log a debug
line. A `disable()` that throws, for example when a listener cannot be removed,
is also logged as an error and keeps the instrumentation off in the same way. An
`_onEnable()` that throws is logged as an error, and a later `enable()` tries
again, unless the `_onDisable()` that cleans up after it throws too.

### Differences from classic instrumentations

These instrumentations do not use the base class from
`@opentelemetry/instrumentation`. So they behave differently from the
instrumentations in `opentelemetry-js` and `opentelemetry-js-contrib`:

- Creating an instrumentation does not enable it. Call `enable()`, or pass it to
  the Browser SDK.
- Providers and the propagator are passed once, to the first `enable()`. There
  are no setters for them.
- `disable()` does not unpatch browser APIs.
- The config is set once, in the constructor. There is no `enabled` config
  option.

Do not use a classic instrumentation for the same API as one of these. A classic
instrumentation cannot detect our patches, so both would record every call.

## Writing an instrumentation

An instrumentation is any object that implements the `Instrumentation`
interface: `instrumentationName`, `enable(deps?)`, `disable()` and
`isEnabled()`. The Browser SDK accepts any such object.

The easiest way is to extend `InstrumentationBase`. It implements the lifecycle
in [Enabling and disabling](#enabling-and-disabling). `InstrumentationBase`,
`Instrumentation` and `InstrumentationDeps` are exported from
[`@opentelemetry/browser-api`](../api). Add it as a dependency. You do not need
this package, so your instrumentation is not tied to its releases.

```bash
npm install @opentelemetry/browser-api
```

Override these hooks. All of them must be synchronous, because the lifecycle
does not wait for a returned promise. Do not use `async` here: a rejection is
not logged, and it reaches the page as an unhandled rejection. Hooks must not
call `enable()` or `disable()`.

- `_init()` runs once, at the first `enable()`. It only patches browser APIs
  with `_wrap()` and checks that the browser supports what the instrumentation
  needs. Throw if the instrumentation cannot run. A failed init is final.
- `_onEnable()` runs each time `enable()` turns emission on. Add listeners and
  observers here, including buffered ones. If it throws, `_onDisable()` runs to
  remove what it added, and a later `enable()` tries again. If that
  `_onDisable()` throws too, the instrumentation stays off for good.
- `_onDisable()` runs each time `disable()` turns emission off. Remove what
  `_onEnable()` added. If it throws, some listeners may still be attached, so
  the instrumentation stays off for good.

From the first `enable()`, use `this.tracer`, `this.logger` and
`this.propagator`. They come from the locked dependencies. Use `this.propagator`
instead of the global `propagation` API, so a second SDK on the page can inject
its own trace context.

Take the instrumentation's own dependencies, such as a store, in the
constructor. Only `tracerProvider`, `loggerProvider` and `propagator` go through
`enable()`. They cannot be constructor arguments, because `startBrowserSdk`
creates them after you construct the instrumentation.

There is `_wrap()` but no unwrap. Patches are never removed, because other code
may have wrapped on top of ours. So a patch must check `isEnabled()`, and pass
the call through when it is false. Run user hooks and emit code through
`_safeExecute()`, so that a throw, or a rejected promise, is logged and does not
break the page. In your own `catch` blocks, pass the caught value through
`_toError()` before you log it. A page can throw a value that is not an `Error`.

```typescript
import { InstrumentationBase } from '@opentelemetry/browser-api';

export interface RouteConfig {
  includeHash?: boolean;
}

export class RouteInstrumentation extends InstrumentationBase<RouteConfig> {
  private _onPopState: (() => void) | undefined;

  constructor(config: RouteConfig = {}) {
    super('route-example', '0.1.0', config);
  }

  protected override _init(): void {
    const instrumentation = this;
    this._wrap(
      history,
      'pushState',
      (original) =>
        function patchedPushState(
          this: History,
          ...args: Parameters<History['pushState']>
        ) {
          const result = original.apply(this, args);
          if (instrumentation.isEnabled()) {
            instrumentation._record();
          }
          return result;
        },
    );
  }

  protected override _onEnable(): void {
    this._onPopState = () => this._record();
    window.addEventListener('popstate', this._onPopState);
  }

  protected override _onDisable(): void {
    if (this._onPopState) {
      window.removeEventListener('popstate', this._onPopState);
      this._onPopState = undefined;
    }
  }

  private _record(): void {
    this._safeExecute('failed to record a route change', () => {
      const url = this._config.includeHash
        ? location.href
        : location.href.split('#')[0];
      this.logger.emit({
        eventName: 'example.route_change',
        attributes: { 'url.full': url },
      });
    });
  }
}
```

## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser:
  <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in
  [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]:
  https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]:
  https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]:
  https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/browser-instrumentation
[npm-img]:
  https://badge.fury.io/js/%40opentelemetry%2Fbrowser-instrumentation.svg
