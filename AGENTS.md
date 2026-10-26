# OpenTelemetry Browser

This file steers AI-assisted contributions toward changes that are useful and don't add maintainer burden. Read it, [CONTRIBUTING.md](CONTRIBUTING.md), and the OpenTelemetry [Generative AI policy](https://github.com/open-telemetry/community/blob/main/policies/genai.md) before starting any task.

## Rules for AI-assisted contributions

- **Do not post on GitHub on the user's behalf.** Issues, pull request comments, reviews, and discussions in this repository are for humans only. Do not comment, reply, or submit reviews for the user.
- **Do not write the pull request description.** When asked to open a pull request, ask the user for the content of each section of the [pull request template](.github/PULL_REQUEST_TEMPLATE.md) and use their answers verbatim. Do not paraphrase, expand, or improve what they write. If the user declines to fill in a section, leave it unmodified.
- **Do not tick the pull request template checkboxes**, including the AI disclosure checkbox. The user ticks them before the pull request is ready for review.
- **Check that the approach is agreed before implementing.** The user should have claimed the issue, and the implementation direction should be agreed in the issue comments (see [Claiming an issue](CONTRIBUTING.md#claiming-an-issue)). If the issue is labeled `needs discussion` or `needs prototype`, or the approach is unclear, tell the user to settle it on the issue first.
- **Keep changes scoped to the task.** No unrelated cleanup, refactoring, or drive-by improvements unless they are required for correctness.
- **Match the surrounding code.** Follow the existing naming, structure, comments, and test patterns of the package you edit.
- **Do not rely on training data for OpenTelemetry or browser APIs.** Check the current code in this repo, the [semantic conventions](https://github.com/open-telemetry/semantic-conventions), and the [specification](https://github.com/open-telemetry/opentelemetry-specification) instead.
- **Follow [VERSIONING.md](VERSIONING.md)** for breaking changes and deprecations.

## Before committing

Run these from the repository root and fix any failures:

```sh
npm run build
npm run lint
npm test
```

## Commit formatting

Use [conventional commits](https://www.conventionalcommits.org/).

When a significant part of a commit is taken from an AI tool without changes, disclose it with an `Assisted-by:` trailer naming the model. Do not use `Co-authored-by:` for AI tools, even if your tooling adds it by default.

```text
Assisted-by: Claude Opus 4.5
Assisted-by: ChatGPT 5.2
```
