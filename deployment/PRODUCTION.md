# Independent production deployment

Status: migration preparation; no independent production deployment yet.
The existing owner-private Sites publication remains intact.

## Verified on 2026-10-02
- Current implementation is a real D1-backed app, not just static HTML.
- Authentication trusts identity supplied by the private Sites gateway.
- Vite configuration, entry worker and connector preview are Sites-specific.
- Local Wrangler is authenticated and has Workers, D1 and routes write scopes.
- Existing Sites database is managed by Sites; it must not be assumed to exist in the user's Cloudflare account.
- Provider generation remains unconfigured. Changing hosting alone does not enable it.

## Proposed independent target
Cloudflare Workers for application/API, D1 for existing transactional data model.
Use a separate production build configuration and Worker entry point. Keep the
existing Sites manifest, build and publication for rollback/reference.
Use app.ai-concentrate.com only after domain ownership/DNS and acquisition are
verified. Until then use an assigned workers.dev hostname with verified auth.

## Required release gates, in order
1. Select deployment target/account; create production and staging configuration.
2. Replace gateway-only auth with independent verified sessions. Reject forged
   oai-authenticated-user-* headers at the public boundary. Never ship local mock auth.
3. Provision a separate D1 database and apply versioned migrations. Decide whether
   to start fresh or migrate existing data; map user IDs explicitly rather than
   treating email as proof of ownership. Preserve original database.
4. Configure a server-only AI credential and a validated model. Run one actual
   source-backed generation, review and save/reload as the signed-in owner.
5. Validate unauthenticated API/MCP denial, cross-workspace isolation, concurrent
   saves, restore and session expiration on the deployed app.
6. Point verified domain to the tested deployment and document rollback.

## Initial usable milestone
Owner can sign in independently, create ShogunAI workspace, import context,
generate a real draft, edit/review it and save/reopen it on another session.
This does not imply social publishing, finished video production, billing or
public signup are implemented.

## External configuration needed
- Independent identity provider/session configuration; no identity headers may be
  trusted merely because they match the old Sites names.
- AI provider credential/model, entered through a secret manager, never in chat.
- Domain acquisition and DNS status (ai-concentrate.com was previously planned,
  not verified as registered).

## Reference
https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
https://developers.cloudflare.com/d1/get-started/

## Superseding decision
User explicitly chose Vercel and requested implementation. See VERCEL.md for the
actual independent runtime, provisioning state and remaining release gates.
