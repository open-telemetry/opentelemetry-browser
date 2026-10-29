# React INP log enrichment

This optional example adds experimental `react_inp_blame.*` attributes to the
INP log that the web-vitals instrumentation already emits. It uses
`react-inp-blame/otel` 1.0.0 through Browser SDK `logs.processors`. It doesn't
start a second web-vitals INP observer or change the SDK's conventions.

## Run

From the repository root, with the Node/npm versions in `package.json`:

```sh
npm ci
npm run build --workspace=@opentelemetry/browser-sdk --workspace=@opentelemetry/browser-instrumentation
npm run dev --workspace=examples-react-inp
```

Open the printed local URL, click **Run an interaction**, then hide the tab.
web-vitals reports its final INP when the page becomes hidden. Allow the batch
processor to drain, then inspect the console. The button performs synthetic work
to make a local interaction easy to inspect. Its timings aren't benchmark data.

The explicit exporter defaults to `ConsoleLogRecordExporter`. For OTLP/HTTP:

```sh
VITE_OTLP_LOGS_URL=http://localhost:4318/v1/logs npm run dev --workspace=examples-react-inp
```

Use a receiver configured for browser CORS. This value is the full logs
endpoint. Client build variables are public, so don't put a secret in them. The
example doesn't configure credentials or a receiver. Browser SDK also
initializes its trace signal, but this example registers no trace
instrumentation and creates no spans.

## Processor order and export

`src/telemetry.ts` passes this pipeline to `logs.processors`:

```ts
logs: {
  processors: [
    new InpBlameLogRecordProcessor(),
    new InpPrivacyProcessor(),
    new BatchLogRecordProcessor({ exporter, scheduledDelayMillis: 1000 }),
  ],
}
```

