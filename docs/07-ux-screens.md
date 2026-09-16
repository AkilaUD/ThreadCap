# 07 — Screen-by-Screen UX

Web app = `apps/web` (React 19 + Tailwind + shadcn/ui). Extension popup = `apps/extension/popup`. Wireframes are ASCII (normative layout intent; pixel design may vary). Each screen: purpose, layout, key states (empty/loading/error), and interactions. All copy uses the voice: *"Never start from zero again."*

---

## 1. Web — Login / Register

```
┌─────────────────────────────────────────────┐
│ ThreadCap                          [docs] [ ]│
│                                             │
│  Welcome back!                              │
│  Your context, one thread across every AI.  │
│                                             │
│  [Work email  ..................]           │
│  [Password    ..................]           │
│  [Forgot password?]                         │
│                                             │
│  [ Sign In ]    [ Continue with Google ]    │
│                                             │
│  Don’t have an account? Register             │
│                                             │
│  • 14-day Pro trial · no card               │
│  • 25 active capsules free forever          │
│  • Unlimited archive on every tier          │
└─────────────────────────────────────────────┘
```
- Social proof under the form (trial + free tier facts, differentiating from "5 capsules" competitors).
- Register: email/password (≥ 12 chars, strength meter) or Google. Post-register → onboarding checklist (see §3).
- States: 429 throttled (Google or email) → inline banner "We're popular — try again in Xs"; 401 invalid creds; 409 email in use.

## 2. Web — Library (dashboard)

```
┌───────────────────────────────────────────────────────────────┐
│ ThreadCap            [Search capsules…       Q]  [+ New] [⬤] │
│ ┌────────┬───────────────────────────────────────────────┐    │
│ │ Filters │ Active · Archived · Deleted · All  (25 used)  │    │
│ │ Folder  │ [x] tag:ecoru  [x] team:eng  [x] proj:loans  │    │
│ │ Teams   │ Sort: Recent | Evgit Relevance                │    │
│ │ Tags    │                                                │    │
│ │ Projects│ ┌──────────────────────────────────────────┐   │    │
│ │         │ │ ▢ Ecoru Revamp        cap_01HZ…  · v12   │   │    │
│ │ ……      │ │  4 files · 2d ago · #ecoru #requirements│   │    │
│ │         │ │  [⋮] → Open · Inject · Version hist ·    │   │    │
│ │         │ │        Edit contents · Pin to project ·  │   │    │
│ │         │ │        Archive · Share · Delete          │   │    │
│ │         │ └──────────────────────────────────────────┘   │    │
│ │         │ ┌──────────────────────────────────────────┐   │    │
│ │         │ │ ▢ Loan Module · 5 caps · 1d ago ###      │   │    │
│ │         │ └──────────────────────────────────────────┘   │    │
│ │         │ [Load more]                                   │    │
│ └────────┴───────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```
- **Archive/Delete toggle** is the primary status filter; free plan shows "x/25 active — archive instead of delete".
- Card menu exposes all version/edit/share/archive actions (edit discoverability H-REQ-5).
- Multi-select drag into a folder works; drag a card v.
- Keyboard: `n` new, `/` search, `a` archive.

## 3. Web — Capture onboarding (empty state + multi-step flow)

**Empty state (library with 0 capsules):**
```
┌───────────────────────────────────────────────────────────────┐
│ ThreadCap            [Search capsules…       Q]  [+ New] [⬤] │
│                                                               │
│                  ┌───────────────────────────┐                │
│                  │   Your library is empty.   │                │
│                  │                           │                │
│                  │   Capsules are versioned   │                │
│                  │   context packages that    │                │
│                  │   travel with you across   │                │
│                  │   every AI tool.           │                │
│                  │                           │                │
│                  │   1. Install extension     │                │
│                  │   2. Capture a chat        │                │
│                  │   3. Inject into another   │                │
│                  │                           │                │
│                  │   [Get started →]          │                │
│                  └───────────────────────────┘                │
│                                                               │
│  ── OR try without installing ──                              │
│  [Try it now — no account needed]                             │
└───────────────────────────────────────────────────────────────┘
```

