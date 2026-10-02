# Commercial entry and settings — 2026-10-02

Figma file: m2RyfqGnGhNIJ7lsEPBuEp, page 20:391. Node ledger: commercial-state.json. Editable Figma design only; authentication, invitation delivery, authorization, billing and external integrations are not implemented by this change.

## Navigation

The Japanese sidebar now names the dedicated tab インテグレーション; English is Integrations. Its stable entry is 22:1305. Keep the service list and selected service's settings side by side. Connection status, scope, account confirmation, reconnect and disconnect belong here. Workspace members, invitations, billing and account preferences belong under the existing header Settings action.

## Entry flows

- Registration 53:4871 → email verification 53:4930 → workspace creation 53:5150 → existing product context onboarding 20:498.
- Login 53:4905 → workspace selection 20:460. Include generic login errors, provider waiting, password recovery, reset completion and expired-link states.
- Invitation 53:5054 → existing-account login 53:5079 or invited registration 56:5157 → invited verification 56:5191 → explicit acceptance 53:5101 → workspace.
- Invitation failures include wrong account and expired/revoked invitation. Preserve invitation intent through authentication, password reset and locale changes in implementation. Validate verified recipient identity and token server-side; do not allow editing the invited email to grant access to another account.
- OAuth return destination must preserve intent: a new ordinary user enters onboarding, an existing user selects their workspace, an invited user confirms invitation acceptance. The provider waiting prototype is representative, not a real callback.
- Preserve drafts across session expiry. Rate-limit resend actions and show a cooldown. Recovery responses must not expose whether an account exists.

## Workspace administration

Members 54:4926, billing 54:5075, account 54:5214 share local tabs. Existing Settings members and usage controls link into these screens. Invite, resend, revoke, change role and remove-member dialogs are provided. Removing a member revokes access while retaining authored workspace content.

Proposed authorization: owner manages billing, ownership and deletion; administrator manages members, integrations and publishing; editor edits drafts and assets; viewer reads. Enforce all permissions on the server. The owner row opens ownership transfer rather than ordinary role editing. Require reauthentication and recipient acceptance for ownership transfer. Account deletion is blocked while the user remains the sole owner.

## Publication dependencies and prototype limits

Prices, quotas, legal documents and payment provider remain undecided. Checkout is intentionally unavailable pending those decisions. Terms and privacy panels are publication placeholders, not approved legal documents. No invitations or payment actions have actually been sent or executed.

Japanese is the complete representative design; English signup is a visual reference. Most auth language switches currently go to that reference rather than preserving each screen, and complete multilingual equivalents remain to be designed. Form editing, backend verification, resend timers and persistent mutations are implementation requirements, not simulated behavior promised by this prototype. Error states are available on canvas; some require selecting their frame directly.

Verified screenshots: integrations-current.png and signup-current.png. Both fit their 1440×960 frames without text overflow. Sidebar label propagation was checked on the members and integrations screens.
