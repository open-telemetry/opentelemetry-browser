# Exception emitted data changes

This compares `@opentelemetry/instrumentation-web-exception` 0.17.0 with
`@opentelemetry/browser-instrumentation` 0.10.0, using `ErrorsInstrumentation`
from `experimental/errors`. Return to
[the migration guide](../migration-guide.md) for configuration and SDK setup.

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

Update scope filters. Uncaught errors with no `event.error`, such as
cross-origin `Script error.`, now get a record with the event message.
Rejections with a null or undefined reason are skipped.

`applyCustomAttributes` still runs after the built-in attributes, so it can
override them.

## Sources

- [Legacy exception implementation](https://github.com/open-telemetry/opentelemetry-js-contrib/blob/207b9dd1c7e30c12d5dec0e54e476e361b209484/packages/instrumentation-web-exception/src/instrumentation.ts)
- [New errors implementation](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/errors/instrumentation.ts)
- [New errors tests](https://github.com/open-telemetry/opentelemetry-browser/blob/8802bea646f1dc70be34f782c6a2a22c6ecec7f9/packages/instrumentation/src/errors/instrumentation.test.ts)
