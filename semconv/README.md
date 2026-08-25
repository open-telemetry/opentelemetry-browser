# Federated Browser Semantic Conventions

This directory holds the semantic conventions that the packages in this repository emit, modelled as a federated semantic convention registry. The registry manifest declares the upstream [OpenTelemetry semantic conventions](https://github.com/open-telemetry/semantic-conventions) as an exact-version dependency, so our events can reference upstream attributes without redefining them.

## Why these live here

The semantic-conventions [CONTRIBUTING guide](https://github.com/open-telemetry/semantic-conventions/blob/main/CONTRIBUTING.md) places conventions specific to a single runtime or a narrowly scoped implementation in the
corresponding repository, and most of the conventions below are browser-only.

Names already covered upstream are deliberately not redefined. The `browser.web_vital` and
`exception` events are imported from the dependency registry by name, and the `http.request.body.size`,
`session.id`, and `url.full` attributes we emit are referenced from it.

Upstream conventions that are already stable are not modelled here at all. Their constants ship in
the root export of [`@opentelemetry/semantic-conventions`](https://www.npmjs.com/package/@opentelemetry/semantic-conventions),
so the instrumentations import them directly and this registry has nothing to add. What it does
cover is the attributes we emit that upstream has not stabilised, which the package exports only
from its `/incubating` entry point — today `http.request.body.size` on the fetch and XHR spans,
and `session.id` on everything the SDK emits.

## Layout

```text
model/
├── manifest.yaml          # registry identity and the upstream dependency
└── browser/
    ├── registry.yaml      # attributes defined by this repository
    ├── events.yaml        # our events, plus imports of upstream events
    ├── spans.yaml         # non-stable attributes the HTTP client instrumentations record
    └── common.yaml        # attributes the SDK adds to all telemetry it emits
```

## Checking the registry

Weaver is not required to install, build, or check the packages in this repository. To validate the model, run the [`weaver`](https://github.com/open-telemetry/weaver) CLI over `model/`:

```bash
docker run --rm -v "$PWD/semconv/model:/home/weaver/model" \
  otel/weaver:v0.25.1 registry check -r /home/weaver/model
```

This resolves every `ref` against the pinned upstream version, so it catches unknown attribute references, malformed enum members, and duplicate ids.
