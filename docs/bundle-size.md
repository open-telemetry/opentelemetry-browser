# Bundle size reports

The Bundle size pull request workflow compares the PR's base and head commits
in the job summary. It bundles each public JavaScript export with esbuild for
ES2022 browsers, including dependencies, then measures gzip and Brotli bytes
with Size Limit. The `package.json` metadata export is excluded. Export lists
come from each revision's package manifests, so added and removed entries appear
in the comparison.

The `sdk/document` entry also measures a named `LocationDocumentProvider` import.
Compare it with the same entry's `*` row to inspect tree shaking. These are
report-only measurements, with no regression budgets or tree-shaking thresholds.
The existing `npm run validate` checks still apply separately.

To measure locally:

```sh
npm ci
npm run build --workspace=@opentelemetry/browser-instrumentation --workspace=@opentelemetry/browser-sdk
npm run size
```

Use `npm run size -- --why` to inspect
dependency contributions in a local bundle analyzer.

For a base/head comparison, install and build both checkouts independently,
then run both measurements from the head checkout, using its tooling:

```sh
BUNDLE_SIZE_ROOT=/absolute/path/to/base npx --no-install size-limit --json > /tmp/base-size.json
npx --no-install size-limit --json > /tmp/head-size.json
node scripts/bundle-size-report.js /tmp/base-size.json /tmp/head-size.json
```

CI runs on `pull_request` with read-only permissions, no persisted checkout
credentials, and SHA-pinned official actions. It does not post PR comments.
Size increases do not fail the job, but build or measurement errors do.
