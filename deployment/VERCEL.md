# Independent Vercel deployment

## Current status
Project: ai-concentrate, team: torutesus-projects.
Vercel project ID: prj_ryjKrItTRxpMSl9gXAbDX0AiY4fE.
The initial CLI deployment automatically targeted production and received
https://ai-concentrate.vercel.app. Project SSO protection was verified as
`all_except_custom_domains`; no custom domain is configured by this change.
Subsequent deployments explicitly use `--target preview`.

The user approved the Vercel Marketplace addendum and Turso/Clerk provider terms.
Turso Starter resource `concentrate-preview` (hnd1) is connected to preview and
development. Migration `0000_wonderful_colleen_wing.sql` was applied to the hosted
DB; a repeat migration run completed successfully without reapplying it.
Clerk requires provisioning through the Web UI (the CLI explicitly declines it).
Clerk Hobby resource `concentrate-auth` (`ir_C3zl2JI73wrdP7kr`) is connected
to ai-concentrate for preview and development. The user approved its displayed
integration permissions. Connection completed through the authenticated Vercel
CLI API after Dia input stopped responding. Preview environment pull confirmed
CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY without exposing values.
Real user sign-in and application save/reload remain to be verified.
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

## Remaining provisioning
1. Turso is already connected; do not create a duplicate resource.
2. Clerk is already connected; do not create a duplicate resource.
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
Hosted Turso migration and migration-ledger reads are verified. Real Clerk login,
application save/reload through an authenticated session, production data migration
and live AI provider calls remain unverified.

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

## 2026-10-02 authenticated preview verification

Preview: https://ai-concentrate-6hnqoahi5-torutesus-projects.vercel.app
Verified in Dia: Google OAuth through Clerk returned to the app; the owner created
ShogunAI workspace, saved an initial marketing-context document, created a draft,
saved its title/body as revision 2, reloaded the browser and reopened the same
persisted title/body. No secret or OAuth callback URL is recorded here.
The draft is explicitly labeled as a manually entered initial plot, not in-app
AI output. OPENAI_API_KEY / OPENAI_MODEL remain unconfigured; user was asked to
set the key securely in Vercel Preview. No UI source changes in this verification.
Connected Clerk form is observed but its editable Figma counterpart remains pending;
full Figma parity is not claimed.

## Current status — 2026-10-03
The dated notes above are historical. Preview now has provider key/model configured;
Clerk development login and workspace/context/draft persistence have been verified.
The connected editable Clerk reference is Figma node 123:379 (representative provider styling).
Hosted generation/output quality, independent MCP OAuth, commercial auth hardening
and Production environment readiness remain unverified or incomplete.
Generation admission now limits each workspace to 2 concurrent claims (120-second
window) and 100 attempts per rolling day. These are not account-wide spending limits.
