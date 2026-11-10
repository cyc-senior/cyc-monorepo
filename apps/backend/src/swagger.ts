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
    'projects',
    'The workspace: a project, its design brief (intent, UI kit) and the caller’s role.',
  ],
  ['members', 'The project team, and each member’s role.'],
  [
    'ui-kits',
    'The UI kits designs are built with (shadcn, MUI) and the design document format.',
  ],
  ['user-stories', 'Problems and acceptance criteria designs address.'],
  ['design-rounds', 'Iterations of a project; approving one freezes it.'],
  [
    'generation-jobs',
    'LLM design generation, queued and followed live over server-sent events.',
  ],
  [
    'ui-variants',
    'Design alternatives of a round: Figma-like JSON, checked against the UI kit and WCAG 2.0 AA.',
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
Backend for designing UIs with an LLM: a project's design intent and UI kit
(shadcn or MUI) drive generation of alternative designs, delivered as
Figma-like JSON documents that meet WCAG 2.0 AA.

## Workflow
1. Any signed-in user creates a **project** with its design brief:
   \`designIntent\` and \`uiLibrary\` (\`SHADCN\` or \`MUI\`), plus optional
   persona, guidelines, brand, tone and tokens. They become its DESIGNER (the
   owner) and invite the team.
2. In a **design round**, \`POST .../rounds/{roundId}/generation-jobs\` queues
   an LLM job (\`202\`). Follow it with
   \`GET .../generation-jobs/{jobId}/events\` (server-sent events).
3. Each design is constrained to the UI kit's components, checked against the
   kit and WCAG 2.0 AA, and sent back to the model to fix until it passes.
   Passing designs become READY **variants**; \`GET /ui-kits/{uiLibrary}\`
   describes the kit and the document format.

## Authentication
Sign in with Google and send \`Authorization: Bearer <access token>\` (also on
event streams: use a fetch-based EventSource).

## Access control
Everything lives inside a **project**. A user has one **role** per project, and
a role grants **permissions**. Designers own the project and its design;
project managers and product owners read everything and change nothing. Each
endpoint lists the permission it needs and the roles that hold it. A caller who
is not a member gets \`404\` (never \`403\`), so ids cannot be probed.

${permissionTable()}

Membership rules: a project always keeps at least one DESIGNER; anyone can leave
a project.

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