**Multi-step onboarding checklist (progressive, dismissible):**
```
┌──────────────────────────────────────────────────────┐
│ Getting started · 2 of 4 complete                    │
│ ●━━━━━━━━━━━━━━●━━━━━━━━━━○━━━━━━━━━━━━○           │
│                                                      │
│ ☑ Install Chrome extension          [Completed ✓]   │
│ ☑ Sign in & pin toolbar icon        [Completed ✓]   │
│ ○ Capture your first chat           [Try it →]      │
│ ○ Inject into another AI            [Try it →]      │
│                                                      │
│ [Dismiss checklist]                                  │
└──────────────────────────────────────────────────────┘
```
- Progress bar advances on each completed step (server-tracked per user).
- Each incomplete step has a contextual "Try it" action that deep-links to the relevant surface (extension popup for capture, library for inject).
- On step 4 complete: celebration toast + checklist collapses; re-accessible from Settings → Help.
- Includes a **live "Try it now" demo** on the landing page (§9) so users see the loop before installing.

## 4. Web — Capsule detail (the money screen)

```
┌──────────────────────────────────────────────────────────────────┐
│ Ecoru Revamp · v12                        [Edit contents] [⋮]    │
│ #ecoru #requirements · Engineering · updated 12 min ago          │
│ [Overview] [Context] [Files] [Versions] [Graph*] [Q&A*]          │
├──────────────────────────────────────────────────────────────────┤
│ Objective                                                         │
│ Modernize Ecoru frontend while preserving MVC / validation parity │
│                                                                   │
│ Requirements                                                      │
│ ☑ Loan minimum amount must be 10,000.  (d1) (r1)                 │
│ ☑ Validation must run before submission. (d2) (r1)                │
│                                                                   │
│ Decisions                                                         │
│ • React + TypeScript frontend      • .NET 10 backend              │
│ ------------------------------------------------------------------│
│ Summary · loan-approval flow with dual validation…                │
│ [Inject] [New Version] [Branch*] [Share] [Pin to project]        │
├──────────────────────────────────────────────────────────────────┤
│ Files (3)   loan-spec-v2.pdf · api-contract.pdf · schema.sql     │
└──────────────────────────────────────────────────────────────────┘
* Graph = V2 (Context Replay). Q&A = V2 (semantic chat with the capsule corpus).
```
- **Edit contents** opens §5 editor (inline-edit = create vN+1, never silent mutation).
- **Inject** opens §7 preview (token footer). **Share** creates read-only link.
- Version pill shows `v12` and toggles the Versions tab.

## 5. Web — Version editor / inline edit (H-REQ-5)

```
┌──────────────────────────────────────────────────────────────┐
│ Edit v12 → will create v13                    [Discard][Save]│
│ Objective   [Modernize Ecoru frontend while preserving…… ]   │
│ Background  [Legacy ASP.NET MVC; new React + .NET 10 …… ]    │
│ Requirements  + Add                                          │
│   ☐ [Loan minimum amount must be 10,000.           ]  ✕      │
│   ☐ [Validation must run before submission.        ]  ✕      │
│ Decisions    + Add                                          │
│   [React + TypeScript frontend]  ✕                          │
│ Chat summary auto: "Edited requirements 2, added decision 3" │
│ ──────────────────────────────────────────────────────────── │
│ Change summary  [Edited requirements 2, added decision 3   ] │
└──────────────────────────────────────────────────────────────┘
```
- Saving always creates version; cancel = no mutation. Saved → toast "v13 created · rolled back?" undo affordance (soft revert via rollback).

## 6. Web — Version history + diff

```
┌──────────────────────────────────────────────────────────────┐
│ Version History · Ecoru Revamp                [Restore v10]  │
│ ● v12  current  2h · Alex · "Edited requirements"           │
│ │    differences vs v11:                                    │
│ │    + Added: Loan minimum must be 10,000 (req)             │
│ │    ~ Changed: Approval requirement …                      │
│ ├─ v11  1d · Priya · "Extended from ChatGPT chat"           │
│ ├─ v10  3d · Priya · "Rollback to v8"                      │
│ └─ v08 …                                                    │
└──────────────────────────────────────────────────────────────┘
```
- Diff is **section-aware** (context diff) teammate-safe. Restore → new version, not invisible mutation.
- Conflict hint banner when merge attempted (V2).

