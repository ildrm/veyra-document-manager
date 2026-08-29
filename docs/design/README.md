# Veyra design specification

The concept images in [`concepts/`](concepts/) are the visual source of truth for the first vertical slice. The primary desktop reference is `document-desktop.png`; the responsive reference is `document-mobile.png`. Library/upload, Search, and Ask each have a dedicated desktop reference.

## System inventory

- **Direction:** planar, editorial, calm, evidence-first enterprise software.
- **Background:** true white in light mode; never cream or beige. Dark mode uses a cool graphite canvas.
- **Typography:** compact modern grotesk for application chrome and a serif reading face only for document/evidence excerpts.
- **Container model:** rail + open work surface + contextual panel. Tables and separated rows are preferred to card grids.
- **Signature motif:** a thin indigo evidence thread maps a citation to the exact highlighted source clause.
- **Density:** compact navigation and controls; generous reading measure around source content.
- **Radii:** 6/9/12/14px. Borders are crisp 1px. Shadows are rare and functional.
- **Motion:** 120–180ms for state continuity, disabled under reduced-motion preferences.
- **Responsive:** the evidence panel becomes the primary stacked content on mobile; bottom navigation replaces the rail; source provenance remains visible.

## Allowed first-viewport copy

The document detail reference permits the exact title `Acme Master Services Agreement`, status `Verified`, version `v4`, question `What uptime have we committed to for this customer?`, answer `99.95% monthly uptime.`, evidence label `Master Services Agreement · v4 · Page 8`, and organization `Northstar Technologies`. Additional visible copy is limited to functional navigation, controls, and document content required by the workflow.

## Accessibility contract

All controls have a visible focus state, icon-only controls have accessible names, dialogs trap and restore focus, touch targets are at least 44px on mobile, document/evidence text meets WCAG 2.2 AA contrast, and motion respects `prefers-reduced-motion`.
