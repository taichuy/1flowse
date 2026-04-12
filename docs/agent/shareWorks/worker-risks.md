# Worker Risks

1. Run list row copy and `script.js` `runDetails` are duplicated; changing one side only will make drawer content drift from the visible list.
2. Node card labels/statuses and `script.js` `nodeDetails` are duplicated; changing one side only will desync the inspector from the canvas.
3. Canvas node positions are inline in `index.html`, while connectors use fixed SVG paths; moving or adding nodes without updating both will break the visual topology.
4. Compact mode spans the toggle button state, `body.is-compact`, and multiple CSS density selectors; partial edits will leave the alternate density mode inconsistent.
5. Mobile behavior depends on the current breakpoints and horizontal canvas fallback; node size, drawer width, or layout changes can easily break tap targets and narrow-screen stacking.