## 7. Web + Extension — Inject preview & auto-drop

```
┌────────────────────────────────────────────────────────┐
│ Inject into ChatGPT · Ecoru Revamp · v12               │
│ Purpose: [recap ▾]          Budget: [1,500 tok ▾]      │
│ ☒ Objective   ☒ Requirements   ☒ Decisions   ☐ Constraints │
│ ☐ Assumptions ☐ Open Questions ☐ Attachments          │
│ Include conversation? [ ]  Attach as file (reference) [x]│
│ ────────────────────────────────────────────────────── │
│ Budget: 1,214 / 1,500 tokens (excl. constraints+Qs)    │
│ Preview (front-loaded):                                │
│   ── CAPSULE CONTEXT · Ecoru Revamp · v12 ──────────── │
│   GOAL: Modernize frontend while preserving MVC parity │
│   …                                                   │
│ *Attach = .context.md reference (no per-message cost)  │
│                        [Cancel]    [Inject / Attach]    │
└────────────────────────────────────────────────────────┘
```
Auto-drop toast on the chat page (once per conversation):
```
▼ Ecoru Revamp is pinned to this project — inject v12?   [Inject] [Attach] [x]
```
- Token count is always visible; live throttle warning if estimate exceeds target budget.
- **Purpose picker** immediately filters the preview; section toggles respect the purpose preset (unlocked for manual override).
- **Attach vs Paste** is available whenever `target.supports.files = true`; on unsupported hosts the attach toggle is disabled with a tooltip.

## 8. Extension — Capture progress (the anti-hang screen)

**In-progress state (smart mode):**
```
┌───────────────────────────────────────┐
│ Capture this chat                     │
│ ● Scanning conversation…         30%   │
│ ○ Extracting requirements/decisions…  │
│ ○ Writing summary…                    │
│ ○ Saving capsule…                     │
│ ──────────────────────────────────── │
│ Auto-save on finished                 │
│ Est. tokens: ~2,400                   │
│                     [Cancel]          │
└───────────────────────────────────────┘
```

**In-progress state (raw mode — no AI):**
```
┌───────────────────────────────────────┐
│ Capture this chat                     │
│ ● Scanning conversation…         40%   │
│ ○ Saving capsule…                     │
│ ──────────────────────────────────── │
│ ⚡ Raw mode — no AI processing        │
│ Est. size: ~8 KB                      │
│                     [Cancel]          │
└───────────────────────────────────────┘
```

**Error state (extraction failed):**
```
┌───────────────────────────────────────┐
│ Capture failed                        │
│                                       │
│ ● Scanning conversation…       ✓      │
│ ● Extracting requirements…     ✕      │
│                                       │
│ Error: EXTRACTION_FAILED              │
│ The AI extraction step could not      │
│ complete. Your raw messages are       │
│ saved as a draft capsule.            │
│                                       │
│ [Save as raw capsule]  [Retry]        │
└───────────────────────────────────────┘
```

**Error state (plan limit hit):**
```
┌───────────────────────────────────────┐
│ Capture blocked                       │
│                                       │
│ You've reached 25/25 active capsules  │
│ on the Free plan.                     │
│                                       │
│ [Archive old capsules]  [Upgrade →]   │
└───────────────────────────────────────┘
```

**Error state (trial expired):**
```
┌───────────────────────────────────────┐
│ Capture blocked                       │
│                                       │
│ Your 14-day Pro trial has ended.      │
│ Smart capture requires Pro.           │
│ Raw capture is still available.       │
│                                       │
│ [Use raw mode]  [Upgrade →]           │
└───────────────────────────────────────┘
```

