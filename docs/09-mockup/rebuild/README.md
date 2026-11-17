# Rebuild mockup and selected tokens

[한국어](README.ko.md)

Status: A selected under the maintainer's design-continuation instruction; the selected token set is the design baseline. This is a synthetic interactive prototype, not a deployed v2 service or an individually passed NEXUS review.

[Open the self-contained HTML](../../../design/rebuild/index.html) · [Compare A and B](../../../design/rebuild/candidates.html) · [Visual measurements](visual-review.md)

## Purpose and five directions

One owner on a laptop or phone reviews several private projects, understands a stage visually, discusses an item and decides on its exact content version. Existing screenshots and legacy tokens are references; this baseline is newly selected.

| Direction | Structure considered | Outcome |
| --- | --- | --- |
| Material world | Planning board, version label, document margin, drawing canvas | A: fixed project/stage navigation, central artifact and item inspector |
| Emotion | Calm reading with strong decision visibility | Light surface, restrained green selection, no competing decorative motion |
| Audience | One owner alternating among several projects | Explicit project selector and saved stage context |
| Common answer reversed | Artifact first instead of a full-screen chat feed | Discussion remains beside its selected artifact |
| Unfamiliar format | A version-review catalog with a horizontal stage strip | B: broad document area and version-review panel |

No external product screenshot, logo, copy or customer statistic was copied. The references are the stage-08 wireframes and source artifacts. No external likeness target applies. Both candidate layouts are available for all eleven screens; A is the chosen direction for expansion and development. B stays inspectable, not silently deleted.

## Selection and replacement

A uses a 224px stage sidebar, a flexible artifact and 320px item inspector at wide widths. Under 1200px the inspector follows the artifact; under 850px a labelled stage select replaces the sidebar. B uses a horizontal thirteen-stage strip and a 380px review panel. A is selected because the current stage remains visible without horizontal navigation while switching among projects. Both preserve a keyboard item list and deliberate version review.

The maintainer authorized continuing through design, including routine design choices. The exact words and private conversation context remain in the existing project record; [the source authorization](../../decisions/rebuild-authorization.md) defines the scope. The agent chose A within that scope. Do not rewrite that as a direct human selection or fabricate a NEXUS pass. The former legacy frozen tokens remain unchanged in their original directory; they no longer determine this rebuild's visual direction because the brief requires a fresh, light-first product.

## Tokens and reproduction

Selected tokens use DTCG 2025.10: shared type, spacing, radius, target sizes and motion in base; each light/dark mode has one color value per token; the resolver defaults to light. Alternate B color values remain separate. System fonts with a Korean fallback need no new package or CDN. The normal data-dense UI uses 14px text, 16px section text, 28px page headings and 12px metadata; body line height is 1.6. Korean uses keep-all and break-word; URLs/code can wrap anywhere.

[Base](../../../design/rebuild/base.tokens.json) · [Light](../../../design/rebuild/theme/light.tokens.json) · [Dark](../../../design/rebuild/theme/dark.tokens.json) · [Resolver](../../../design/rebuild/tokens.resolver.json)

Run `python design/rebuild/render.py` to rebuild the committed standalone HTML; `python design/rebuild/render.py --check` verifies it. The template and stage-08 state data generate the same token names, screen IDs and state choices used by the prototype. Changes to a screen definition require regeneration and renewed visual verification. No repository dependency was added.

## Interactions and boundaries

The prototype includes project search/switching, thirteen artifact-type views, item selection, version-bound discussion, queued answers, proposal acceptance without false reflection, checkpoint confirmation/withdrawal/conflict, first-publication consent, received/skipped publication status, one-time credential loss/revocation, historical versions, a sample guide and opaque HTML preview. Screen and state selectors expose all 91 designed states; light/dark and both candidates can be compared. Loading masks data in the normal geometry and disables its actions.

Every dataset is labelled synthetic. Inputs stay in memory; only the theme preference persists. Signing out clears private sample drafts and selections. Prototype controls do not send authenticated requests or act on real NEXUS projects. The opaque preview may execute its own sample script while lacking parent document/session access. This local demonstration does not prove a production CSP or a real API implementation.

The running NEXUS currently publishes source records and supports drawings for domain, ERD and sitemap. The new HTML file is committed and linked from every screen definition and this stage's review request. Executing arbitrary committed HTML inside the existing production viewer is not claimed; the isolated v2 preview is an explicit development/QA task. Production runtime stays unchanged.

## Verification scope

The visual report gives exact rendered widths/themes/states, measured contrast, warning reasons and synthetic control results. Real OIDC configuration, Git verification, v2 persistence, service performance, complete product accessibility, operating-data migration/recovery and stage-12 browser-agent QA remain later work.

The preview parent enforces `frame-src 'none'` and uses only `srcdoc`. The trusted child policy and opaque `allow-scripts` sandbox permit internal prototype controls while blocking network/navigation authority. A local browser fixture proves that the parent policy blocks the child self-navigation probe; real-server and cross-browser isolation remain stage-12 checks.

Per-item discussion is scoped by project, item and content version and restored when returning to the original item. Recording a decision preserves its body and published source and validates an optional PR URL. Invalid input keeps the dialog and draft. These are in-memory controls, not proof of real-server persistence.

Diagram and keyboard list expose matching items for each of the thirteen stages. Item activation restores focus; sample pass/withdrawal/reason records stay in memory by project/stage/version. Historical decision links open their own row version; stale recovery returns to the current version and still needs a separate decision. Theme/candidate changes preserve non-secret form input, and generated CSS leaves generic font families unquoted.

When prerequisites are blocked, disable passage with a stated reason and refuse it again in the action guard. This remains synthetic verification and grants no real human-checkpoint authority.

Historical item discussions and decision evidence display their selected sample version. The empty state of `SCR-135` retains and focuses the question composer, and the first send invents no unrelated prior messages. Every empty screen preserves its applicable first action; issued credential role and revocation remain in project-scoped memory.
