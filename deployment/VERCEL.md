# Independent Vercel deployment

## Current status
Project: ai-concentrate, team: torutesus-projects.
Vercel project ID: prj_ryjKrItTRxpMSl9gXAbDX0AiY4fE.
The initial CLI deployment automatically targeted production and received
https://ai-concentrate.vercel.app. Project SSO protection was verified as
`all_except_custom_domains`; no custom domain is configured by this change.
Subsequent deployments explicitly use `--target preview`.

No Clerk or Turso resources have yet been provisioned. The user approved Vercel
Marketplace's shared addendum, but provider-specific terms are awaiting approval.
Without Clerk keys, APIs reject requests with 401 and the login route displays
setup-pending state. This is NOT a usable authenticated release yet.

## Architecture
- Independent Next.js server uses `lib/platform/runtime.ts`: verified Clerk
  session identity, libSQL client and server-only AI configuration.
- Sites/Vite aliases the same module to `lib/platform/sites.ts`, retaining D1
  and the trusted private Sites gateway. Existing Sites project is preserved.
- Repository depends on a minimal SQL contract; domain operations, authorization,
  revision CAS, idempotency and locks stay shared. libSQL batches use write
  transactions. Existing migrations are reused without destructive conversion.
- Build output is separate: `.next-vercel` versus existing Sites output.
- There is no trust in incoming `oai-authenticated-user-*` headers on Vercel.

## Complete provisioning after terms approval
1. Connect `tursocloud/database` starter plan, hnd1, preview + development only.
2. Connect `clerk` hobby_2025_08 plan, preview + development only.
3. Pull preview environment into an ignored file; never print its values.
4. Verify DB keys are TURSO_DATABASE_URL/TURSO_AUTH_TOKEN and Clerk keys are
   CLERK_SECRET_KEY/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY. Do not rename integration
   environment values without inspecting the supplied names.
5. Apply migrations once:
   `node --env-file=.env.preview.local scripts/migrate-libsql.mjs`
   The migration ledger detects changes to already-applied SQL and transactions
   include the ledger entry. No existing Sites data is imported or deleted.
6. Deploy `vercel deploy --target preview --yes`.
7. Verify real login/workspace/save/reload and tenant isolation. Configure an AI
   provider/model and evaluate actual output before claiming AI is usable.

## Validation already performed
13 repository/service tests run against each of real Miniflare D1 and local
libSQL (26 passing). Next.js build and Sites build pass. Local independent API
rejects forged Sites identity headers with HTTP 401 when unauthenticated.
No real Clerk login, hosted Turso query, production data migration or live AI
provider call is claimed verified.

## Auth and agent boundaries
Vercel app login currently uses Clerk's UI. The entry and missing-config states
are synchronized in Figma; the connected Clerk form cannot yet be verified.
MCP shares the domain operations but independent OAuth discovery/client consent
is not implemented. Existing Sites OAuth plugin should continue to use the old
Sites endpoint; do not point it to Vercel and claim authentication parity.

## Secrets
Set credentials through Vercel integrations or its secret environment settings.
Never paste secrets into chat or commit `.env*`. The OpenAI provider still requires
OPENAI_API_KEY and OPENAI_MODEL. AI Gateway was researched, not enabled.