**Done state:**
```
┌───────────────────────────────────────┐
│ ✓ Capsule saved                       │
│                                       │
│ "Ecoru Revamp" · v1 · smart           │
│ 12 messages · 3 attachments           │
│ ~2,400 tokens extracted               │
│                                       │
│ [Open in library]  [Inject now →]     │
└───────────────────────────────────────┘
```

- Raw mode collapses the two AI stages ("Saving capsule… ⚡ no AI used").
- On `done`: toast with capsule link → jump to library/detail. On error: stage highlighted + Retry.
- Backpressure p95 `< 30 s` smart (H-REQ-2).
- Each stage shows a spinner (in-progress), checkmark (done), or X (failed). Progress bar is monotonic (never goes backward).
- Cancel marks the session `cancelled` in the API; the worker stops mid-stage if possible, or finishes the current stage and discards the result.

## 9. Landing page (+ Docs) — try-it-now demo

```
┌─────────────────────────────────────────────────────────────┐
│ 03 | TRY IT NOW · no account needed                          │
│ Drag DD editorial logos/files/paste text → build a capsule   │
│ [Drop zone ──────────────────────────────────────────────]   │
│  [Add Attachment] [Add Text]        [Create Capsule →]      │
│  Preview: structured sections (sandbox demo workspace)      │
└─────────────────────────────────────────────────────────────┘
```
- Sandbox workspace (`ws_demo`), auto-purged after 24h; data marked demo-only. No PII.
- Docs site mirrors this spec structure; every docs page has "Jump to API reference" / "MCP setup".

## 10. Extension — Popup states

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ ThreadCap            [🔍] [⚙] │  │ ThreadCap            [🔍] [⚙] │
│ [+ Capture] [+ Smart] [🍳]   │  │ Recent                       │
│ ──────────────────────────── │  │ ● Ecoru Revamp   v12 · 4 ✕  │
│ Recently used                │  │   [Inject] [Edit] [⋮]       │
│ ● Loan Module   v7 · 2 files │  │ ● API Architecture v3 · 5 ✕ │
│ ● API Arch      v3 · 5 files │  │ …                           │
│ [Library] [Teams] [MCP]      │  │ [+ New Capsule]             │
└──────────────────────────────┘  └──────────────────────────────┘
```
- Unauthenticated state: "Sign in to sync your library" + Google/email.
- `[🍳]` = **Cook This Prompt** enhancer entry; `[MCP]` opens Settings→API tokens if Pro+.
- Empty state: onboarding checklist link.

## 11. Web — Settings (all tabs)

Tabs: Profile · **API Tokens** · Security (E2EE Enterprise) · Preferences (Dynamic Context toggle, **Stealth Injection** toggle) · Plan/Billing · Team.

```
API Tokens · MCP & Claude Code
┌───────────────────────────────────────────────────────┐
│ cursor   · cht_·a3…q  · caps reads · last 2h ago  [revoke]│
│ ci · cht_·b7… · r+w · last 3d ago                 [revoke]│
│ [+ Generate token]   (copy once)      Pro: 3/3 used    │
└───────────────────────────────────────────────────────┘

