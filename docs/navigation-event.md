# Navigation event

## Purpose

- Provide a reliable signal that a navigation occurred for analytics, session, and user-journey analysis.
- Complement (not replace) the `browser.navigation_timing` event, which is used for performance metrics.

## Use cases

### Reliable count of page loads (hard navigations)

For full page loads, this event SHOULD be emitted as early as practical after the browser commits the new URL. Durations and detailed milestones for page load are captured separately by the Navigation Timing event (from the PerformanceNavigationTiming API). Navigation timing data is typically sent when timing fields are finalized (often after the `load` event), which means the event might be lost if the user leaves the page early or if `load` event never fires. The navigation event therefore provides a more reliable analytics signal, while navigation timing is used for performance analysis.

Hard page loads MUST be distinguishable from other navigation types. Implementations MUST include the `same_document` attribute to indicate whether the navigation replaced the document (`same_document = false`) or not.

### Capturing same-document navigations

#### Soft navigations

The concept of soft navigation (e.g., SPA route changes) is not standardized and is typically implemented by framework routers. Practical heuristics include: initiated by a user action (for example, a click) and resulting in both a URL change (e.g., `history.pushState`/`replaceState`) and a visible change in page content.

Since soft navigations are analyzed similarly to page loads, they SHOULD be represented using this navigation event as well.

TODO: Define how soft navigations are identified and represented in semantic conventions. This is not standardized yet.

#### Other URL changes

This event can also capture same-document navigations for deeper session and user-journey analysis. Examples can include:

* Hash changes (for example, links to sections within the same document)
* Query/search parameter changes when application state is encoded in the URL
* Certain back/forward interactions that do not replace the document (depending on history state)

The main purpose of the navigation event is to cover hard page loads and soft navigations. Other same-document navigations can introduce noise. Therefore, by default the instrumentation SHOULD NOT collect these additional events, but MAY allow them to be enabled via configuration.
