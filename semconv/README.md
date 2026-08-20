# Federated Browser Semantic Conventions

This directory holds the semantic conventions that the packages in this repository emit, modelled
as a federated semantic convention registry ([OTEP 4815](https://github.com/open-telemetry/opentelemetry-specification/blob/main/oteps/4815-semantic-conventions-schema-v2.md)).
The registry manifest declares the upstream
[OpenTelemetry semantic conventions](https://github.com/open-telemetry/semantic-conventions) as an
exact-version dependency, so our events can reference upstream attributes without redefining them.

The same approach is used by
[opentelemetry-android](https://github.com/open-telemetry/opentelemetry-android/tree/main/semconv).

## Why these live here

The semantic-conventions
[CONTRIBUTING guide](https://github.com/open-telemetry/semantic-conventions/blob/main/CONTRIBUTING.md)
places conventions specific to a single runtime or a narrowly scoped implementation in the
corresponding repository, and most of the conventions below are browser-only. Defining them here
also gives a concrete starting point for the client-side registry proposed in
[community#3594](https://github.com/open-telemetry/community/issues/3594).

Names already covered upstream are deliberately not redefined. The `browser.web_vital` and
`exception` events are imported from the dependency registry by name, and the `error.*`, `http.*`,
`server.*`, `session.*`, and `url.*` attributes we emit are referenced from it.

## Layout

```text
model/
├── manifest.yaml          # registry identity and the upstream dependency
└── browser/
    ├── registry.yaml      # attributes defined by this repository
    ├── events.yaml        # our events, plus imports of upstream events
    ├── spans.yaml         # the HTTP client span the fetch instrumentation records
    └── common.yaml        # attributes the SDK adds to all telemetry it emits
```

## Checking the registry

Weaver is not required to install, build, or check the packages in this repository. To validate the
model, run the [`weaver`](https://github.com/open-telemetry/weaver) CLI over `model/`:

```bash
docker run --rm -v "$PWD/semconv/model:/home/weaver/model" \
  otel/weaver:v0.25.1 registry check -r /home/weaver/model
```

This resolves every `ref` against the pinned upstream version, so it catches unknown attribute
references, malformed enum members, and duplicate ids.

Do not pass `--future`: at the pinned upstream version it promotes the upstream registry's own
`definition/2` file-format warnings to errors, which says nothing about this model.

## Status

The model currently describes what the instrumentations emit today, with no new conventions and no
renames. Generating the TypeScript attribute and event-name constants from it, and enforcing the
model in CI, are tracked in
[#403](https://github.com/open-telemetry/opentelemetry-browser/issues/403). Until then the
constants in the `semconv.ts` files under `packages/` remain hand-written, and changing an
attribute means changing both.
