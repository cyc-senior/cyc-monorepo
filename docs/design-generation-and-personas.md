# Design intent, user personas and HTML design generation

Scope of this change set: **milestones M1–M3 for the designer** — sign in,
create an organization, create a project, define its design intent and user
personas, and prompt the LLM for high-fidelity HTML designs. Joining an
existing organization or project is out of scope for now (members are still
added by an admin / a project designer, as before). Backend only.

Related: [`backend-architecture.md`](./backend-architecture.md),
[`authorization.md`](./authorization.md),
[`api-authorization-matrix.md`](./api-authorization-matrix.md),
[`backend-implementation-report.md`](./backend-implementation-report.md) §7.

## 1. Hierarchy

```
Organization ──< Project ──< User Persona
   (ADMIN | MEMBER)  │
                     ├── Design Intent (1:1)
                     └── Design Rounds ──< Generation Jobs ──< HTML Variants
```

* One organization has many projects; one project has many user personas and
  exactly one design intent.
* **Organization roles**: `ADMIN` (manages the organization and its members,
  creates projects; whoever creates the organization) and `MEMBER` (belongs to
  it, can be added to its projects).
* **Project roles** are separate: `DESIGNER`, `PROJECT_MANAGER`,
  `PRODUCT_OWNER`, `DEVELOPER` (and `CLIENT`). The project creator is its
  `DESIGNER`. Only designers write the design intent, personas and prompts.

## 2. The designer flow (M1–M3)

All calls need `Authorization: Bearer <access token>` (Google sign-in, see the
README). Paths are under `/api`.

### M1 — organization

```http
POST /api/organizations
{ "name": "Acme Design Studio" }
→ 201 { "id": "…", "name": "Acme Design Studio", "role": "ADMIN", … }
```

### M2 — project, then design intent and personas

```http
POST /api/organizations/{organizationId}/projects        (organization ADMIN)
{
  "name": "Checkout redesign",
  "clientOrProduct": "Acme Bank mobile app",
  "description": "Faster checkout for returning customers",
  "platforms": ["MOBILE", "DESKTOP"]                     (DESKTOP | MOBILE | TABLET, at least one)
}
→ 201 { "id": "…", "role": "DESIGNER", "hasDesignIntent": false, … }
```

```http
PUT /api/projects/{projectId}/design-intent              (project DESIGNER)
{
  "statement": "Let returning customers check out in under a minute.",
  "designSystem": "SHADCN",                              (SHADCN | MUI)
  "designStandards": ["WCAG 2.1 AA"],
  "designGuidelines": "Comfortable density; one primary action per screen.",
  "primaryColor": "#1A73E8",                             (brand & CI: exactly three hex colors)
  "secondaryColor": "#0F172A",
  "accentColor": "#F59E0B",
  "brandGuidelines": "Logo top-left; rounded, friendly illustrations.",
  "toneOfVoice": "Warm, plain-spoken, confident; no jargon."
}
→ 200 { …, "version": 1 }                                (every PUT bumps version)
```

```http
POST /api/projects/{projectId}/personas                   (project DESIGNER)
{
  "name": "Nina Park",
  "age": 34,
  "shortDescription": "Busy parent who shops on her phone during her commute.",
  "behavioralConsiderations": ["Shops in short bursts", "Abandons long forms"],
  "frustrations": ["Re-entering card details", "Surprise delivery fees"],
  "goals": ["Check out in under a minute"],
  "tasks": ["Reorder last week’s groceries"]
}
→ 201 { "id": "…", "origin": "MANUAL", … }
```

`GET /api/projects/{projectId}/design-intent` (404 until defined),
`GET|PATCH|DELETE /api/projects/{projectId}/personas/{personaId}`,
`GET /api/projects/{projectId}/personas?origin=AI|MANUAL`.

### M3 — prompt a design

```http
POST /api/projects/{projectId}/rounds/{roundId}/generation-jobs   (project DESIGNER)
{
  "prompt": "Checkout for returning customers with a saved card.",
  "variantCount": 2,                     (1–4, default 2)
  "personaIds": ["…"],                   (optional; default: every persona written by a designer, up to 5)
  "storyIds": ["…"],                     (optional)
  "synthesizePersona": true,             (default true)
  "baseVariantId": "…",                  (optional: refine this HTML variant instead)
  "idempotencyKey": "…"                  (optional: a retried submit returns the same job)
}
→ 202 { "id": "…", "status": "QUEUED", … }
```

