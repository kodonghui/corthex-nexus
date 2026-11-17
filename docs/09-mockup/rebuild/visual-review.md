# Mockup visual review

[한국어](visual-review.ko.md)

Scope: actual Chromium rendering and controls of local synthetic HTML. This is not verification of the real service or a stage-12 QA pass.

## Measurements

Rendered A’s 91 states × four widths × two themes = 728, plus B’s eleven normal screens × four widths × two themes = 88, for 816 renders in Chromium 156.0.8078.79. Widths were 320, 390, 768 and 1440px in both themes. page-check reported zero errors and 176 warnings, zero page-script errors and zero external network requests. No clipping, page overflow, Korean word-split, minimum-target or unlabelled-field error was reported. Complete untruncated coverage and the HTML digest are in [the measurement receipt](qa/measurements.json).

| Selected A color pair | Light | Dark |
| --- | --- | --- |
| Main text / surface | 13.06:1 | 13.48:1 |
| Muted text / surface | 6.18:1 | 8.76:1 |
| Muted text / selected | 5.33:1 | 5.45:1 |
| Primary text / accent | 6.45:1 | 10.07:1 |
| Control / selected | 3.13:1 | 3.20:1 |
| Focus / surface | 6.58:1 | 9.08:1 |
| Warning / background | 5.88:1 | 8.80:1 |

Contrast uses the token RGB values with linearized luminance. The listed text pairs meet 4.5:1 and essential control/focus pairs meet 3:1. These measurements alone do not declare complete product WCAG conformance.

## Warning review and screens actually inspected

The 172 orphan warnings identify separately placed event-type metadata inside buttons and short final lines at narrow widths. They are not missing copy or split words; retain the metadata hierarchy and line spacing. The other four contrast-image warnings occur where the prototype review toolbar overlaps the selected item in 320px error/stale states. Its muted/selected colors were separately measured at 5.33:1 and 5.45:1; scrolling exposes the whole item. The diagram has its own scroll region plus the keyboard list.

Visually inspected A workspace at 1440px light and 320px dark, A checkpoint at 320px light, and B workspace at 1440px light. Other widths/states were measured only. Images contain synthetic data, not production captures.

## Control verification

All 89 synthetic assertions passed: search, project context restoration, selected-item discussion, queued question, proposal versus reflection, decision body/source/PR validation and per-item discussion restoration, all thirteen keyboard-list equivalents, item focus, original historical decision links, retained pass/withdrawal state, blocked passage guard, stale recovery, historical discussion/evidence labels, per-screen empty actions, first-question composition and credential role/revocation retention and input preservation across theme/candidate changes, confirmed sample pass/withdrawal, stale historical decision, one-time credential loss/revoke, repository validation/consent, skipped CI, isolated iframe action and parent-document refusal and child self-navigation network blocking, stable loading geometry/inert controls, saved theme, Enter/Escape/focus restoration, sign-out clearing, opaque-sandbox storage denial and reduced-motion rendering. The HTML digest remained unchanged throughout the run.

## Not measured yet

Real OIDC login/provider expiry, real v2 persistence/server publication, P95, complete screen-reader coverage, the production CSP attack matrix, operating-data migration, acknowledged-write recovery and recorded flash-rate analysis were not measured. There is no autonomous motion, video or audio; loudness does not apply. Real product QA remains explicit WBS completion work.
