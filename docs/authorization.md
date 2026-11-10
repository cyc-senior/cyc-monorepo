# Authorization

How the CYC backend decides who may do what. The code is the source of truth
(`apps/backend/src/modules/access/`); the tables below are generated from it.
The per-endpoint view is [`api-authorization-matrix.md`](./api-authorization-matrix.md).

## 1. Three different things: account, membership, participation

| Concept | What it is | Where it lives | Grants |
|---|---|---|---|
| **Account** | A signed-in person (Google identity). Has *no* global role. | `users` | Nothing by itself; it can create an organization and see what it belongs to. |
| **Organization membership** | A person's standing in a tenant: `ADMIN` or `MEMBER`. | `organization_members` | ADMIN: managing the organization and creating projects. **Never** access to a project. |
| **Project membership** | A person's role in one project: `DESIGNER`, `PROJECT_MANAGER`, `PRODUCT_OWNER`, `DEVELOPER`, `CLIENT` — separate from the organization role. | `project_members` | Every permission inside that project. |
| **Testing participation** | A *Tester*: a participant identity of **one test session**, created by a designer (email + invitation). | `session_participants` | Only the `/testing/...` API of that one session, while it is open. |

### Why Tester is a session-scoped participant identity (and not an account or project role)

The proposal lists four account roles (Designer, Client, Developer, PM) but its
Testing Space use cases add a Tester. We kept the distinction instead of
removing it, and chose the **participant-identity** option:

* Testers are external people recruited for one study. They should not need an
  account, must not see the project, its team or its other rounds, and their
  access must end when the study ends.
* A *project role* would put them in the team list and in the project's
  permission model; an *account role* would make "tester" a global capability.
  Both are wider than "may use this one session".
* Consent (PDPA) is per session, so the identity that carries it has to be per
  session too. The same email invited to two sessions is two unrelated
  participants with two separate consent histories.

A tester therefore authenticates differently (an invitation token, exchanged
for a short-lived token with its own audience) and is authorized by a different
guard. The two token types cannot be swapped: user tokens carry `aud: cyc-api`,
tester tokens `aud: cyc-testing`, and each verifier requires its own audience
and the shared issuer `cyc-backend`.

## 2. Organization permissions

| Permission | ADMIN | MEMBER |
|---|:---:|:---:|
| `org:read` | ✓ | ✓ |
| `org:update` | ✓ |  |
| `org:delete` | ✓ |  |
| `org-member:read` | ✓ | ✓ |
| `org-member:manage` | ✓ |  |
| `org-project:create` | ✓ |  |

Organization roles decide who manages the organization and who may create a
project: **ADMIN** (whoever creates the organization; can promote others) does
both, **MEMBER** belongs to the organization and can be added to its projects.
Joining an organization by invitation is not implemented yet. They are checked by
`OrganizationPermissionsGuard` (`@AuthorizeOrg(...)`) on routes with
`:organizationId`. Being in an organization does **not** let you see its
projects: you must be a project member.

## 3. Project permissions

| Permission | DESIGNER | PROJECT_MANAGER | PRODUCT_OWNER | CLIENT | DEVELOPER |
|---|:---:|:---:|:---:|:---:|:---:|
| `project:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `project:update` | ✓ |  |  |  |  |
| `project:delete` | ✓ |  |  |  |  |
| `member:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `member:manage` | ✓ |  |  |  |  |
| `design:read` | ✓ |  |  |  |  |
| `design:write` | ✓ |  |  |  |  |
| `design:approve` | ✓ |  |  |  |  |
| `testing:read` | ✓ |  |  |  |  |
| `testing:manage` | ✓ |  |  |  |  |
| `feedback:read` | ✓ |  |  |  |  |
| `analysis:read` | ✓ |  |  |  |  |
| `analysis:write` | ✓ |  |  |  |  |
| `iteration:manage` | ✓ |  |  |  |  |
| `shared-round:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `shared-round:respond` |  |  |  | ✓ |  |
| `handoff:read` |  |  |  |  | ✓ |
| `status:read` | ✓ | ✓ | ✓ |  |  |
| `report:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `report:generate` | ✓ |  |  |  |  |
| `audit:read` | ✓ |  |  |  |  |