At Browser SDK source revision
[`4967aee`](https://github.com/open-telemetry/opentelemetry-browser/blob/4967aee83d02fabbae6e4e56b903b711c663beb1/packages/sdk/src/logs/startLogsSdk.ts),
with the lockfile's `@opentelemetry/sdk-logs` 0.223.0, supplying
`logs.processors` without `logs.exportConfig` omits the automatic OTLP log
exporter. Root `exportConfig` alone isn't propagated into that custom pipeline
at this revision. This example supplies its own batch exporter as the last
processor. At the same revision, enrichment and privacy processors plus
signal-level `logs.exportConfig` would append the SDK's OTLP batch exporter
instead.

These are observations of the pinned source, not a settled export contract.
[#376](https://github.com/open-telemetry/opentelemetry-browser/issues/376)
remains open with `needs discussion`, and linked
[#424](https://github.com/open-telemetry/opentelemetry-browser/pull/424) is
open. The thread discusses warnings, root export configuration propagation and
other pipeline choices. This example doesn't implement or choose an outcome for
them. Its single-export configuration depends on the current omission of the
automatic exporter. If that behavior changes, review the configuration before
using the example, since retaining an explicit exporter alongside an automatic
one could export twice. The optional example is proposed for discussion on that
basis.

Enrichment and filtering must precede export, including a synchronous
`SimpleLogRecordProcessor`. A later processor cannot repair a record that has
already left the page.

One fixture record captured by the Node test exporter, shortened to its event,
attributes and context (synthetic data, no browser interaction):

```json
{
  "eventName": "browser.web_vital",
  "attributes": {
    "browser.web_vital.name": "inp",
    "browser.web_vital.value": 240,
    "browser.web_vital.id": "synthetic-inp",
    "browser.web_vital.rating": "needs-improvement",
    "react_inp_blame.status": "matched",
    "react_inp_blame.blame.kind": "handler",
    "react_inp_blame.blame.ms": 226,
    "react_inp_blame.blame.confidence": "measured",
    "react_inp_blame.react_status": "reading",
    "react_inp_blame.commits.count": 0,
    "react_inp_blame.commits.rendered": 0,
    "react_inp_blame.follow_ups.count": 0
  },
  "spanContext": {
    "traceId": "0123456789abcdef0123456789abcdef",
    "spanId": "0123456789abcdef",
    "traceFlags": 1
  }
}
```

`measured` is the library's enum in this synthetic fixture. It isn't an accuracy
claim. Existing metric attributes, timestamp and trace/span context remain on
the same record. There is no extra emitted INP log. Other web vitals and
ordinary logs pass through unchanged.

## Collection, privacy and missing data

The runtime installs before dynamically loading telemetry and react-dom. This
standalone page owns that installation. In an existing application, let one
bootstrap own installation and disposal rather than disposing a shared runtime.

Development installs on every page load. Production builds leave runtime
collection off unless `VITE_INP_PRODUCTION=true` is set at build time. That
opt-in samples runtime collection on 10% of page loads, not individual
interactions. Base web-vitals telemetry still runs on every page.
`VITE_INP_INCLUDE_NAMES=true` separately opts in to names at build time after
reviewing the application's data.

Defaults keep `includeRawAttribution`, User Timing tracks, the overlay and debug
global off. Runtime labels use attributes rather than DOM text. Before export,
`InpPrivacyProcessor` keeps only the listed status, enum and numeric enrichment
fields. It removes component paths, handler names, script/listener names and
details, which can include DOM identifiers or user-derived URL paths. This
filter applies to the enrichment fields, not arbitrary application telemetry.
Raw attribution remains off even when names are enabled.

Missing reports produce `not-installed`, `sampled-out`, `no-report` or
`library-error`, with no invented component or handler. An early INP emission or
one missing attribution time can have no matching report. No nearest-time guess
is made. If LoAF is absent, available Event Timing data can still be enriched,
with unavailable script/layout fields omitted. If Event Timing is unsupported,
the runtime cannot install. The base INP log still follows the instrumentation's
own browser support. This example doesn't add `reportAllChanges` or depend on
the attribution PR.

## Teardown and verification

Hide the tab to obtain its final metric before using
**Stop telemetry and
unmount**.
Stop shuts down the SDK (disables instrumentations and drains pending exports),
then disposes this page's runtime and unmounts React. Repeated calls share the
same promise. Runtime cleanup also runs on shutdown rejection. Shutdown can't
force web-vitals to report an unreported final metric.

The upstream web-vitals implementation cannot remove its underlying listeners,
so disabling it stops emission but leaves those listeners registered. Reload to
start again. Vite module disposal also calls Stop. There is no custom pagehide
shutdown, since that would permanently stop telemetry on a bfcache restore. Do
not rely on an awaited shutdown completing during browser unload.

```sh
npm test --workspace=examples-react-inp -- --silent=false --reporter=verbose
npm run build --workspace=examples-react-inp
npm run lint:ci
```

The Node suite uses the actual LoggerProvider, Browser SDK, exporter pipeline
and published enrichment processor with synthetic reports. Fixture setup reaches
the pinned library's private report state and report builder, isolated to the
test file. It does not test browser observers, React hook installation or real
visibility/bfcache behavior. Tests cover enrichment before batch and synchronous
export, context/time/value preservation, non-INP records, missing reports and
attribution time, absent LoAF, name filtering and opt-in, production defaults,
instrumentation disable, draining export and idempotent cleanup including
failure.

## Compatibility hook

`applyCustomLogRecordData` currently receives the plain log before
`logger.emit`. If processors aren't exposed by a distribution, this is a
compatibility route:

```ts
import { inpBlameAttributes } from 'react-inp-blame/otel';

new WebVitalsInstrumentation({
  includeRawAttribution: false,
  applyCustomLogRecordData(record) {
    const safe = Object.fromEntries(
      Object.entries(inpBlameAttributes(record)).filter(
        ([name, value]) =>
          name === 'react_inp_blame.status' || typeof value === 'number',
      ),
    );
    record.attributes = { ...record.attributes, ...safe };
  },
});
```

The hook is subject to
[#440](https://github.com/open-telemetry/opentelemetry-browser/issues/440) and
the open removal
[PR #462](https://github.com/open-telemetry/opentelemetry-browser/pull/462).
Prefer the processor route. Experimental `react_inp_blame.*` names belong to the
library. Vendor-neutral `browser.web_vital.attribution.*` proposals remain on
[client-side #35](https://github.com/open-telemetry/semantic-conventions-client-side/issues/35),
with SDK mapping on
[#471](https://github.com/open-telemetry/opentelemetry-browser/issues/471) and
[#486](https://github.com/open-telemetry/opentelemetry-browser/pull/486).

## Source-checked hook matrix

Checked October 16, 2026. Vendor rows describe source APIs only. No vendor
runtime or backend export was tested, and no vendor adoption or endorsement is
claimed. An upstream-derived SDK need not expose its upstream processors.

| SDK and inspected revision                                                                                                                                                                                                      | Existing hook / output                                                                                                                                          | Verification and limits                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream Browser SDK, 0.5.0 source at [`4967aee`](https://github.com/open-telemetry/opentelemetry-browser/blob/4967aee83d02fabbae6e4e56b903b711c663beb1/packages/sdk/src/logs/startLogsSdk.ts)                                  | `logs.processors`, existing INP log                                                                                                                             | Node fixture/export and SDK wiring tested with sdk-logs 0.223.0 and react-inp-blame 1.0.0. Real browser capture remains unverified.                                                                                                                                                                  |
| Embrace, 2.30.0 source at [`3c9e206`](https://github.com/embrace-io/embrace-web-sdk/blob/3c9e2060e252c7caf214f4232f6c4c597d6e79cd/packages/web-sdk/src/sdk/initSDK.ts)                                                          | `logProcessors`, before vendor processors, existing INP log                                                                                                     | Source-compatible processor route. Its [INP timestamp](https://github.com/embrace-io/embrace-web-sdk/blob/3c9e2060e252c7caf214f4232f6c4c597d6e79cd/packages/web-sdk/src/instrumentations/web-vitals/WebVitalsInstrumentation/WebVitalsInstrumentation.ts) uses interaction time. Runtime unverified. |
| Elastic EDOT Browser, 0.3.0 source at [`70e2302`](https://github.com/elastic/elastic-otel-rum-js/blob/70e230202c0d81f301b9ec1a4687b30153c72c6f/packages/opentelemetry-browser/lib/sdk.js)                                       | `instrumentations['web-vitals'].applyCustomLogRecordData`, existing upstream INP log                                                                            | Distribution config does not expose custom log processors. Hook only, subject to its resolved instrumentation version and #440. Runtime unverified. Use current `exportConfig` and `web-vitals` keys from this source.                                                                               |
| Honeycomb Web, 1.5.1 source at [`b647db9`](https://github.com/honeycombio/honeycomb-opentelemetry-web/blob/b647db99b5dd32f5dafa73e9c3e2dc89ff08ff65/packages/honeycomb-opentelemetry-web/src/web-vitals-autoinstrumentation.ts) | `webVitalsInstrumentationConfig.inp.applyCustomAttributes(metric, span)`, INP span                                                                              | Same `inpBlameAttributes(metric)` helper can match interaction IDs. LogRecordProcessor route unsupported for these INP spans. Runtime unverified.                                                                                                                                                    |
| Grafana Faro, 2.12.1 source at [`71ec884`](https://github.com/grafana/faro-web-sdk/blob/71ec884a3bffbbfc017dbd3be94ae74af032dc74/packages/web-sdk/src/instrumentations/webVitals/webVitalsWithAttribution.ts)                   | [`beforeSend`](https://github.com/grafana/faro-web-sdk/blob/71ec884a3bffbbfc017dbd3be94ae74af032dc74/packages/core/src/config/types.ts), web-vitals measurement | Helper can use `values.interaction_time` and stringify enrichment into measurement context. Missing time means no match. OTel log processor route unsupported for these measurements. Runtime unverified.                                                                                            |
