# Contributing Guide

Welcome! We're excited you're here, and we'd love your help! 

## Prerequisites

If you haven't yet, you will need to get set up following the main [OpenTelemetry Contributor Guide](https://github.com/open-telemetry/community/blob/main/guides/contributor/README.md).

Contributing to this project requires **Node.js >= 24** and **npm ^11.16.0**

```bash
npm install -g npm@11
```

You can also follow instructions from [Node JS](https://nodejs.org/en/download/) to download or upgrade node and npm.

## Quick Start

1. Create a fork of this repo by clicking on the `Fork` button in the upper right corner of this page
1. Clone the repo forked and set the upstream

```sh
git clone https://github.com/$user/opentelemetry-browser.git
cd opentelemetry-browser
git remote add upstream https://github.com/open-telemetry/opentelemetry-browser.git
```

1. Build and run tests

```
npm ci
npm run build
npm test
```

1. To keep your fork up to date

```
git fetch upstream
git checkout main
git rebase upstream/main 
```

For a more detailed git walkthrough, read the [kubernetes github workflow](https://github.com/kubernetes/community/blob/main/contributors/guide/github-workflow.md)

## Guidelines

- Follow [conventional commits](https://www.conventionalcommits.org/)
- Sign all commits
- Add tests for new functionality
- Run `npm run lint` before submitting

For detailed contribution guidelines, see the [OpenTelemetry JS Contributing Guide](https://github.com/open-telemetry/opentelemetry-js/blob/main/CONTRIBUTING.md).

## Find your first issue

- Open the [Issues](https://github.com/open-telemetry/opentelemetry-browser/issues) tab
- Filter down to label:"good first issue" or label:"available"
- If you are having trouble finding an appropriately sized issue, reach out in the slack or ask in a SIG meeting

## Raising issues

Have a feature request or a bug to report?

Look through [open issues](https://github.com/open-telemetry/opentelemetry-browser/issues) to see if one has already been filed. If so, feel free to react or add a comment.

If not, create a new issue following the issue template. Examples, screenshots, clear questions, and highlighting decisions to make will make it easier for issue triage.

## Next Steps

There is a lot more to learn for this Special Interest Group (SIG) and OpenTelemetry in general. Here are some helpful links to contextualize the work you'll be doing.

### General OpenTelemetry Guides

* [OpenTelemetry mission, vision, and values](https://github.com/open-telemetry/community/blob/main/mission-vision-values.md) - this guide will help you understand the direction OpenTelemetry as a whole is heading in and why.
* [General Contribution Lifecycle and Processes](https://github.com/open-telemetry/community/blob/main/guides/contributor/processes.md) - this guide helps you understand how to find things to work on, get help, and how changes are merged and released.
* [Membership, roles, and responsibilities](https://github.com/open-telemetry/community/blob/main/guides/contributor/membership.md) - this guide helps the roles and responsibilities of contributors as well as how one advances beyond a member to a triager, approver, or maintainer.

### OpenTelemetry Browser Guides

* [Browser events](docs/browser-observability-model.md) - provides a comprehensive list of browser events emitted by the instrumentation library.
* [SIG Operations](docs/sig-operations.md) - documents the processes used by the browser SIG
