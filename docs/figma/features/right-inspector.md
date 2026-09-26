# Contextual right inspector

Date: 2026-09-27. Status: implemented for the scoped Design inspector.

Reference: live Figma desktop, Illigma file, frame `6:1274` and text `6:1281`; official right-sidebar article 360039832014 read in full.

Observed: separate Position, Layout/Auto layout, Appearance, Typography, Fill, Stroke, Effects sections. Selecting a text child changes controls; auto-layout-controlled X/Y and alignment are disabled. Individual padding toggles between paired and four-side controls. Width/height and inspector resize affordances are contextual. Only read-only selection and UI toggles were used; reference property values were not edited.

Scope: reorganize existing working controls, contextual page/object/frame/text states, mixed-value fields, typography spacing and rectangle radius, panel resizing, stable scrolling and selection-aware popovers. Preserve bottom Export, user colors, and existing Pathfinder. Prototype, libraries, full frame stroke/appearance and unsupported Figma controls are not added as empty placeholders.

Acceptance: select page/shape/text/layout child and verify sections and disabled states; edit properties and verify actual geometry, undo/reload; mixed opacity/paint values must not display the first object's value as shared; panel resize changes viewport boundary without moving artwork; existing pen/drag behavior remains intact.

Implementation: `src/inspector.js` organizes existing controls once and preserves listeners. `renderProperties` supplies selection context. Panel width is a local UI preference, not a document mutation. Paint applies to all selected frames without changing page background. Typography spacing and rectangle radius use document transactions.

Verification: full 77-test suite passed, including pointer continuity, pen, effects/export, layout, inspector persistence, mixed opacity and text spacing. Additional multi-frame paint regression added. Visual screenshots checked for text and grid auto layout at 1440 × 1000. Production build passes.

Deliberate differences: line height uses the editor's existing multiplier; frame stroke/rotation/radius and multi-frame geometry fields remain unsupported; no Prototype, libraries, or variables UI is implied. Grid tracks use existing textual track controls. This is a contextual inspector implementation, not full Figma parity.

Container identity refinement: normal frames use a hash icon; auto-layout frames use horizontal/vertical stacks or grid tiles according to flow. Group members retain their shape icon plus a corner-bracket group marker. A fully selected group is explicitly named Group in the inspector. Layer cache includes grouping, direction and wrap so icons refresh immediately. This is an Illigma clarity improvement, not a claim of exact Figma glyph parity.
