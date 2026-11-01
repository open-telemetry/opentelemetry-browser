# Exception emitted data changes

This compares `@opentelemetry/instrumentation-web-exception` 0.17.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using `ErrorsInstrumentation`
from `experimental/errors`. Return to
[the migration guide](../migration-guide.md) for configuration and SDK setup.

The tables cover built-in output. Application hooks, SDK processors, resources
and exporters can add or change fields independently.

## Log keys and envelope fields

Both packages emit exception log records for uncaught errors and unhandled
promise rejections. No built-in attribute key is removed, added or renamed
between these versions. A logs pipeline remains necessary.

| Field or attribute     | Legacy output                                         | New output and query impact                                                                    |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `eventName`            | `exception`                                           | Unchanged                                                                                      |
| `exception.type`       | Error name for Error values, absent for strings       | Same key and string behavior                                                                   |
| `exception.message`    | Error message or the string error itself              | Same key, also accepts a nonempty `ErrorEvent.message` when `event.error` is null or undefined |
| `exception.stacktrace` | Error stack when available, absent for strings        | Same key and string behavior                                                                   |
| `severityNumber`       | `17` (`ERROR`)                                        | Unchanged                                                                                      |
| `timestamp`            | Explicit current time supplied by the instrumentation | Not supplied by the instrumentation, the logs SDK supplies its default                         |
| `observedTimestamp`    | Explicit current time supplied by the instrumentation | Not supplied by the instrumentation, the logs SDK supplies its default                         |
| Scope name             | `@opentelemetry/instrumentation-web-exception`        | `@opentelemetry/browser-instrumentation/errors`                                                |
| Scope version          | Legacy package version                                | New package version                                                                            |

The timestamps are log envelope fields, not attributes. Their absence from the
instrumentation's `emit()` argument does not mean exported SDK log records lack
timestamps. Neither implementation sets a log `body` by default.

Update scope filters. The new message fallback can add records such as the
cross-origin `Script error.` case that the old implementation did not handle
safely. Rejections with null or undefined reasons are skipped by the new
implementation. Do not assume arbitrary rejected objects are serialized or that
a message or stack exists for every rejection value.

`applyCustomAttributes` still returns attributes merged after the built-in
exception attributes, so it can override their values. Existing custom keys are
application-specific and are not renamed by this migration. There is no
span-to-log or span-event-to-log change for this package.

## Sources

- [Legacy exception implementation](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/207b9dd1c7e30c12d5dec0e54e476e361b209484/packages/instrumentation-web-exception/src/instrumentation.ts)
- [New errors implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/errors/instrumentation.ts)
- [New errors tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/errors/instrumentation.test.ts)