How this relates to the proposal's baseline matrix:

| Proposal capability | Permission(s) | Roles that hold it |
|---|---|---|
| Create project | org `org-project:create` | org ADMIN |
| Manage design intent and user personas / prompt, generate, refine | `design:write` | DESIGNER |
| Approve prototypes | `design:approve` | DESIGNER |
| Assign testers / manage testing sessions / end session | `testing:manage` | DESIGNER |
| Join assigned test / perform tasks / submit feedback | *tester token* (not a project permission) | session participants |
| Review & edit AI analysis | `analysis:read`, `analysis:write` | DESIGNER |
| Select feedback for iteration | `iteration:manage` | DESIGNER |
| View approved project rounds | `shared-round:read` | DESIGNER, PM (+PO), CLIENT, DEVELOPER |
| Comment on shared rounds | `shared-round:respond` | CLIENT |
| View development handoff | `handoff:read` | DEVELOPER |
| View project status | `status:read` | DESIGNER, PM (+PO) |
| View stakeholder reports | `report:read` (own audience only) | DESIGNER, PM (+PO), CLIENT, DEVELOPER |

Interpretations (the proposal is ambiguous or silent):

* **"End user story session"** is implemented as ending a *test session*
  (`testing:manage`, recorded as a `SESSION_ENDED` decision). The user-story
  workshop itself has no session object; stories are drafted by the AI as
  `DRAFT` and a designer sets them `READY`.
* **`PRODUCT_OWNER`** is a first-class project role (requested alongside
  project manager, designer and developer). It currently holds exactly the
  project-manager permissions; the two are separate roles so they can diverge.
  `CLIENT` from the proposal is kept.
* **Organization DESIGNER/OWNER → ADMIN/MEMBER** (migration
  `20261112090000`): OWNER became ADMIN, DESIGNER became MEMBER (least
  privilege); only ADMIN creates projects.
* **PM / Client / Developer cannot read `design:*`** (drafts, generation
  prompts, jobs) even though they could before: the proposal gives them
  approved rounds, status and reports only. This is a deliberate tightening.
* **Designers are not stakeholders**: they cannot comment on shared rounds or
  read the developer handoff (matrix says "No"). They can read every report
  audience, since they author them.
* **Rounds are "shared" when approved.** There is no separate share switch.

There is no system administrator role; none is required by the proposal.

## 4. Enforcement strategy (defence in depth)

1. **Authentication**: a global `JwtAuthGuard` protects every route unless it
   is `@Public()`. Public routes are: Google sign-in/callback, refresh, health,
   and the `/testing/...` routes (which have their own guard).
2. **Scope guard**: `@Authorize(permission)` resolves the caller's
   `project_members` row for `:projectId` (`PermissionsGuard`);
   `@AuthorizeOrg(permission)` does the same for `:organizationId`. Not a
   member or malformed id → **404**; member without the permission → **403**.
   A guarded route with no id parameter fails closed (500, logged).
3. **Resource scoping in the service layer** (never only the guard). Every
   item is looked up *through* the project (`where { id, projectId }` or via
   `common/scopes.ts`), and every id in a request body is re-checked:
   `storyIds`, `baseVariantId`, `variantIds`, `assignedVariantId`,
   `feedbackIds`, `themeIds`, `carryForwardVariantIds`, `roundId`, `sessionId`.
   An id from another project is indistinguishable from a missing one.
4. **Database constraints** as the last line (migration
   `20261111090000_organizations_testing_analysis`):
   * `project_members` has composite foreign keys to
     `(projects.id, organizationId)` and `(organization_members.organizationId,
     userId)` – a project can only contain members of its own organization,
     whatever the application does.
   * Sessions, analyses and decisions reference their round with
     `(roundId, projectId)`; session variants with `(variantId, roundId)`;
     participants, task runs, events, feedback and consent with
     `(participantId, sessionId)`; a participant's group with
     `(sessionId, assignedVariantId)`. Cross-project and cross-session links
     cannot be stored.
   * `feedback` and `consent_records` cannot be updated (triggers), so raw
     participant data and consent history stay as written.
