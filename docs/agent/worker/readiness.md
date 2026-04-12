# Demo Readiness Note

Task: `cf66766a`

Current instruction state:
- Readiness only.
- `tmp/demo/*` remains unmodified until the approved change list is forwarded by `Codex`.

## File Map

| File | Responsibility | Key regions |
| --- | --- | --- |
| `tmp/demo/index.html` | Single-page demo structure, content, and interaction anchors | shell sidebar/topbar/hero: `16-129`; dashboard cards: `131-272`; editor studio: `274-408`; drawer scaffold: `412-458` |
| `tmp/demo/styles.css` | Shared visual tokens, shell/editor styling, compact mode, responsive behavior | tokens and shell baseline: `1-347`; shell cards/forms/list: `349-585`; editor canvas/inspector: `587-769`; drawer: `771-827`; compact mode: `829-852`; breakpoints: `854-915` |
| `tmp/demo/script.js` | Static detail data and interaction wiring | run drawer data: `1-32`; node inspector data: `34-71`; drawer open/close: `73-119`; node selection: `121-149`; compact toggle: `151-155` |
| `tmp/demo/desktop.png` | Current desktop reference screenshot | reference only |
| `tmp/demo/mobile.png` | Current mobile reference screenshot | reference only |

## Current Interaction Baseline

Using `frontend-logic-design`, the page is currently coherent around two detail rules:

| Area | L0 overview | L1 focus/detail | Notes |
| --- | --- | --- | --- |
| Recent flow runs | clickable list rows | right-side drawer | Every run row follows one consistent detail pattern. |
| Editor studio | visible canvas nodes | inspector panel updates in place | Same section keeps context while changing focused node. |
| Form/API/empty-state cards | static overview blocks | none | These cards currently do not introduce a second drill-down rule. |

This means approved revisions should preferably preserve:
- one stable shell detail model for list items;
- one stable editor focus model for nodes;
- no extra modal/page-level interaction unless the change list explicitly requires it.

## Likely Touchpoints Once Approved

1. Content and section ordering will primarily touch `tmp/demo/index.html`.
2. Visual baseline changes will primarily touch shared tokens, card rules, and media queries in `tmp/demo/styles.css`.
3. Any change to run rows or drawer detail will need both HTML row content and `runDetails` in `tmp/demo/script.js` kept in sync.
4. Any change to editor node labels, statuses, or inspector copy will need both node markup and `nodeDetails` kept in sync.
5. Any change to compact mode behavior will span the toggle button in HTML, the body state in JS, and the `body.is-compact` selectors in CSS.

## Implementation Risks

1. The page duplicates content between markup and JS data objects. Changing labels or status semantics in only one place will create drift.
2. The current shell and editor already use different detail mechanics by design. Adding a third interaction rule without intent will make the page feel inconsistent.
3. Mobile behavior depends on responsive stacking plus horizontal scroll for the canvas at `max-width: 640px`. Node repositioning or width changes can easily break that fallback.
4. Compact mode is stateful and global. Spacing or sizing changes that ignore `body.is-compact` will leave the alternate density mode visually incomplete.
5. Drawer behavior is simple and static. If the approved revision expands drawer semantics, that may require more than copy or styling edits.
6. The visual spec expects shell and editor to stay in one product language. Touching only one layer's color, radius, or shadow rules risks breaking that baseline.

## Verification Approach

Desktop quick pass:
- Load the page at a wide viewport such as `1440x900`.
- Check shell alignment across sidebar, hero, dashboard, and studio sections.
- Click each run row and verify drawer title, status, runtime, contract, and copy all update correctly.
- Close the drawer via close button, backdrop, and `Escape`.
- Click each node and verify selection state plus inspector content stay synchronized.
- Toggle compact mode on and off and check spacing, card density, and node sizing.

Mobile quick pass:
- Check a narrow viewport such as `390x844`.
- Verify sidebar becomes top content, topbar actions wrap cleanly, and cards collapse to one column.
- Verify drawer width remains within the viewport.
- Verify the canvas still works through horizontal scrolling and nodes remain tappable.
- Re-run one drawer interaction, one node selection, and the density toggle with touch targets in mind.

## Fastest Implementation Path After Approval

1. Convert the approved change list into a touch map: `HTML only`, `CSS only`, or `HTML + CSS + JS`.
2. Patch `tmp/demo/index.html` first so final structure and text anchors are correct.
3. Patch `tmp/demo/styles.css` second to restore layout, visual balance, compact mode, and mobile behavior.
4. Patch `tmp/demo/script.js` last only where interaction data or state wiring changed.
5. Run the desktop/mobile manual pass above immediately after edits.

Current readiness judgment:
- Scope is small and isolated.
- The fastest safe implementation path is to preserve existing interaction anchors and only widen JS changes when the approved revision explicitly changes behavior.
