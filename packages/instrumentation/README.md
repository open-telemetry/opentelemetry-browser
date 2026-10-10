# @opentelemetry/browser-instrumentation

[![NPM Published Version][npm-img]][npm-url]
[![Apache License][license-image]][license-image]

OpenTelemetry browser instrumentations, available as subpath exports under `./experimental/*`.

## Installation

```bash
npm install @opentelemetry/browser-instrumentation
```

## Instrumentations

- [Navigation](#navigation) — automatic instrumentation for browser navigations (initial load and SPA route changes)
- [Navigation Timing](#navigation-timing) — automatic instrumentation for navigation timing
- [Resource Timing](#resource-timing) — automatic instrumentation for resource timing
- [User Action](#user-action) — automatic instrumentation for user actions (clicks)
- [Web Vitals](#web-vitals) — automatic instrumentation for Core Web Vitals
- [Long Animation Frames](#long-animation-frames) — automatic instrumentation for Long Animation Frames (jank, and the scripts behind a slow interaction)
- [Console](#console) — automatic instrumentation for console API calls (log, warn, error, info, debug)
- [Errors](#errors) — automatic instrumentation for unhandled errors and promise rejections
- [Fetch](#fetch) — automatic instrumentation for request using the `fetch` API

## Usage

```typescript
import { logs } from '@opentelemetry/api-logs';
import {
  ConsoleLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
import { WebVitalsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/web-vitals';

const logProvider = new LoggerProvider({
  processors: [
    new SimpleLogRecordProcessor(new ConsoleLogRecordExporter()),
  ],
});
logs.setGlobalLoggerProvider(logProvider);

registerInstrumentations({
  instrumentations: [
    new ErrorsInstrumentation(),
    new NavigationInstrumentation(),
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation(),
    new UserActionInstrumentation(),
    new WebVitalsInstrumentation(),
  ],
});
```

---

### Navigation

```typescript
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
```

Emits a `browser.navigation` event for the initial page load (hard navigation) and for subsequent in-page navigations (soft navigations), including `history.pushState`, `history.replaceState`, `popstate`, and hash changes. When enabled via config, the [Navigation API](https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API) is used in preference to patching `history`.

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

  // Mutate the log record before it is emitted (e.g. attach custom attributes).
  applyCustomLogRecordData: (logRecord) => {
    logRecord.attributes = {
      ...logRecord.attributes,
      'app.route.id': '...',
    };
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useNavigationApiIfAvailable` | `boolean` | `false` | When `true`, subscribes to the Navigation API (`currententrychange`) instead of patching `history.pushState` / `history.replaceState`. Falls back to history patching when the Navigation API is unavailable. |
| `sanitizeUrl` | `(url: string) => string` | — | Called before the URL is written to `url.full`. |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | — | Hook to modify log records before they are emitted. Errors thrown from this hook are caught and logged via the instrumentation diag logger. |

`defaultSanitizeUrl` is exported for composition — it redacts `user:password@` credentials and a set of common sensitive query parameters (`api_key`, `token`, `password`, etc.).

#### Captured Attributes

Each `browser.navigation` event includes:

| Attribute | Description |
|-----------|-------------|
| `url.full` | The destination URL (after `sanitizeUrl` if configured). |
| `browser.navigation.same_document` | `true` for SPA route changes; `false` for full-page loads. |
| `browser.navigation.hash_change` | `true` when the navigation only adds or changes the URL fragment. |
| `browser.navigation.type` | One of `push`, `replace`, `reload`, `traverse` (omitted for the initial hard navigation). |

---

### Navigation Timing

```typescript
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
```

Provides automatic instrumentation for [Navigation Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceNavigationTiming) in web applications.

---

### Resource Timing

```typescript
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
```

Provides automatic instrumentation for [Resource Timing](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming) in web applications, capturing performance metrics for all resources loaded by the browser (scripts, stylesheets, images, fonts, XHR/fetch requests, etc.).

- Uses `requestIdleCallback` to avoid blocking the main thread (with automatic `setTimeout` fallback for Safari)
- Processes resources in configurable batches
- Captures historical resources loaded before instrumentation was enabled via buffered mode
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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | `number` | `50` | Number of resources to process per batch. |
| `forceProcessingAfter` | `number` | `1000` | Maximum time (ms) to wait for an idle callback before forcing processing. |
| `maxProcessingTime` | `number` | `50` | Maximum time (ms) to spend processing resources per idle callback. |
| `maxQueueSize` | `number` | `1000` | Maximum number of resources to queue before forcing immediate flush. |

#### Captured Data

Each resource timing event includes:

- **URL** and **Initiator Type** (script, css, img, xmlhttprequest, fetch, etc.)
- **Duration** — total resource load time
- **Timing Phases** — DNS lookup, TCP connection, TLS handshake, request, response
- **Size Metrics** — transfer size, encoded size, decoded size
- **Protocol** — HTTP version (h1, h2, h3)
- **Redirect Info** — redirect timing if applicable
- **Service Worker** — worker start time if intercepted
- **Render Blocking** — whether the resource blocked rendering (Chromium only)

---

### User Action

```typescript
import { UserActionInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/user-action';
```

Provides automatic instrumentation for user actions in web applications.

Compatible with OpenTelemetry JS API and SDK `1.0+`.

#### Configuration

By default the instrumentation captures `click` events. You can configure which events to capture by passing an options object:

```typescript
new UserActionInstrumentation({
  // Array of actions to automatically capture. Default: ['click'].
  autoCapturedActions: [],

  // Mutate the log record before it is emitted (e.g. attach custom attributes).
  applyCustomLogRecordData: (logRecord) => {
    logRecord.attributes = {
      ...logRecord.attributes,
      'app.user.role': 'admin',
    };
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoCapturedActions` | `AutoCapturedUserAction[]` | `['click']` | Array of actions to automatically capture. |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | — | Hook to modify log records before they are emitted. Errors thrown from this hook are caught and logged via the instrumentation diag logger. |

#### Additional Attributes

Data attributes with the prefix `data-otel-` on the target element will be added as additional attributes to the generated log record. For example:

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

Provides automatic instrumentation for [Core Web Vitals](https://web.dev/vitals/) using the [`web-vitals`](https://github.com/GoogleChrome/web-vitals) library.

#### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `includeRawAttribution` | `boolean` | `false` | When true, sets the log record body to the JSON-stringified `web-vitals` attribution object. |
| `applyCustomLogRecordData` | `(logRecord: LogRecord) => void` | — | Hook to modify log records before they are emitted. |

---

### Long Animation Frames

```typescript
import { LongAnimationFrameInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/long-animation-frame';
```

Emits a `browser.long_animation_frame` event for every [Long Animation Frames API](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongAnimationFrameTiming) entry. The API is not Baseline and is currently unavailable in Firefox and Safari, and it reports a frame only once it exceeds the 50 ms long-frame threshold, so this instrumentation stays silent on pages that are already responsive.

The [sandbox](../../sandbox) has a **Long Frame** button that blocks the main thread past that threshold, so an entry can be generated on demand while reviewing or QAing a change locally.

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sanitizeUrl` | `(url: string) => string` | `defaultSanitizeUrl` | Called before a URL-bearing field of a `scripts` entry is written: `source_url`, and `invoker` for a `classic-script` or `module-script` entry, where the spec defines it as the invoking script's source URL. For an inline script that URL is the page URL including its query string, so a `token` in it would otherwise be exported here even when `url.full` is sanitized elsewhere. Values that are not URLs — the `DOMWindow.onclick` style `invoker` of an `event-listener` entry, an unresolved `source_url` — are written unchanged and never passed to the function, so a sanitizer that parses its argument (`new URL(url)`) is safe to pass. Unlike `url.full` for navigation, fetch and xhr, this is on by default, because the value sits inside the `scripts` array where a page token is easy to miss. |

#### Captured Attributes

| Attribute | Description |
|-----------|-------------|
| `browser.long_animation_frame.start_time` | Start of the frame, in milliseconds relative to the time origin. Same clock as `render_start`, `style_and_layout_start` and `first_ui_event_timestamp`; the record timestamp is this value plus `performance.timeOrigin`. |
| `browser.long_animation_frame.duration` | Total duration of the frame, in milliseconds. |
| `browser.long_animation_frame.blocking_duration` | Time the main thread was blocked from responding to high-priority tasks, in milliseconds: the sum, over the tasks in the frame that ran longer than 50 ms, of each task's duration minus 50 ms, with the rendering time added to the longest of them. It is not the frame's total duration and it is not split across the `scripts` entries — scripts carry `duration` and `forced_style_and_layout_duration` instead. See [the spec](https://w3c.github.io/long-animation-frames/#dom-performancelonganimationframetiming-blockingduration). |
| `browser.long_animation_frame.render_start` | Start of the rendering cycle, in milliseconds relative to the time origin. |
| `browser.long_animation_frame.style_and_layout_start` | Start of the style and layout cycle, in milliseconds relative to the time origin. |
| `browser.long_animation_frame.first_ui_event_timestamp` | Time of the first UI event processed during the frame, in milliseconds relative to the time origin. |
| `browser.long_animation_frame.scripts` | Script timing entries attributed to the frame: `start_time`, `duration`, `execution_start`, `invoker`, `invoker_type`, `source_url`, `source_function_name`, `source_char_position`, `pause_duration`, `forced_style_and_layout_duration`, `window_attribution`. `invoker` and `source_url` are passed through `sanitizeUrl` when they are URLs; see Configuration. |

Every entry is named `long-animation-frame` and every script entry is named `script` by the spec, so neither name is repeated as an attribute: the event name already says what the record is.

#### Buffered replay and volume

The instrumentation observes with `buffered: true`, so frames the browser retained from before it started are emitted once, on the first `enable()`. A later `disable()` / `enable()` cycle resumes live observation and does not re-emit frames that were already logged.

No client-side throttle is applied. The performance timeline buffer keeps the first ~200 entries and leaves out the newer ones once it is full (`droppedEntriesCount` goes up), so it only bounds the buffered replay above; a live observer still receives every frame. A throttle would drop the worst frames first: a jank burst that produces dozens of entries would be reported as one, which improves the downstream p95 while the page gets worse. If a hard ceiling is ever needed, prefer accounting over sampling — a per-callback cap plus a dropped count on the following record so the loss stays visible, or the batching shape [Resource Timing](#resource-timing) already uses (`batchSize`, `maxQueueSize`, `forceProcessingAfter`, drained on an idle callback).

#### Correlating frames with interactions

`first_ui_event_timestamp` is a `DOMHighResTimeStamp` on the same clock as `Event.timeStamp`, so a frame can be related to the interaction that triggered it without any context plumbing. The `scripts` array then names the culprit: `invoker` (for example `DOMWindow.onclick`), `invoker_type` (`event-listener`), `source_url`, `source_function_name`, `source_char_position`, and `forced_style_and_layout_duration` (the time that script spent forcing style and layout).

Do not join the two by equality. `first_ui_event_timestamp` is the `timeStamp` of the first UI event whose listener ran in that frame — any UI event — while a web-vitals INP record's `attribution.interactionTime` is the start of the interaction's first event entry. The two only line up when the frame happened to handle that first event before anything else, and a slow interaction can overlap more than one frame (the frame that delayed the input and the frame that ran the handlers), of which at most one can match.

The INP side of the join is already done by [Web Vitals](#web-vitals): with `includeRawAttribution` enabled, every frame that overlaps the interaction is in the record body as `attribution.longAnimationFrameEntries`, scripts included, so read them from there. For any other correlation, match by overlap — a frame overlaps the interaction when its `start_time` precedes the interaction end and its `start_time + duration` follows the interaction start, both of which are on the frame record as attributes — rather than by an exact timestamp comparison. INP says which interaction was slow; Long Animation Frames say which script made it slow.

#### Page attribution

`browser.document.url.full` is stamped by `createDocumentLogRecordProcessor` and `createDocumentSpanProcessor`, and `LocationDocumentProvider` reads `location.href` at emit time, so soft navigations are reflected without extra bookkeeping. The URL is therefore the one current when the record is built, not necessarily the one the frame happened on, and the two differ more often than the replay caveat above suggests: the observer callback runs after the frame has finished, so a handler that blocks for 100 ms and then calls `history.pushState` is reported with the new pathname — often exactly the frame a reviewer wants to place. The buffered replay broadens it further, since those frames carry the URL current when they are emitted rather than the URL they happened on, so the first records of a session can be mislabelled on a page that navigates early. The frame's own timing is unaffected — `start_time` and the record timestamp describe the frame, not the URL, and the record timestamp is `performance.timeOrigin + start_time` — which is what the overlap match above uses.

### Console

```typescript
import { ConsoleInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/console';
```

Provides automatic instrumentation for browser console API calls. By default captures `log`, `warn`, `error`, `info`, and `debug` methods.

#### Configuration

```typescript
new ConsoleInstrumentation({
  // Specify which console methods to capture (default: log, warn, error, info, debug)
  logMethods: ['error', 'warn'],
});
```
#### Captured Attributes
Each `browser.console` event includes the following attributes:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `browser.console.method` | The console method that was called | `error`, `warn`, `log`, `info`, `debug` |

---

### Errors

```typescript
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
```

Emits an `exception` event for every uncaught error (`window.addEventListener('error', ...)`) and unhandled promise rejection (`window.addEventListener('unhandledrejection', ...)`).

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `applyCustomAttributes` | `(error: Error \| string) => Attributes` | — | Returns extra attributes to merge onto the emitted log record. Errors thrown from this hook are caught and logged via the instrumentation diag logger. |

#### Captured Attributes

Each `exception` event includes:

| Attribute | Description |
|-----------|-------------|
| `exception.type` | The error's `name` (omitted when the thrown value is a string). |
| `exception.message` | The error's `message`, or the thrown string itself. |
| `exception.stacktrace` | The error's `stack` (omitted when the thrown value is a string). |

---

### Fetch

```typescript
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
```

Emits a Span for every HTTP request made using the `window.fetch` browser API. This instrumentation also propagates the context for distributed traces.

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignoreUrls` | `Array<string \| RegExp>` | — | List of URLs that we do not want its requests instrumented. You can use strings for a single match or regular expressions to match many. |
| `propagateTraceHeaderCorsUrls` | `Array<string \| RegExp>` | — | List of cross origin URLs to appens trace context headers. You can use strings for a single match or regular expressions to match many. |
| `measureRequestSize` | `boolean` | — | Set it to `true` to add the request size as a Span attribute. |
| `sanitizeUrl` | `(url: string) => string` | — | Returns the given URL with sensitive fields `REDACTED`. |
| `requestHook` | `(span: Span, request: Request) => void` | — | Function that allows you to interact with the Span and the Request object before the request starts. |
| `applyCustomAttributesOnSpan` | `(span: Span, request: Request, result: Response \| FetchError) => void` | — | Function that allows you to interact with the Span once the request is finished. |

#### Captured Attributes

Each `fetch` Span includes:

| Attribute | Description |
|-----------|-------------|
| `http.request.method` | The method of the request in uppercase (GET, POST, PUT, PATCH, QUERY). |
| `http.request.method_original` | Original HTTP method sent by the client in the request line.. |
| `url.full` | Absolute URL describing a network resource according to RFC3986 (sanitized if passing `sanitizeUrl` config option). |
| `server.address` | The hostmane of the request's URL. |
| `server.port` | The port of the request's URL. |
| `http.response.status_code` | HTTP response status code. |
| `error.type` | If request failed. Describes a class of error the operation ended with. |

---

### XHR (XmlHttpRequest)

```typescript
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';
```

Emits a Span for every HTTP request made using the `window.XmlHttpRequest` browser API. This instrumentation also propagates the context for distributed traces.

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

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ignoreUrls` | `Array<string \| RegExp>` | — | List of URLs that we do not want its requests instrumented. You can use strings for a single match or regular expressions to match many. |
| `propagateTraceHeaderCorsUrls` | `Array<string \| RegExp>` | — | List of cross origin URLs to appens trace context headers. You can use strings for a single match or regular expressions to match many. |
| `measureRequestSize` | `boolean` | — | Set it to `true` to add the request size as a Span attribute. |
| `sanitizeUrl` | `(url: string) => string` | — | Returns the given URL with sensitive fields `REDACTED`. |
| `applyCustomAttributesOnSpan` | `(span: Span, request: Request, result: Response \| FetchError) => void` | — | Function that allows you to interact with the Span once the request is finished. |

#### Captured Attributes

Each `fetch` Span includes:

| Attribute | Description |
|-----------|-------------|
| `http.request.method` | The method of the request in uppercase (GET, POST, PUT, PATCH, QUERY). |
| `http.request.method_original` | Original HTTP method sent by the client in the request line.. |
| `url.full` | Absolute URL describing a network resource according to RFC3986 (sanitized if passing `sanitizeUrl` config option). |
| `server.address` | The hostmane of the request's URL. |
| `server.port` | The port of the request's URL. |
| `http.response.status_code` | HTTP response status code. |
| `error.type` | If request failed. Describes a class of error the operation ended with. |


## Useful links

- For more information on OpenTelemetry, visit: <https://opentelemetry.io/>
- For more about OpenTelemetry Browser: <https://github.com/open-telemetry/opentelemetry-browser>
- For help or feedback on this project, join us in [GitHub Discussions][discussions-url]

## License

Apache 2.0 - See [LICENSE][license-url] for more information.

[discussions-url]: https://github.com/open-telemetry/opentelemetry-browser/discussions/landing
[license-url]: https://github.com/open-telemetry/opentelemetry-browser/blob/main/LICENSE
[license-image]: https://img.shields.io/badge/license-Apache_2.0-green.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@opentelemetry/browser-instrumentation
[npm-img]: https://badge.fury.io/js/%40opentelemetry%2Fbrowser-instrumentation.svg