5. **Tester guard** (`TesterGuard`): verifies the token (signature, issuer,
   audience, expiry) and then **re-reads the participant and session on every
   request**: not REVOKED/WITHDRAWN, session ACTIVE, inside
   `[startsAt, expiresAt]`. Ending a session or revoking a person therefore
   takes effect immediately.
6. **Mass assignment**: the global `ValidationPipe` uses
   `whitelist + forbidNonWhitelisted`; ownership fields (`projectId`,
   `organizationId`, `participantId`, `sessionId`, requester) are never read from
   bodies — they come from the route, the token or the database. Privileged
   state transitions have their own endpoints (`approve`, `activate`, `end`)
   and are not settable through `PATCH` (e.g. variant `status` cannot be
   `APPROVED`).
7. **Background jobs** carry only a row id. The worker loads the row, takes
   the project from it, re-checks that the requester still holds the needed
   permission, reads inputs from that project only, validates the model's
   answer, and saves it guarded by the row's status. SSE streams are job-scoped
   and authorized by the same project lookup as the REST read.
8. **Deny by default**: new routes have no access until decorated; the e2e
   route-coverage spec (`test/rbac.e2e-spec.ts`) is meant to fail on an
   undecorated `:projectId` route.

## 5. Data minimisation and visibility

| Audience | Sees | Never sees |
|---|---|---|
| Designer | everything of their projects; participant emails (to manage invitations); raw feedback by participant *id* | other projects/organizations |
| Client | approved rounds + approved prototypes, acknowledgements/comments, CLIENT reports | drafts, prompts, test sessions, participants, raw or AI feedback, consent |
| Developer | approved rounds, handoff (components, tokens, risks, design spec), DEVELOPER reports | same exclusions as client |
| PM / PO | approved rounds, live status, PM reports (counts, timeline gaps) | drafts, design intent details beyond the project, personas, feedback content, participants |
| Tester | their own session's consent notice, their prototypes, their tasks, their own submissions | other participants, results, analysis, the project |
| AI service | feedback *text* of the analysis (contact details masked); project, design intent, personas, stories and prompt for design / persona / story jobs | participant identity (email/id), consent records, user accounts |

## 6. Important security decisions

* **404 vs 403**: non-members get 404 so ids cannot be probed.
* **Invitation is not a session**: it is exchanged for a token ≤ 4 h that never
  outlives the session, and every request re-checks state. Tokens are random
  (256 bit), stored as SHA-256, shown once, placed in the URL *fragment*, and
  rotated/revoked per participant. `POST /testing/join` is rate-limited.
* **Consent is per session and per notice version**, append-only, with the hash
  of the exact text shown. No consent → no prototype, tasks, events or feedback.
  Withdrawal ends access immediately and excludes the participant's feedback
  from later AI analyses.
* **Generated HTML is untrusted**: it is sanitized (no scripts, handlers,
  frames, `javascript:` URLs, external resources except Google Fonts) and must
  be rendered in `<iframe sandbox srcdoc>` without `allow-scripts` /
  `allow-same-origin`.
* **AI never decides**: generated variants are `READY` (never `APPROVED`);
  persona artifacts are saved as editable proposals (`origin: AI`);
  analyses end in `READY` awaiting review; themes start `PROPOSED`; story drafts
  are `DRAFT`; only designer endpoints approve, select or iterate, and each
  writes the decision history in the same transaction.
* **Raw feedback is immutable** (trigger) and kept apart from the AI output
  (`ai*` columns) and the designer's reviewed values.
* **No account enumeration** through project invitations (one generic 404).
  Organization admins adding people by email do learn whether an email has an
  account (they need to); that endpoint is admin-only.
* Not implemented: email/password sign-in (and therefore verification and
  recovery), account disabling, per-request revalidation of user tokens beyond
  signature/expiry (15 min lifetime), distributed rate limiting.
