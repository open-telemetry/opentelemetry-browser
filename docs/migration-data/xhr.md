# XHR emitted data changes

This compares `@opentelemetry/instrumentation-xml-http-request` 0.223.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using `XhrInstrumentation` from
`experimental/xhr`. The configuration examples in
[the migration guide](../migration-guide.md) describe their own listed versions.

The tables cover built-in output. Application hooks, SDK processors, resources
and exporters can add or change fields independently.

## Request span keys

Both implementations emit HTTP client spans. No built-in span attribute is
renamed between these versions.

| Key                            | Legacy output                                                                                       | New output and query impact                                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `http.request.method`          | Normalized method, or `_OTHER` for an unknown method                                                | Same key and normalization                                                                                          |
| `http.request.method_original` | Original method when different from the normalized value                                            | Same key and condition                                                                                              |
| `url.full`                     | Requested URL                                                                                       | Same key, optionally changed by the new `sanitizeUrl` callback                                                      |
| `server.address`               | Requested host                                                                                      | Same key and requested host                                                                                         |
| `server.port`                  | Requested port, including the default HTTP/HTTPS port                                               | Same key and default-port rules                                                                                     |
| `http.response.status_code`    | Received HTTP status when nonzero                                                                   | Set on the `load` event, including status `0` if that event reports it. Omitted on abort, network error and timeout |
| `error.type`                   | HTTP status string for HTTP errors, `error` for network failure, `timeout` for timeout              | HTTP status string for HTTP errors, `Error` for network failure, `TimeoutError` for timeout                         |
| `http.request.body.size`       | Measured request-body length in bytes when `measureRequestSize` is enabled and measurement succeeds | Same key and option, but a measured zero is no longer recorded                                                      |

Intentional abort remains `UNSET` without `error.type`. Network failures and
timeouts remain span status `ERROR`; update their `error.type` string filters.
Span status is an envelope field, not an attribute key. The old status message
`error` or `timeout` is no longer set on the new span.

The span name remains the normalized method and kind remains `CLIENT`. Scope
name changes from `@opentelemetry/instrumentation-xml-http-request` to
`@opentelemetry/browser-instrumentation/xhr`; scope version follows the new
package. The span starts at `send()` instead of `open()`, using the context at
`send()`. Time before `send()` no longer contributes to its duration.

## Removed XHR lifecycle span events

| Old span event | New replacement                                        |
| -------------- | ------------------------------------------------------ |
| `open`         | None                                                   |
| `send`         | None                                                   |
| `loaded`       | None                                                   |
| `abort`        | None                                                   |
| `error`        | None, use span status and `error.type` for the failure |
| `timeout`      | None, use span status and `error.type` for the timeout |

Resource-timing logs do not replace these lifecycle events.

## Timing data moves from span events to logs

Register `ResourceTimingInstrumentation` and configure a logs pipeline to get
these replacements. Fetch or XHR instrumentation alone does not emit them. The
event name of the new log record is `browser.resource_timing`.

Legacy network events carried timestamps on the span. The new keys are numeric
attributes on a separate log record, in milliseconds relative to the performance
time origin. They are not Unix timestamps. Timing values can be zero or
restricted by browser privacy and cross-origin timing rules. Old events could be
suppressed by `ignoreNetworkEvents` and zero-value filtering. These are signal
and representation changes, not attribute-only renames.

| Legacy span event name  | New log attribute                                 |
| ----------------------- | ------------------------------------------------- |
| `fetchStart`            | `browser.resource_timing.fetch_start`             |
| `domainLookupStart`     | `browser.resource_timing.domain_lookup_start`     |
| `domainLookupEnd`       | `browser.resource_timing.domain_lookup_end`       |
| `connectStart`          | `browser.resource_timing.connect_start`           |
| `secureConnectionStart` | `browser.resource_timing.secure_connection_start` |
| `connectEnd`            | `browser.resource_timing.connect_end`             |
| `requestStart`          | `browser.resource_timing.request_start`           |
| `responseStart`         | `browser.resource_timing.response_start`          |
| `responseEnd`           | `browser.resource_timing.response_end`            |

The resource-timing record also has the following keys, which have no matching
network span event in the compared legacy package:

| New log attribute                                | Value                                                                  |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `url.full`                                       | Resource URL, independently captured without the fetch/XHR sanitizer   |
| `browser.resource_timing.initiator_type`         | Resource initiator, such as `fetch` or `xmlhttprequest`                |
| `browser.resource_timing.duration`               | Resource load duration in milliseconds                                 |
| `browser.resource_timing.transfer_size`          | Transferred bytes, including headers                                   |
| `browser.resource_timing.encoded_body_size`      | Encoded body bytes                                                     |
| `browser.resource_timing.decoded_body_size`      | Decoded body bytes                                                     |
| `browser.resource_timing.redirect_start`         | Redirect start in milliseconds relative to the performance time origin |
| `browser.resource_timing.redirect_end`           | Redirect end on the same time basis                                    |
| `browser.resource_timing.worker_start`           | Service worker start on the same time basis                            |
| `browser.resource_timing.next_hop_protocol`      | Network protocol, for example `h2`                                     |
| `browser.resource_timing.render_blocking_status` | Render blocking status, when the browser exposes it                    |

The logs have `severityNumber: 9` (`INFO`). A matching new fetch/XHR span can
supply their trace context. A timing record does not recreate the legacy
`CORS Preflight` child span, and a match is not guaranteed for every request.

Versions before 0.220.0 could also add `http.response_content_length` and
`http.response_content_length_uncompressed` to spans. Both are absent from the
new spans. The related log keys are `browser.resource_timing.encoded_body_size`
and `browser.resource_timing.decoded_body_size`, respectively. The old
uncompressed key was conditional on different encoded and decoded sizes, so this
is not an identical presence test. The compared legacy 0.223.0 package already
omits both old keys.

## Sources

- [Legacy XHR implementation](https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-xml-http-request/src/xhr.ts)
- [Legacy XHR event names](https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-xml-http-request/src/enums/EventNames.ts)
- [Legacy timing helper](https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/web-common/src/utils-resource-timings.ts)
- [New XHR implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/xhr/instrumentation.ts)
- [New XHR tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/xhr/instrumentation.test.ts)
- [New resource-timing implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/resource-timing/instrumentation.ts)
