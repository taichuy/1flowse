# Worker Readiness Notes

Task: `e5635f29`
State: readiness only. Do not modify `tmp/demo/*` until the approved change list is forwarded by `Codex`.

## Current Touch Map

- `tmp/demo/index.html`
  - shell hero and dashboard content: `96-276`
  - run list triggers: `141-178`
  - studio canvas, connectors, nodes: `287-368`
  - inspector panel: `372-409`
  - drawer scaffold: `412-458`
- `tmp/demo/script.js`
  - run drawer data: `1-32`
  - node inspector data: `34-71`
  - drawer open / close wiring: `83-117`
  - node selection wiring: `128-149`
  - compact toggle wiring: `151-154`
- `tmp/demo/styles.css`
  - shell layout baseline: `32-347`
  - run row visuals: `424-441`
  - editor + inspector visuals: `608-764`
  - drawer visuals: `771-790`
  - compact mode selectors: `829-848`
  - responsive breakpoints: `854-897`

## High-Risk Couplings

1. Run list rows are duplicated between HTML and `runDetails`.
   - If a change list touches run title, status, runtime, or contract, HTML and JS must stay synchronized.
2. Node cards are duplicated between HTML and `nodeDetails`.
   - If a change list touches node title, status, or I/O copy, card markup and inspector data must stay synchronized.
3. Canvas layout is hard-coupled between inline node coordinates and fixed SVG connector paths.
   - `index.html:301-318` defines the connector paths.
   - `index.html:321-368` defines the node positions via inline `left/top`.
   - Any node move, add, or remove is not a text-only change.
4. Compact mode spans three layers.
   - HTML button anchor: `index.html:81-90`
   - JS state wiring: `script.js:151-154`
   - CSS density selectors: `styles.css:829-848`
5. Mobile behavior depends on the current breakpoints and canvas overflow fallback.
   - Main breakpoints are `styles.css:854-897`
   - The `<=640px` path is the most fragile for node sizing and tap targets.
6. Drawer behavior is simple but stateful.
   - Open state depends on `body.is-drawer-open`, `aria-hidden`, and backdrop `hidden`.
   - If the approved change list expands drawer semantics, it likely becomes `HTML + JS + CSS`, not copy-only.

## Fast Classification Once Change List Arrives

- Copy-only changes in hero, metrics, form, API, or empty state: likely `HTML only`
- Run list or drawer detail changes: likely `HTML + JS`
- Node copy changes without layout changes: likely `HTML + JS`
- Node position, count, or topology changes: `HTML + SVG path updates`, likely `CSS` review too
- Density or responsive behavior changes: `HTML + JS + CSS`
- New interaction depth beyond current drawer + inspector rules: pause and report to `Codex`

## Current Blocker

- No approved change list from `planner` / `Codex` yet.
- Until that arrives, readiness work is complete and no `tmp/demo/*` edit should begin.
