import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger'

import {
  Permission,
  ROLE_PERMISSIONS,
  ROLES,
} from './modules/access/permissions'

const TAGS: Array<[string, string]> = [
  ['auth', 'Sign-in and token refresh.'],
  ['users', 'The signed-in user.'],
  [
    'organizations',
    'The tenant boundary: an organization, its members and who may open projects.',
  ],
  [
    'projects',
    'The workspace inside an organization: name, client or product, description, platforms, and the caller’s role.',
  ],
  ['members', 'The project team, and each member’s role.'],
  [
    'design-intent',
    'The project’s design intent: design system & standards, brand & CI (three colors), tone of voice — reused in every design prompt.',
  ],
  [
    'personas',
    'User personas of a project (Organization → Project → User Persona), written by designers or synthesized from design prompts.',
  ],
  ['user-stories', 'Problems and acceptance criteria designs address.'],
  ['design-rounds', 'Iterations of a project; approving one freezes it.'],
  [
    'generation-jobs',
    'LLM design generation, queued and followed live over server-sent events.',
  ],
  [
    'ui-variants',
    'Design alternatives of a round: high-fidelity, sanitized HTML documents, checked for WCAG 2.1 AA markup, platforms and brand colors.',
  ],
  [
    'test-sessions',
    'Usability test sessions: tasks, invited testers, consent history, progress and raw results (designers).',
  ],
  [
    'testing',
    'What a tester (session participant) does: join with an invitation, consent, tasks, events, feedback. Separate tester tokens.',
  ],
  [
    'feedback-analysis',
    'AI analysis of raw feedback (queued, SSE) and the designer’s review: themes, merge/split, won’t-fix, selection.',
  ],
  [
    'stakeholders',
    'Approved rounds, acknowledgements and comments (client), development handoff (developer), project status (PM).',
  ],
  [
    'reports',
    'Role-specific reports: client, developer, project manager, designer.',
  ],
  ['audit', 'Who changed what, and when.'],
  ['health', 'Liveness probe.'],
]

/** Markdown role × permission table, generated from the real matrix. */
function permissionTable(): string {
  const header = `| Permission | ${ROLES.join(' | ')} |`
  const divider = `|---|${ROLES.map(() => ':---:').join('|')}|`
  const rows = Object.values(Permission).map(
    (permission) =>
      `| \`${permission}\` | ${ROLES.map((role) => (ROLE_PERMISSIONS[role].has(permission) ? '✓' : '')).join(' | ')} |`,
  )

  return [header, divider, ...rows].join('\n')
}

const DESCRIPTION = `
Backend of CYC, an AI-assisted UX/UI development life cycle: designers define
a design intent and user personas, the AI proposes alternative high-fidelity
HTML designs, designers refine and
approve them, testers try the approved prototypes, the AI analyses their
feedback, designers review it and decide what goes into the next iteration, and
stakeholders follow the approved result. **The AI proposes; people decide**:
nothing generated or analysed is approved, selected or applied without an
explicit designer action.

## Workflow (milestones M1–M3, designer)
1. **Sign in** with Google, then **create an organization** (you become its ADMIN).
2. **Create a project** in it (org ADMIN): name, client or product, description
   and the platforms to test (\`DESKTOP\`, \`MOBILE\`, \`TABLET\`). You become the
   project's DESIGNER; project roles (DESIGNER, PROJECT_MANAGER, PRODUCT_OWNER,
   DEVELOPER, CLIENT) are separate from organization roles (ADMIN, MEMBER).
3. **Define the design intent**: \`PUT .../design-intent\` (design system &
   standards, brand & CI with three colors, tone of voice, intent statement) and
   **user personas** (\`POST .../personas\`: name, age, short description,
   behavioral considerations, frustrations, goals, tasks).
4. **Prompt a design**: \`POST .../rounds/{roundId}/generation-jobs\` with your
   prompt (\`202\`, follow it over SSE). The worker first **synthesizes a persona
   artifact** from the prompt and saves it as a project persona (origin AI),
   then fills the project, intent, personas, stories and prompt into the design
   template and generates **high-fidelity HTML** variants (sanitized, checked,
   repaired by the model when checks fail).
5. Refine (\`baseVariantId\`), then **approve** variants. Later milestones:
   testing, AI feedback analysis, iteration and stakeholder reports.

**Rendering designs**: a variant's \`html\` is a self-contained document with no
scripts. Show it in \`<iframe sandbox srcdoc="...">\` without \`allow-scripts\`
or \`allow-same-origin\`.

## Authentication
Users sign in with Google and send \`Authorization: Bearer <access token>\` (also
on event streams: use a fetch-based EventSource). **Testers are not users**:
they enter with a session invitation at \`POST /testing/join\` and receive a
separate, short-lived tester token that only works on \`/testing/...\`.

## Access control
Two scopes, both checked on the server on every request:
- **Organization** roles (ADMIN, MEMBER) decide who manages the organization
  and who opens projects (ADMIN). They never grant project access.
- **Project** roles (below) decide everything inside a project. Each endpoint
  lists the permission it needs and the roles that hold it. A caller who is not
  a member gets \`404\` (never \`403\`), so ids cannot be probed.

${permissionTable()}

Membership rules: a project member must belong to the project's organization;
a project always keeps at least one DESIGNER; an organization always keeps one
ADMIN; anyone can leave.

## Conventions
- List endpoints take \`limit\` (1–100, default 50) and \`offset\`, and return
  \`{ data, total, limit, offset }\`.
- Mutations are written to the project's audit log.
- \`GET\` responses of project routes may be served from a cache
  (\`X-Cache: HIT\`); any write in the project invalidates it first.
- Every response carries \`X-Request-Id\` (yours, if you sent a valid one).
- \`404\` also means "exists but not in this project".
`

/** Builds the OpenAPI document served at \`/api\` (UI) and \`/api-json\`. */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Senior API')
    .setDescription(DESCRIPTION)
    .setVersion('0.1.0')
    .addBearerAuth()
  for (const [name, description] of TAGS) {
    builder.addTag(name, description)
  }

  return SwaggerModule.createDocument(app, builder.build())
}

export function setupSwagger(app: INestApplication): void {
  SwaggerModule.setup('api', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api-json',
    swaggerOptions: { persistAuthorization: true },
  })
}
