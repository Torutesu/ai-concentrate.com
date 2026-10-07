# QA procedure

Run these before merging any change that touches UI or the request path.

| Check | Command | What it proves |
|---|---|---|
| Types | `npm run typecheck` | Client/server contracts, including `OperationResults` for every typed operation |
| Lint | `npm run lint` | 0 errors (existing warnings are design-script image warnings) |
| Unit + DB contract | `npm test` | Unit tests once, `*.db.test.ts` on Miniflare D1 **and** libSQL |
| Vercel build | `npm run build:vercel` | Next.js target compiles |
| Sites build | `npm run build && npm run check:sites` | Sites Worker bundles `lib/platform/sites.ts`, not the Clerk/Turso runtime |
| Browser E2E | `PLAYWRIGHT_MODULE=… scripts/e2e/run.sh` | The scenario below on a fresh local D1 |

## Browser scenario (`scripts/e2e/studio.mjs`)

It runs against the locally built Sites Worker (`wrangler dev`, local D1 under `.qa/state`).
Identity comes from the gateway headers that the Sites runtime trusts. The script refuses any non-local base URL.
Screenshots are written to `.qa/shots`, which is git-ignored.

1. Create a workspace.
2. Import a source containing an API key and an email address, and confirm the sensitive-data warning names both.
3. Open a long source (more than 8,000 characters) and page through it with **Show more**.
4. Exclude a source from AI and confirm it survives a reload.
5. Run a passage search, checking both a highlighted hit and an empty result.
6. Delete a source after confirming the dialog.
7. As owner, save the AI policy and the brand profile, reload, and confirm the values match the server.
8. Confirm the context view states that sources are never sent.
9. As a second user with the editor role: the policy is read-only, the profile is editable, and there is no delete option. The server also refuses a policy update from this user.
10. Write and save a draft through the editor.
11. Submit two agent-style proposals with `change_propose`. Check the diff, the origin chip, the rationale, and the `数値: 300%` fact warning. Reject one, apply the other, and confirm the editor text changed.
12. In the history view, confirm the applied and rejected lists, including the expanded diff and the decision time.
13. Delete the idea from the editor menu.
14. In English at 390px, open settings and context and confirm there is no horizontal overflow.
15. Delete the workspace. The confirmation requires typing its name.

Not covered:

- Live AI providers. The scenario uses `change_propose`, which is not live generation.
- Clerk sign-in on Vercel.
- Real MCP OAuth clients.
- Screen-reader output.
