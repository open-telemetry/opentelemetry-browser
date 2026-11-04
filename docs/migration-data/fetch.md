# Fetch emitted data changes

This compares `@opentelemetry/instrumentation-fetch` 0.223.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using `FetchInstrumentation`
from `experimental/fetch`. The configuration examples in
[the migration guide](../migration-guide.md) describe their own listed versions.

## Request span keys

Both implementations emit HTTP client spans. No built-in span attribute is
renamed between these versions.

| Key                            | Legacy output                                                                                 | New output and query impact                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `http.request.method`          | Normalized method, or `_OTHER` for an unknown method                                          | Same key and normalization                                                                                                            |
| `http.request.method_original` | Original method when different from the normalized value                                      | Same key, conditional on a supplied original method                                                                                   |
| `url.full`                     | Requested URL                                                                                 | Same key, optionally changed by the new `sanitizeUrl` callback                                                                        |
| `server.address`               | Set at completion from the response URL for successful responses, otherwise the requested URL | Set at span creation from the requested URL, so redirects can change the value compared with the old span                             |
| `server.port`                  | Derived from that completion URL, including the default HTTP/HTTPS port                       | Derived at creation from the requested URL, with the same default-port rules                                                          |
| `http.response.status_code`    | Received status, or synthetic `0` on a rejected fetch                                         | Received status only when available, omitted for rejection before a response. A response-body failure retains a received status       |
| `error.type`                   | Status-code string for HTTP errors, absent for network rejection and abort                    | Status-code string for HTTP errors. Also records the error name/message for non-abort failures, such as `TypeError` or `TimeoutError` |
| `http.request.body.size`       | With `measureRequestSize`, a measured nonzero request-body length in bytes                    | Same key and option, with numeric zero also accepted                                                                                  |

Default cancellation identified by error name `AbortError` still leaves the span
status `UNSET` without `error.type`. Other network failures now set span status
`ERROR`, even when no HTTP status exists. A custom abort reason can be treated
as an error if its name is not `AbortError`.

The span name remains the normalized method and kind remains `CLIENT`. Scope
name changes from `@opentelemetry/instrumentation-fetch` to
`@opentelemetry/browser-instrumentation/fetch`; scope version follows the new
package. Update scope filters as well as attribute filters.

## Timing data moves from span events to logs

Register `ResourceTimingInstrumentation` and configure a logs pipeline to get
these replacements. Fetch or XHR instrumentation alone does not emit them. The
event name of the new log record is `browser.resource_timing`.

Legacy network events carried timestamps on the span. The new keys are numeric
attributes on a separate log record, in milliseconds relative to the performance
time origin. They are not Unix timestamps. Timing values can be zero or
restricted by browser privacy and cross-origin timing rules. Old events could be
suppressed by `ignoreNetworkEvents` and zero-value filtering.

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
and `browser.resource_timing.decoded_body_size`, respectively. The compared
legacy 0.223.0 package already omits both old keys.

## Sources

- [Legacy fetch implementation](https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/opentelemetry-instrumentation-fetch/src/fetch.ts)
- [Legacy timing helper](https://github.com/open-telemetry/opentelemetry-js/blob/92b844e8aa7d9655e4b3560154e912c4c1ced64d/experimental/packages/web-common/src/utils-resource-timings.ts)
- [New fetch implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/fetch/instrumentation.ts)
- [New resource-timing implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/resource-timing/instrumentation.ts)
- [Fetch migration tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/e2e-tests/migration/fetch-migration/fetch-migration.test.ts)
