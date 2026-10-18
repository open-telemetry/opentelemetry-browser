# Migrating from the JavaScript browser packages

This guide covers moving browser telemetry from `opentelemetry-js` and
`opentelemetry-js-contrib` to this repository. You can migrate fetch and XHR
instrumentation while keeping your existing SDK setup. Other migrations change
the telemetry signal or have gaps that need an application-specific decision.

The APIs below match `@opentelemetry/browser-instrumentation` 0.8.2 and
`@opentelemetry/browser-sdk` 0.5.0 in this repository. Both packages are
experimental. The fetch and XHR comparisons use the legacy packages at 0.223.0;
check your installed versions before applying the behavior tables to older
releases. The overall consolidation is tracked in [#209][consolidation].

> [!WARNING]
> Older `@opentelemetry/instrumentation-fetch` versions emitted
> `http.response_content_length` and `http.response_content_length_uncompressed`.
> These keys are absent from the new fetch spans, with no span replacement.
> Update collector processors and queries that depend on them.
> For response sizes, register `ResourceTimingInstrumentation` and export logs:
> `browser.resource_timing.encoded_body_size` and
> `browser.resource_timing.decoded_body_size` carry the corresponding sizes on
> `browser.resource_timing` log records when the browser exposes them.

## Key changes at a glance

The table summarizes the changes below for the versions listed above. Follow the
linked sections for configuration details, outcome comparisons, and unresolved gaps.

| Previous package or API | New package, API, or behavior | What to do |
| --- | --- | --- |
| Separate instrumentation packages | `@opentelemetry/browser-instrumentation/experimental/*` | Use the full subpath, including `experimental/`; there is no root export. See [package mapping](#package-and-import-mapping). |
| `FetchInstrumentation` / `XMLHttpRequestInstrumentation` | `FetchInstrumentation` / `XhrInstrumentation` | Replace imports and the XHR constructor/config type (`XhrInstrumentationConfig`), then remove old instances, including auto-enabled ones, to avoid double patching. |
| Single-value `propagateTraceHeaderCorsUrls` | Array of strings or regular expressions | Wrap single values in an array. Same-origin propagation still works without an allowlist; cross-origin servers must accept the injected headers. |
| Network hooks and request headers | Distinct fetch/XHR hook signatures | Keep fetch and XHR custom-attribute signatures separate. `requestHook` is fetch-only, `FetchError.status` is optional, and caller-owned `RequestInit` headers are preserved. See [configuration changes](#configuration-changes). |
| `clearTimingResources`, `ignoreNetworkEvents` | No equivalent options | Remove them. Register `ResourceTimingInstrumentation` and export logs for timing data. |
| Captured network URLs | Optional fetch/XHR `sanitizeUrl` callback | Supply an application sanitizer if needed. It changes captured `url.full`, not requests, and does not sanitize separate timing records. Redaction is off by default. |
| Fetch failures with synthetic HTTP status `0` | No HTTP status without a response; network failures/timeouts are errors | Update failure queries and hooks. Default `AbortError` cancellation stays `UNSET`; custom abort reasons can count as failures. See [fetch outcomes](#fetch-outcomes). |
| XHR `error.type`: `error` / `timeout` | `Error` / `TimeoutError` | Update error filters. HTTP status/error behavior for responses and intentional aborts stays as listed in [XHR outcomes](#xhr-outcomes-and-timing). |
| XHR span starts at `open()` and waits for timing collection | Starts at `send()` and ends on the terminal event | Recheck duration and parentage: time before `send()` is excluded and its active context determines the parent. |
| Network timing events, CORS preflight child spans, XHR lifecycle events | Separate `browser.resource_timing` log records | Update trace/event queries and configure logs export. Matching new fetch/XHR context can correlate records, but does not recreate the old trace structure. |
| Legacy fetch/XHR instrumentation scopes | `@opentelemetry/browser-instrumentation/fetch` and `/xhr` | Update scope filters; scope versions follow the new package. Legacy 0.223.0 already uses stable HTTP attributes, older versions need their semconv migration notes. |
| `BrowserNavigationInstrumentation` | `NavigationInstrumentation`, `NavigationInstrumentationConfig` | Use `experimental/navigation`, retain navigation options, and update scope filters to `@opentelemetry/browser-instrumentation/navigation`. Events remain logs; test canceled and successful navigations. |
| Navigation `defaultSanitizeUrl` export | Application-provided `sanitizeUrl` | Remove the helper import, it is not a public export here. |
| `ExceptionInstrumentation`, `GlobalErrorsInstrumentationConfig` | `ErrorsInstrumentation`, `ErrorsInstrumentationConfig` | Use `experimental/errors` and scope `@opentelemetry/browser-instrumentation/errors`. Keep the `applyCustomAttributes` hook; exceptions remain log events. |
| User-interaction spans, arbitrary `eventNames`, `shouldPreventSpanCreation` | `UserActionInstrumentation` click log events | Use `experimental/user-action`; `autoCapturedActions` accepts only click (empty disables capture). Use `applyCustomLogRecordData` for customization and separately retain needed event coverage or interaction tracing/context propagation. |
| `documentLoad`, `documentFetch`, `resourceFetch` span hierarchy | Navigation, navigation-timing and resource-timing log events | Configure logs and evaluate [document-load gaps](#document-load-timing-and-trace-gaps). Keep legacy instrumentation for required spans, customization, server `<meta name="traceparent">` linkage or missing paint coverage while #327 is open. |
| `documentLoad` duration (`fetchStart` to `loadEventEnd`) | Difference of navigation-timing fields on the same record | Subtract `browser.resource_timing.fetch_start` from `browser.navigation_timing.load_event_end` only when the end is positive and at least the start. Values are milliseconds; incomplete records can have zero end time. |
| Load-span paint events / individual long-task spans | Web Vitals log events, including FCP, with no direct replacement | Do not treat `WebVitalsInstrumentation` as equivalent paint or long-task coverage. Keep required legacy measurements or choose another approach. |
| `@opentelemetry/plugin-react-load` | No replacement here | The package was deprecated and removed; choose component-load instrumentation separately. |
| `getWebAutoInstrumentations()` | Explicit instrumentation array | Choose each migration before removing the legacy helper; it enabled document-load, fetch, user-interaction and XHR. |
| `WebTracerProvider` startup | Optional `startBrowserSdk()` / `quickStartBrowserSdk()` or signal-specific startup | These are initialization functions, not renamed provider classes. Existing compatible providers can stay. Add a logger provider and logs pipeline for event instrumentations; avoid a second global provider for the same signal. |
| Resource service attributes and SDK configuration | `serviceName`, `serviceVersion`, `resourceAttributes`, signal options | Transfer sampler, limits and processors into `traces`. Custom `processors` replace default OTLP processing; explicit signal `exportConfig` also adds OTLP. See [SDK setup](#sdk-setup). |
| Zone context manager and existing propagators | Synchronous default context manager; W3C Trace Context and Baggage defaults | Keep needed Zone dependencies and pass `traces.contextManager` / `traces.propagators`. Verify async parentage, the default does not carry arbitrary async context. |
| Exporter endpoints behind a path prefix | Full signal URLs in `logs.exportConfig` / `traces.exportConfig` | Use full URLs to retain prefixes. Quick-start and root `exportConfig.url` replace the path with `/v1/logs` and `/v1/traces`; exclude telemetry traffic and check `invalidConfig`. |
| Existing metrics SDK | No metrics provider in Browser SDK | Keep independently configured metrics. |
| `@opentelemetry/web-common` session utilities | `@opentelemetry/browser-sdk/session` | Move supported session API imports. Old network-timing and DOM utilities are not re-exported; see [session management](./session-management.md). |
| `@opentelemetry/opentelemetry-browser-detector` | No exported Browser SDK detector subpath yet | Keep the existing detector as needed; #458 tracks its move and automatic SDK integration is a separate discussion. |

## Package and import mapping

All new instrumentations come from `@opentelemetry/browser-instrumentation`.
Import each one through its full `experimental/*` subpath. The package has no
root export, and the `experimental/` segment is required.

### Instrumentations with a corresponding implementation

| Previous package and export | New import path | New export and signal |
| --- | --- | --- |
| `@opentelemetry/instrumentation-fetch`: `FetchInstrumentation` | `@opentelemetry/browser-instrumentation/experimental/fetch` | `FetchInstrumentation`; HTTP client spans |
| `@opentelemetry/instrumentation-xml-http-request`: `XMLHttpRequestInstrumentation` | `@opentelemetry/browser-instrumentation/experimental/xhr` | `XhrInstrumentation`; HTTP client spans |
| `@opentelemetry/instrumentation-browser-navigation`: `BrowserNavigationInstrumentation` | `@opentelemetry/browser-instrumentation/experimental/navigation` | `NavigationInstrumentation`; `browser.navigation` log events |
| `@opentelemetry/instrumentation-web-exception`: `ExceptionInstrumentation` | `@opentelemetry/browser-instrumentation/experimental/errors` | `ErrorsInstrumentation`; `exception` log events |

Configuration types are exported from the same subpaths:
`FetchInstrumentationConfig`, `XhrInstrumentationConfig`,
`NavigationInstrumentationConfig`, and `ErrorsInstrumentationConfig`. The legacy
XHR type was `XMLHttpRequestInstrumentationConfig`; the legacy exception type
was `GlobalErrorsInstrumentationConfig`.

### Packages without a direct replacement

| Previous package | Current migration path |
| --- | --- |
| `@opentelemetry/instrumentation-document-load` | [Navigation, navigation-timing, and resource-timing events](#document-load-timing-and-trace-gaps) expose related data. They do not recreate the `documentLoad` span hierarchy. Keep the legacy instrumentation if that hierarchy is required; [#327][document-load-decision] tracks the remaining design decisions. |
| `@opentelemetry/instrumentation-user-interaction` | `UserActionInstrumentation` from `@opentelemetry/browser-instrumentation/experimental/user-action` captures clicks as log events. It does not replace the old interaction spans, arbitrary `eventNames`, or their context propagation. See [user interactions](#user-interactions). |
| `@opentelemetry/instrumentation-long-task` | There is no shipped long-task replacement in the current package exports. `WebVitalsInstrumentation` at `@opentelemetry/browser-instrumentation/experimental/web-vitals` emits Web Vitals events, which do not replace individual long-task spans. Follow [#209][consolidation] for this migration. |
| `@opentelemetry/plugin-react-load` | Deprecated and removed from contrib, with no replacement here. See the [removal decision][react-load-removal]. Component-load spans require a separately chosen instrumentation approach. |
| `@opentelemetry/auto-instrumentations-web` | There is no `getWebAutoInstrumentations()` export in this repository. Construct an explicit instrumentation array. The legacy helper enables document-load, fetch, user-interaction, and XHR; decide how to migrate each of those before removing it. |

### SDK and supporting packages

| Previous package | Current migration path |
| --- | --- |
| `@opentelemetry/sdk-trace-web` | `@opentelemetry/browser-sdk` exports `startBrowserSdk()` and `quickStartBrowserSdk()` for logs and traces. `@opentelemetry/browser-sdk/traces` exports `startTracesSdk()` for traces alone. These initialize SDKs; they are not renamed `WebTracerProvider` classes. See [SDK setup](#sdk-setup) and the [JavaScript trace SDK migration notes][trace-sdk-migration]. |
| `@opentelemetry/web-common` session utilities | Import session APIs such as `createSessionManager`, `createSessionSpanProcessor`, `createSessionLogRecordProcessor`, `createDefaultSessionIdGenerator`, and `createLocalStorageSessionStore` from `@opentelemetry/browser-sdk/session`. See [session management](./session-management.md). This subpath does not re-export the old network-timing or DOM utility functions. |
| `@opentelemetry/opentelemetry-browser-detector` | The proposed `@opentelemetry/browser-sdk/browser-detector` subpath is not exported yet. Keep the existing detector where required; [#458][browser-detector-migration] tracks its move. Automatic detector integration with SDK startup is a separate discussion. |
| `@opentelemetry/context-zone` / `@opentelemetry/context-zone-peer-dep` | No replacement package is exported here. If your application depends on a Zone context manager, keep that dependency and pass the manager when configuring traces. The Browser SDK's default manager only carries context through synchronous calls and explicitly bound callbacks. |

## Migrate fetch and XHR first

Install the new instrumentation package, keeping the SDK and registration
dependencies your application already uses:

```sh
npm install @opentelemetry/browser-instrumentation
```

Replace the old constructors in your existing registration. Run this after your
existing tracer provider, context manager, and propagator are configured:

```typescript
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';

const networkConfig = {
  ignoreUrls: [/^https:\/\/telemetry\.example\.com\/v1\//],
  propagateTraceHeaderCorsUrls: [/^https:\/\/api\.example\.com\//],
};

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation(networkConfig),
    new XhrInstrumentation(networkConfig),
  ],
});
```

Replace the example endpoints with your own. Same-origin requests can propagate
trace context without a CORS allowlist; cross-origin propagation requires
`propagateTraceHeaderCorsUrls` and a server that accepts the injected headers.

Remove the old fetch and XHR instances from your startup code, including any
enabled through `getWebAutoInstrumentations()`. Registering both implementations
against the same browser API can patch it twice and produce duplicate telemetry.
Use separate runs or isolated pages to compare old and new output.

### Configuration changes

| Option | Migration |
| --- | --- |
| `enabled` | Supported by both new instrumentations through `InstrumentationConfig`. |
| `ignoreUrls` | Still accepts `(string \| RegExp)[]`. Strings match the complete URL; regular expressions can match part of it. |
| `propagateTraceHeaderCorsUrls` | Now requires `(string \| RegExp)[]`. The legacy packages also accepted a single string or regular expression; wrap that value in an array. |
| `measureRequestSize` | Still available in both. |
| `applyCustomAttributesOnSpan` | Fetch: `(span, request: Request \| RequestInit, result: Response \| FetchError) => void`. XHR: `(span, xhr: XMLHttpRequest) => void`. Keep the two signatures distinct. |
| `requestHook` | Available for fetch: `(span, request: Request \| RequestInit) => void`. The current XHR config has no `requestHook`. |
| `clearTimingResources`, `ignoreNetworkEvents` | Remove these options. The new implementations do not attach Resource Timing entries as network span events. Use `ResourceTimingInstrumentation` for separate timing events if needed. |
| `sanitizeUrl` | New opt-in callback in fetch and XHR. It changes the captured `url.full`, not the request URL. Supply your own `(url: string) => string` function if redaction is required. |

Fetch's `FetchError.status` is optional: no response means no HTTP status code.
Check whether a status exists in custom hooks instead of treating every failure
as status `0`. The new fetch instrumentation also preserves caller-owned
`RequestInit` headers during trace-header injection; do not depend on those
headers being modified in place. This does not imply every `Request` object is
immutable during instrumentation.

URL redaction is not enabled by default. A fetch or XHR `sanitizeUrl` callback
also does not sanitize separately emitted resource-timing or navigation-timing
records. Review those log records and their processing separately.

### Fetch outcomes

The [fetch migration tests][fetch-parity] exercise both implementations in
separate iframes. They compare span name, kind, `http.request.method`, `url.full`,
`server.address`, and `server.port` for six scenarios. For received responses,
they also compare span status, HTTP status code, and `error.type`.

| Scenario | Legacy fetch 0.223.0 | New fetch |
| --- | --- | --- |
| Successful response | Status `UNSET`; received HTTP status | Same |
| HTTP 500 | Status `ERROR`; HTTP status `500`; `error.type: "500"` | Same |
| HTTP 204 with no body | Status `UNSET`; HTTP status `204` | Same |
| Intentional abort before a response | Status `UNSET`; no `error.type`; synthetic HTTP status `0` | Status `UNSET`; no `error.type`; HTTP status omitted |
| Network failure | Status `UNSET`; no `error.type`; synthetic HTTP status `0` | Status `ERROR`; `error.type: "TypeError"` in the tested browser; HTTP status omitted |
| `AbortSignal.timeout()` before a response | Status `UNSET`; no `error.type`; synthetic HTTP status `0` | Status `ERROR`; `error.type: "TimeoutError"`; HTTP status omitted |

The new implementation distinguishes an intentional cancellation from a timeout
or network failure and omits HTTP status when no response was received, following
the [HTTP client span conventions][http-spans]. Error-rate dashboards may therefore
show additional failed requests after migration even if application traffic is
unchanged. Update queries that used HTTP status `0` to identify failures.

Cancellation is recognized when the rejected error's `name` is `AbortError`.
Calling `AbortController.abort(reason)` with a custom reason whose name differs
can therefore be classified as a failure rather than an intentional cancellation.
The abort row above covers the default abort reason.

These tests establish the listed comparisons, not identical spans in every
respect. Instrumentation scope names, timing events, and auxiliary spans change.
The new fetch scope is `@opentelemetry/browser-instrumentation/fetch`; its version
is the `browser-instrumentation` package version.

### XHR outcomes and timing

There is no legacy/new XHR parity harness yet. The comparison below comes from
the [legacy XHR source at 0.223.0][legacy-xhr] and the new
[implementation][new-xhr] and [XHR tests][xhr-tests]. Do not apply the fetch
failure behavior to legacy XHR: that package already marks network failures and
timeouts as errors.

| Scenario | Legacy XHR 0.223.0 | New XHR |
| --- | --- | --- |
| HTTP 2xx or 3xx | Status `UNSET`; received HTTP status | Same |
| HTTP 4xx or 5xx | Status `ERROR`; received HTTP status; status-code string in `error.type` | Same |
| Intentional abort before a response | Status `UNSET`; no `error.type`; HTTP status omitted | Same |
| Network error | Status `ERROR`; `error.type: "error"`; HTTP status omitted | Status `ERROR`; `error.type: "Error"`; HTTP status omitted |
| Timeout | Status `ERROR`; `error.type: "timeout"`; HTTP status omitted | Status `ERROR`; `error.type: "TimeoutError"`; HTTP status omitted |

The legacy XHR span starts during `open()`; the new span starts during `send()`.
A delay between the two calls therefore no longer contributes to the span's
duration, and the active context at `send()` determines its parent. The new
instrumentation ends the span on the terminal XHR event without the legacy
300 ms wait for Resource Timing collection. Its scope is
`@opentelemetry/browser-instrumentation/xhr`.

For both fetch and XHR, the new implementations omit the old network-timing span
events and CORS preflight child spans. XHR also omits the legacy `open`, `send`,
and terminal-event span events. If you need DNS, connection, transfer-size, or
resource-duration data, register `ResourceTimingInstrumentation` from
`@opentelemetry/browser-instrumentation/experimental/resource-timing` and configure
logs export. It emits `browser.resource_timing` records and can attach the
associated new fetch/XHR span context when a matching timing entry is found.
It does not recreate the old trace structure.

Both legacy packages at 0.223.0 already use stable HTTP attribute names such as
`http.request.method`, `url.full`, and `http.response.status_code`. For older
versions, also consult their [fetch][legacy-fetch-readme] and
[XHR][legacy-xhr-readme] semantic-convention notes before reusing dashboards.

## Event-based migrations

Navigation, errors, user actions, Web Vitals, and timing instrumentations emit
structured log records. A tracer provider and a traces-only Collector pipeline
will not export those records. Configure a logger provider and a logs pipeline,
or use the combined [Browser SDK setup](#sdk-setup).

### Navigation and exceptions

Rename `BrowserNavigationInstrumentation` to `NavigationInstrumentation` and
change its import to the navigation subpath in the mapping table. The
`applyCustomLogRecordData`, `sanitizeUrl`, and `useNavigationApiIfAvailable`
options remain available. When explicitly enabled, the Navigation API path
observes committed `currententrychange` events. The current legacy navigation
source also uses this event; check your installed release before assuming this
behavior changed during migration. Exercise canceled navigations as well as
successful route changes when checking application behavior.

The legacy navigation package also exported `defaultSanitizeUrl`. That helper is
not a public export of the current Browser instrumentation package. Supply an
application sanitizer through `sanitizeUrl` instead of copying the helper import.

Rename `ExceptionInstrumentation` to `ErrorsInstrumentation` and change its
import to the errors subpath. It still records uncaught errors and unhandled
promise rejections as `exception` log events. The custom-attribute hook remains
`applyCustomAttributes: (error: Error | string) => Attributes`.

In both cases, update filters based on the instrumentation scope as well as the
import. The new scopes are `@opentelemetry/browser-instrumentation/navigation`
and `@opentelemetry/browser-instrumentation/errors`.

### User interactions

The old `UserInteractionInstrumentation` creates spans and accepts arbitrary DOM
`eventNames` plus `shouldPreventSpanCreation`. The new
`UserActionInstrumentation` emits `browser.user_action.click` log events.
`autoCapturedActions` currently accepts only `'click'`; an empty array disables
automatic capture. `applyCustomLogRecordData` can customize emitted records.

This is a change in the observability model. It does not create an interaction
span to parent downstream requests, and it has no equivalent to the old
`shouldPreventSpanCreation` callback. Keep or replace application-specific event
coverage and interaction tracing deliberately before removing the legacy
instrumentation. Changing to the new Browser SDK's default context manager is
a separate decision from changing this instrumentation.

## Document-load timing and trace gaps

The [current SIG direction][document-load-direction] is to use navigation,
navigation-timing, and resource-timing events rather than port the
`documentLoad` spans. Register those three instrumentations and configure logs
export as shown in [SDK setup](#sdk-setup) to collect the available timing data.
They do not reproduce the document-load trace structure. The Browser SIG still
needs to settle load duration as a span or event, related-record grouping, and
paint timing coverage in [#327][document-load-decision].

| Data previously represented by document-load instrumentation | Data available now | Gap |
| --- | --- | --- |
| Initial page URL and navigation | `NavigationInstrumentation` at `@opentelemetry/browser-instrumentation/experimental/navigation` emits `browser.navigation`, including `url.full` and `browser.navigation.same_document`. | A navigation event does not represent the duration of document loading. |
| `documentLoad` span from `fetchStart` to `loadEventEnd` | `NavigationTimingInstrumentation` at `@opentelemetry/browser-instrumentation/experimental/navigation-timing` emits `browser.navigation_timing` with `browser.resource_timing.fetch_start` and `browser.navigation_timing.load_event_end`. Their difference gives the corresponding duration in milliseconds when both values are available and loading is complete. | No `documentLoad` span or its child relationships. Do not substitute the entire navigation entry's `duration` without checking its start point. |
| `documentFetch` child span and network phase events | The navigation-timing record includes `browser.resource_timing.*` fields for fetch, DNS, connection, request, response, and transfer sizes. | No `documentFetch` child span or network span events. |
| `resourceFetch` child spans | `ResourceTimingInstrumentation` at `@opentelemetry/browser-instrumentation/experimental/resource-timing` emits one `browser.resource_timing` log event per captured resource entry. | No automatic parent `documentLoad` span. Correlation with new fetch/XHR spans does not establish a document-load hierarchy. |
| `firstPaint` and `firstContentfulPaint` span events | `WebVitalsInstrumentation` at `@opentelemetry/browser-instrumentation/experimental/web-vitals` includes FCP among its `browser.web_vital` events. | Web Vitals events do not reproduce the old paint events on the load span; full paint coverage remains part of the decision. |
| Server-provided `<meta name="traceparent">` connection | The old document-load implementation extracts this context for its span tree. | The current navigation and timing event combination does not reproduce that extraction and tree. |

Navigation-timing values are milliseconds relative to the page's performance
time origin. To recover the old load duration, subtract
`browser.resource_timing.fetch_start` from
`browser.navigation_timing.load_event_end` on the same record. Only calculate it
when the end value is greater than zero and at least the start value. The
instrumentation can emit incomplete timing on page hide or after retries, so a
zero `load_event_end` does not mean the page loaded instantly.

Keep the legacy document-load instrumentation if you still require its spans,
server-to-document trace relationship, or span customization callbacks. You can
evaluate the new timing events alongside it, but account for overlapping
measurements in dashboards. Remove the legacy package only after deciding that
the event data in the table is sufficient for your application. Applications
that need the missing trace or paint behavior should keep it while #327 is open.

## SDK setup

Using the new instrumentations does not require adopting the Browser SDK. You
can continue to configure compatible OpenTelemetry tracer and logger providers
directly. For an existing tracing setup that only needs logs, the SDK also
exports `startLogsSdk()` from `@opentelemetry/browser-sdk/logs`.

If you choose to move SDK initialization, replace the existing provider startup
with a single Browser SDK setup; do not initialize a second global provider for
the same signal. Install the SDK and the API peer dependency:

```sh
npm install @opentelemetry/browser-sdk @opentelemetry/browser-instrumentation @opentelemetry/api
```

This example assumes an ESM-capable bundler and an OTLP/HTTP endpoint with both
logs and traces pipelines:

```typescript
import { startBrowserSdk } from '@opentelemetry/browser-sdk';
import { ErrorsInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/errors';
import { FetchInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/fetch';
import { NavigationInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation';
import { NavigationTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/navigation-timing';
import { ResourceTimingInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/resource-timing';
import { XhrInstrumentation } from '@opentelemetry/browser-instrumentation/experimental/xhr';

const ignoreUrls = [/^https:\/\/telemetry\.example\.com\/v1\//];

const sdk = startBrowserSdk({
  serviceName: 'browser-app',
  logs: {
    exportConfig: { url: 'https://telemetry.example.com/v1/logs' },
  },
  traces: {
    exportConfig: { url: 'https://telemetry.example.com/v1/traces' },
  },
  instrumentations: [
    new FetchInstrumentation({ ignoreUrls }),
    new XhrInstrumentation({ ignoreUrls }),
    new ErrorsInstrumentation(),
    new NavigationInstrumentation(),
    new NavigationTimingInstrumentation(),
    new ResourceTimingInstrumentation({ ignoreUrls }),
  ],
});

if (sdk.invalidConfig) {
  throw new Error('Browser telemetry configuration is invalid');
}
```

Start instrumentation early in the browser entry point. Replace the endpoint
URLs and exclude your own telemetry traffic from network and resource-timing
capture. For a Collector behind a path prefix, pass full signal URLs as above.
The shorthand `quickStartBrowserSdk({ exportUrl, ... })` and root
`exportConfig.url` derive `/v1/logs` and `/v1/traces` by replacing the URL path.

When transferring an existing configuration, review these settings:

- Move the resource's service name and version to `serviceName` and
  `serviceVersion`; additional resource attributes go in `resourceAttributes`.
- Pass an existing context manager through `traces.contextManager` when needed.
  The default is synchronous; it does not preserve context automatically across
  arbitrary `await`, timer, or event-listener boundaries. Configure
  `traces.propagators` if you need something other than the default W3C Trace
  Context and Baggage propagators.
- Transfer the sampler, span limits, and span processors into the corresponding
  `traces` options. Custom `processors` replace the default OTLP processor;
  adding that signal's `exportConfig` explicitly also adds OTLP export. The same
  rule applies to `logs.processors`.
- The Browser SDK currently configures logs and traces, not a metrics provider.
  Keep any independently configured metrics SDK that your application needs.
- Update backend queries for the new scope names, error classifications, and
  log-event signals. Verify trace-header propagation and request parentage in
  the application, including asynchronous interactions.

See the [SDK README](../packages/sdk/README.md) for the full configuration API.

## Source and test references

| Area | Reference |
| --- | --- |
| Public import paths and versions | [Instrumentation exports](../packages/instrumentation/package.json), [SDK exports](../packages/sdk/package.json) |
| Fetch comparison | [Legacy fetch source][legacy-fetch], [new fetch config](../packages/instrumentation/src/fetch/types.ts), [migration assertions][fetch-parity] |
| XHR comparison | [Legacy XHR source][legacy-xhr], [new XHR source][new-xhr], [XHR tests][xhr-tests] |
| Event migrations | [Legacy navigation][legacy-navigation], [legacy exceptions][legacy-exceptions], [legacy user-interaction config][legacy-user-interaction], [current instrumentation README](../packages/instrumentation/README.md) |
| Document timing and correlation | [Legacy document-load source][legacy-document-load], [navigation-timing attributes](../packages/instrumentation/src/navigation-timing/semconv.ts), [resource-timing attributes](../packages/instrumentation/src/resource-timing/semconv.ts), [pending decision][document-load-decision] |
| SDK defaults | [SDK startup](../packages/sdk/src/startBrowserSdk.ts), [context manager](../packages/sdk/src/core/context.ts), [configuration types](../packages/sdk/src/core/types.ts) |

[consolidation]: https://github.com/open-telemetry/opentelemetry-browser/issues/209
[document-load-decision]: https://github.com/open-telemetry/opentelemetry-browser/issues/327
[document-load-direction]: https://github.com/open-telemetry/opentelemetry-browser/issues/327#issuecomment-6052435295
[react-load-removal]: https://github.com/open-telemetry/opentelemetry-js/issues/7110
[browser-detector-migration]: https://github.com/open-telemetry/opentelemetry-browser/issues/458
[trace-sdk-migration]: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/3.x/migration-guide.md
[http-spans]: https://github.com/open-telemetry/semantic-conventions/blob/main/docs/http/http-spans.md#status
[fetch-parity]: ../e2e-tests/migration/fetch-migration/fetch-migration.test.ts
[new-xhr]: ../packages/instrumentation/src/xhr/instrumentation.ts
[xhr-tests]: ../packages/instrumentation/src/xhr/instrumentation.test.ts
[legacy-fetch]: https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-fetch/src/fetch.ts
[legacy-xhr]: https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-xml-http-request/src/xhr.ts
[legacy-fetch-readme]: https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-fetch/README.md#semantic-conventions
[legacy-xhr-readme]: https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-xml-http-request/README.md#semantic-conventions
[legacy-navigation]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-browser-navigation/src/instrumentation.ts
[legacy-exceptions]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-web-exception/src/instrumentation.ts
[legacy-user-interaction]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-user-interaction/src/types.ts
[legacy-document-load]: https://github.com/open-telemetry/opentelemetry-js-contrib/blob/main/packages/instrumentation-document-load/src/instrumentation.ts