`Generate token` dialog:
┌───────────────────────────────────────────────────────┐
│ Generate API token                                    │
│ Name: [ci-deploy]                                     │
│ Scopes: ☑ capsules:read  ☑ capsules:write             │
│                                             [Create]  │
│ ── AFTER CREATION ──                                  │
│ Copy your token now — it won't be shown again.        │
│   cht_4f8a7b3c9d1e2f0a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0 │
│                                             [Copied ✓]│
└───────────────────────────────────────────────────────┘
```

```
Preferences
┌───────────────────────────────────────────────────────┐
│ ☑ Dynamic Context                [Learn more]          │
│   Inject only the sections relevant to the current    │
│   conversation. (Pro)                                  │
│                                                       │
│ ☑ Stealth Injection             [Learn more]           │
│   Strip metadata & avoid platform fingerprints when    │
│   injecting.                                           │
│                                                       │
│ ☐ Keep capsules updated          (per-capsule override │
│   Auto re-harvest pinned capsules into new versions.    │
│   Respects per-chat consent.                            │
└───────────────────────────────────────────────────────┘
```

```
Billing
┌───────────────────────────────────────────────────────┐
│ Current plan: Free                                    │
│ Active capsules: 12 / 25      Archived: 47 (unlimited)│
│                                                       │
│ ┌─────────────────┐  ┌─────────────────┐              │
│ │ PRO  $5/mo      │  │ TEAM  $10/ur/mo │              │
│ │ Unlimited caps  │  │ Everything in   │              │
│ │ Deep versions   │  │ Pro + teams     │              │
│ │ 3 MCP tokens    │  │ 10 MCP tokens   │              │
│ │ Smart injection │  │ RBAC + audit    │              │
│ │ [Upgrade →]     │  │ [Upgrade →]     │              │
│ └─────────────────┘  └─────────────────┘              │
│ Trial: Pro until 2026-09-30 · 3 days left             │
└───────────────────────────────────────────────────────┘
```

```
Security (Enterprise only — E2EE)
┌───────────────────────────────────────────────────────┐
│ End-to-End Encryption                                 │
│ ● Server-assisted (enabled)  ○ Client-only (locked)  │
│                                                       │
│ Your data is encrypted at rest. Server-assisted keys   │
│ can recover access; client-only keys cannot.          │
│                                                       │
│ [Enable client-only]  (requires 24-word recovery      │
│  phrase generated offline; loss = permanent data loss)│
│                                                       │
│ Encrypted fields: conversation, attachments,          │
│ openQuestions. Search over these fields is disabled.  │
└───────────────────────────────────────────────────────┘
```

```
Profile
┌───────────────────────────────────────────────────────┐
│ [avatar]  Alex Dev                                    │
│ [Full name ....................]                      │
│ [Work email ...................]  (verified ✓)        │
│                                                       │
│ [Old password ............]  [New password ........]  │
│                                          [Save]       │
│                                                       │
│ [Danger]  Delete account (hard-purges after 30 days)  │
└───────────────────────────────────────────────────────┘
```

- E2EE enablement flow: wizard — generate key, verify recovery code, choose "server-assisted" vs "client-only" mode (details [08-security-model](/08-security-model.md) §6).
- Billing shows tier upsell with the trial downgrade banner when trial is near/over (H-REQ-17).

## 12. Web — Team workspace + members

**Workspace view:**
```
┌──────────────────────────────────────────────────────┐
│ Engineering  · golden prompt  [Edit]                   │
│ 8 members · 42 capsules                               │
│ [Add member] [New capsule to team]                    │
│ COLUMNS: Active | Versioned | Archived                │
│ ● Auth Spec v3 · @alex · 2h ago                       │
│ ● API contract · @priya · yesterday                   │
└──────────────────────────────────────────────────────┘
```

**Golden prompt editor (team "perfect prompt"):**
```
┌──────────────────────────────────────────────────────┐
│ Team golden prompt · Engineering                      │
│ This context is injectable into any member's chat.   │
│ ──────────────────────────────────────────────────── │
│ ┌─ Team briefing for all engineering work on Ecoru:  │
│ │ 1. Stack: React + .NET 10 (preserve MVC parity).  │
│ │ 2. Validation runs before submission.              │
│ │ 3. Loan minimum = 10,000.                          │
│ │ 4. NFRs: response < 300 ms p95.                    │
│ └──────────────────────────────────────────────────┘ │
│ Est. 380 tokens · [Inject to my chat →]  [Save]      │
└──────────────────────────────────────────────────────┘
```

**Members list:**
```
┌──────────────────────────────────────────────────────┐
│ Members · Engineering · 8 total                      │
│ [Invite by email]                                    │
│ Name          Role          Capsules   Joined        │
│ Alex Dev      Owner         12         2026-08-01    │
│ Priya Sharma  Admin          7         2026-08-02    │
│ Jordan Lee    Contributor    3         2026-08-05    │
│ …                                                     │
│ ── Pending invites ──                                │
│ sam@acme.dev  Contributor   (sent 2d ago)  [Resend]  │
│ + ⋯                                                  │
└──────────────────────────────────────────────────────┘
```

**Role selector (per member):**
```
┌──────────────────────────────────────────────────────┐
│ Change role for Priya Sharma                         │
│ ○ Owner      — full control + billing                │
│ ● Admin      — manage members, edit golden prompt    │
│ ○ Contributor— create/edit capsules                  │
│ ○ Viewer     — read-only                             │
│                                     [Cancel] [Save] │
└──────────────────────────────────────────────────────┘
```

- Role badges; create requires Team plan (upgrade gate), join available on Pro.
- Golden prompt block pinned top (team "perfect prompt", injectable to any member's chat).
- Members can only be removed/adjusted by Admin+; invites expire after 7 days; email verification required before role activation.

## 13. Web — Search results

```
┌───────────────────────────────────────────────────────────────┐
│ ThreadCap    [loan minimum validation               Q]  [+ New]│
│                                                               │
│ 8 results in 0.2s · filtered to:  [All capsules ▾]            │
│ ┌────────────────────────────────────────────┐                │
│ │ ✓ Loan Module · v7 · 85% · cap_01HZ…        │                │
│ │   "Loan minimum amount must be 10,000"      │                │
│ │   matches requirement · req_3 · snippet ▾   │                │
│ └────────────────────────────────────────────┘                │
│ ┌────────────────────────────────────────────┐                │
│ │ ✓ Ecoru Revamp · v12 · 62% · cap_01HZ…      │                │
│ │   "validation must run before submission"   │                │
│ │   matches message · msg_7 · snippet ▾       │                │
│ └────────────────────────────────────────────┘                │
│ [Load more]                                                    │
└───────────────────────────────────────────────────────────────┘
```
- Each result shows: kind badge (capsule/message/attachment), capsule name, version, score bar, snippet with the matched text highlighted, and a "jump to section" link.
- Result click → opens capsule at the matched section (scrolls to highlight) — not a flat file view.
- Search scope filters repeat the Library filters (team, project, tag, status).

## 14. Web — Share link creation + shared view

**Create share:**
```
┌──────────────────────────────────────────────────────────────┐
│ Share "Ecoru Revamp" (read-only)                              │
│ Expires:  [never ▾]  or  [7 days] [30 days] [custom date]     │
│ ☐ Include conversation?  (stripped by default)                │
│ ☐ Require viewer PIN?  (enterprise)                           │
│                                              [Create link →]  │
│ ── created ──                                                │
│ 🔗 app.threadcap.app/s/shr_01HZX…                             │
│ [Copy]  [Copy markdown badge]  [Revoke]                       │
└──────────────────────────────────────────────────────────────┘
```

**Public shared view (no auth):**
```
┌──────────────────────────────────────────────────────────────┐
│ 🔗 Shared Capsule · by Alex Dev · expired never              │
│ ─────────────────────────────────────────────────────────── │
│ Ecoru Revamp · v12 (latest)                                  │
│ ┌────────────────────────────────────────┐                   │
│ │ Objective: Modernize Ecoru frontend … │                   │
│ │ Requirements: • Loan min 10,000        │                   │
│ │              • Validation pre-submit   │                   │
│ │ Decisions: 3 · Constraints: 5          │                   │
│ └────────────────────────────────────────┘                   │
│ [Copy full context]  [Own this capsule → sign up]            │
│ conversation: 12 messages (hidden)                           │
└──────────────────────────────────────────────────────────────┘
```
- "Own this capsule" → register → `POST /capsules/import-share` with the token → becomes a private draft capsule in the new user's library.
- EPIN/privacy: conversation hidden by default; show requires `?includeConversation=1&ephemeral=1` from the owner.

## 15. Extension + Web — Auto-drop hint (project pin)

**Chat page (once per composer session):**
```
┌──────────────────────────────────────────────────────────────┐
│ ▼ “Ecoru Revamp” is pinned to this project                   │
│     Inject v12 context?   [Inject]  [Attach]  [Preview]  [x] │
└──────────────────────────────────────────────────────────────┘
```
- Appears ~400 ms after the composer becomes empty+focusable, **once per conversation** (dedupe guard).
- Actions: Inject (paste brief), Attach (attach-as-file when supported), Preview (open the §7 preview first), dismiss (respects dismissal until the tab change, unless re-pinned).

**Library "pin to project" affordance:**
```
┌──────────────────────────────────────────────────────────────┐
│ Pin capsule to a project                                     │
│ Project: [chgpt/project/ecoru-revamp ▾]  ·  w/ :                     │
│ ── Project refs matched from your capture history ──        │
│ ● ChatGPT project "Ecoru Revamp" (last captured 2d ago)      │
│ ● Claude project "ecoru-frontend" (last captured 5d ago)     │
│ [Pin to new project ref …]            [Save pin]             │
└──────────────────────────────────────────────────────────────┘
```
- A capsule can be pinned to multiple project refs; one pin per project-ref (last pin wins).

## 16. Web — Live capsule consent + drift diff (D-013)

**Enable flow:**
```
┌──────────────────────────────────────────────────────────────┐
│ Keep "Ecoru Revamp" updated?                                 │
│                                                              │
│ When you close this project's chat, ThreadCap re-captures    │
│ and creates a NEW version (v13) — you can always inspect     │
│ the diff and roll back. Nothing is overwritten silently.     │
│                                                              │
│ [Enable auto-update]  [Not now]                              │
└──────────────────────────────────────────────────────────────┘
```

**Post-re-harvest toast:**
```
┌──────────────────────────────────────────────────────────────┐
│ ✓ Ecoru Revamp updated to v13                                │
│   Changed: +2 messages · ~1 requirement · 1 decision         │
│   [View diff]  [Revert to v12]  [x]                          │
└──────────────────────────────────────────────────────────────┘
```
- Diff panel (reuses §6 component) highlights only the changed sections; "Revert" = rollback to v12 (creates v14, immutable history preserved).

## 17. Web — Injection prepare error states

```
BUDGET_EXCEEDED (requested 400t, viable minimum 800t):
┌──────────────────────────────────────────────────────────────┐
│ Budget too small for "handoff" (needs ≥ 800 tokens)          │
│ Cheapest viable variant: "recap" · 752 tokens                │
│ Excluded: constraints, open questions, attachments           │
│ [Use cheapest variant]  [Raise budget]  [Cancel]             │
└──────────────────────────────────────────────────────────────┘
```

```
RATE_LIMITED / host unsupported:
┌──────────────────────────────────────────────────────────────┐
│ This host doesn't support file attachments                   │
│ → we'll paste inline instead (may consume tokens per reply)  │
│ [Continue inline]  [Copy to clipboard]                       │
└──────────────────────────────────────────────────────────────┘
```

## 18. Web — Version detail (full diff view)

```
┌──────────────────────────────────────────────────────────────┐
│ Version v13 → v12 diff · Ecoru Revamp                        │
│ ── changed by Alex 2h ago ──                                 │
│ ┌ Requirements ──────────────────────────────────────────┐  │
│ │ + Loan minimum amount must be 10,000                   │  │
│ │   (list item added · req_3)                            │  │
│ │ ~  Validation must run before submission.               │  │
│ │   (text changed: "after" → "before")                   │  │
│ │ -  Old requirement text (req_9, superseded)            │  │
│ └────────────────────────────────────────────────────────┘  │
│ ┌ Decisions ─────────────────────────────────────────────┐  │
│ │ + React + TypeScript frontend (dec_1)                  │  │
│ └────────────────────────────────────────────────────────┘  │
│ [Restore this version]  [Copy as markdown diff]            │
└──────────────────────────────────────────────────────────────┘
```
- Each `+` / `~` / `-` line links to the exact context item; link opens the item's full text + its status (open/accepted/superseded/rejected).

## 19. Cross-screen acceptance mapping
Each screen implements the H-REQ criteria in [09-mvp-acceptance](/09-mvp-acceptance.md) §3 (edit discoverable, injection preview, archive-not-delete, trial downgrade banner on settings/billing, token count everywhere). All screens render empty/error states identical to the spec before ship.