The project's first round (#1) exists from project creation (`GET
/api/projects/{projectId}/rounds`). Generating requires a defined design intent
(otherwise `409`).

Follow the job with `GET /api/projects/{projectId}/generation-jobs/{jobId}/events`
(SSE). Progress stages: `started`, **`persona`**, `generating`, `checking`,
`repairing`, `saving`; then `completed` / `failed` / `cancelled`.

## 3. What the worker does

1. **Persona artifact.** The text model (`LLM_ANALYSIS_MODEL`, proposal:
   qwen3.8-27b) synthesizes one user persona from the prompt and the project
   context (project, intent, existing personas, stories). It is validated
   (name, age 1–120, short description, 1–8 items each for behavioral
   considerations, frustrations, goals, tasks) and **saved as a project persona
   with `origin: AI` and `generationJobId`** before any design is made, so it
   is kept even when the designs fail. One per job: a retried job reuses it.
   Its id is in the job's `outputMetadata.personaId`; it appears in
   `GET …/personas`. Designers can edit or delete it like any persona.
2. **Design prompt template.** The design model (`LLM_MODEL`) gets a system
   prompt (output contract, HTML rules, design-system style guide for shadcn or
   MUI, WCAG 2.1 AA rules) and a user prompt filled from the snapshot, in this
   order:

   | Section | Source |
   |---|---|
   | Project | name, client/product, description, target platforms (with layout widths) |
   | Design intent | statement, design system, standards, design guidelines |
   | Brand & corporate identity | primary / secondary / accent colors (with their roles), brand notes |
   | Tone of voice | the intent's tone of voice — all copy is written in it |
   | User personas | the persona artifact first ("primary persona for this request"), then the selected personas, each with name, age, description, behavior, frustrations, goals, tasks |
   | User stories | selected stories with problem statements and acceptance criteria |
   | Usability findings | designer-reviewed feedback themes the round addresses (later milestones) |
   | Existing design to refine | the base variant's HTML, when refining |
   | Designer request | the prompt |
   | Alternative | "alternative i of n", and how the earlier alternatives differ |

   The whole context is snapshotted on the job (`inputSnapshot`, `format:
   "html-v1"`), so later edits to the intent or personas do not change a job
   already queued.
3. **HTML generation.** The model answers `{ title, rationale, html }` (JSON
   schema). The HTML is **sanitized** and **checked**; a design with errors is
   sent back to the model with the list of issues, up to
   `DESIGN_REPAIR_ATTEMPTS` (default 2) times. Passing designs are saved in one
   transaction as `READY` variants (`html`, `accessibility` = the check report,
   `name` = title). A designer approves them; the AI never does.

## 4. The HTML design contract

What the frontend receives in `variant.html` (also `GET /testing/variants/:id`,
shared rounds, handoff spec):

* One self-contained HTML5 document: `<!DOCTYPE html>`, `<html lang>`, `<head>`
  with charset, viewport and `<title>`, one `<style>` block, semantic body.
* **No JavaScript** and no active content: `<script>`, `on*` handlers,
  `javascript:` URLs, `<iframe>/<object>/<embed>/<base>`, form actions, CSS
  `@import`, `expression()` and non-https `url()`s are removed by the sanitizer
  (`sanitize-html`, strict tag/attribute allowlist). The only external resource
  allowed is a Google Fonts stylesheet; images may be `https:` or `data:`.
* **Render it in a sandboxed iframe**: `<iframe sandbox srcdoc="…">` with *no*
  `allow-scripts` and *no* `allow-same-origin`. The sanitizer is defence in
  depth, not a reason to render it in the app's own DOM.
* Brand colors are exposed as CSS custom properties `--color-primary`,
  `--color-secondary`, `--color-accent` (requested in the prompt).

### Checks (`accessibility` report)

`{ standard: "WCAG 2.1 AA", scope: "static-markup", passed, checkedAt, errors,
warnings, issues[], removed[], bytes }`. Errors fail the design; warnings are kept.

| Rule | Error | Warning |
|---|---|---|
| structure | > 400 KB, empty body, invalid/cut-off answer | — |
| WCAG 3.1.1 | `<html>` without `lang` | — |
| WCAG 2.4.2 | missing/empty `<title>` | — |
| WCAG 1.3.1 | no `<h1>` | several `<h1>`, skipped heading levels, no `<main>` |
| WCAG 1.1.1 | `<img>` without `alt` | `<svg role="img">` without a name |
| WCAG 3.3.2 | input/select/textarea without a label | — |
| WCAG 4.1.2 | button without an accessible name | link without `href` |
| WCAG 2.4.4 | link without a name | generic link text ("click here") |
| platform | no viewport meta when MOBILE/TABLET is targeted | no viewport (desktop only); several platforms but no `@media` |
| brand | — | a brand color not used in the CSS |
| safety | — | what the sanitizer removed |

Not checked (need a browser): color contrast, focus order, zoom/reflow, motion.
The prompt asks the model for AA contrast; designers must still review it.

## 5. API changes in this change set

| Change | Before | Now |
|---|---|---|
| Project creation body | name, description, `designIntent`, `uiLibrary`, JSON brief | `name`, `clientOrProduct`, `description`, `platforms[]` |
| Design brief | `PATCH /projects/:id/design` (on the project) | `GET/PUT /projects/:id/design-intent` (own resource, `version`) |
| Personas | `targetPersona` JSON on the project | `/projects/:id/personas` CRUD; AI artifacts from prompts |
| Generation job body | `prompt` optional | `prompt` **required**; `personaIds`, `synthesizePersona` added |
| Variant design | `design` (Figma-like JSON) | `html` (sanitized HTML); `design` kept read-only for older variants |
| Variant create/update | `design` JSON, checked against the UI kit | `html`, sanitized and checked (422 with `issues`) |
| UI kits | `GET /ui-kits/:uiLibrary` | removed (the JSON document format is gone) |
| Organization roles | OWNER, DESIGNER, MEMBER | ADMIN, MEMBER |
| Who creates projects | org OWNER or DESIGNER | org ADMIN |
| Handoff variant | `screens`, `componentUsage` | `format`, `elementUsage` (HTML elements); handoff has `designSystem`, `designStandards`, `platforms`, `brandColors`, `brandGuidelines` |

## 6. Database (migration `20261112090000_html_design_intent_personas`)

* New: `design_intents` (1:1 project, `UNIQUE(projectId)`, hex color checks),
  `user_personas` (project, `origin`, `generationJobId UNIQUE`, age 1–120
  check), enums `Platform`, `PersonaOrigin`.
* `projects`: `+ clientOrProduct`, `+ platforms` (≥ 1, checked); the brief
  columns (`designIntent`, `uiLibrary`, `targetPersona`, `designGuidelines`,
  `brandIdentity`, `toneOfVoice`, `designTokens`, `designVersion`) are dropped
  **after** their values are copied: each project gets a design intent (JSON
  fields turned into text; hex colors taken from the old tokens when valid; the
  complete old brief kept in `design_intents.legacyBrief`), and a non-empty old
  target persona becomes the project's first persona.
* `organization_members.role`: OWNER → ADMIN, DESIGNER → **MEMBER** (least
  privilege; an admin can promote them), MEMBER → MEMBER.
* `ui_variants`: `+ html`, `design` nullable; a check requires one of them.
* Existing projects get `clientOrProduct = name` and `platforms = {DESKTOP}`;
  edit them with `PATCH /projects/:id`.

Applied to a scratch database seeded with pre-migration rows (all values carried
over as described), and to the local dev database, which had no projects,
organization members or variants at the time.

## 7. Configuration

| Variable | Use |
|---|---|
| `LLM_MODEL` | HTML design generation. The proposal names `muse-glimmer-30b`; set it per environment (checked-in default `qwen3.8-27b`). |
| `LLM_ANALYSIS_MODEL` | Persona artifacts (and analysis / story drafting). Default `LLM_MODEL`. |
| `LLM_MAX_TOKENS` | Must fit a whole HTML document (default 16000). |
| `DESIGN_REPAIR_ATTEMPTS` | Times a failing design is sent back (default 2). |

## 8. Known limitations

* Nothing in this change set was exercised against the real LLM gateway; prompt
  quality and repair rates are unmeasured. No unit/e2e tests were added or run.
* Static checks only (no contrast, focus order or zoom checks).
* Persona artifacts accumulate (one per job); there is no de-duplication.
  Unless the designer picks them via `personaIds`, earlier AI personas are not
  fed into later prompts.
* Legacy JSON variants still have `design` and can be viewed, but cannot be
  refined (`baseVariantId` must be an HTML variant) and render nowhere in HTML.
* The design-system choice is limited to `SHADCN` and `MUI` look-and-feel
  guides written as plain CSS (no component library is loaded in the iframe).
* Joining an organization or project, and invitations by email, are not
  implemented.
